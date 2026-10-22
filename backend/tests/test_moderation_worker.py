"""FR-90–92: provider payloads, private image signing and lifecycle without network."""
import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, Mock, patch

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"
os.environ["IMAGE_PROCESSING_ENABLED"] = "false"
os.environ["MODERATION_ENABLED"] = "false"

import httpx
import httpx2
from fastapi.testclient import TestClient
from openai import OpenAI
from sqlalchemy.dialects import postgresql

from main import app
from models import Post, Space
from moderation import ModerationError, TextModerationResult, moderate_content
from moderation_storage import sign_moderation_image
from moderation_context import ContextAssessment
from moderation_worker import Settings, Work, audit_label, eligible_posts, record_failure, run_once
from uuid import uuid4


def verdict(flagged=False, category="violence", overall=None):
    return TextModerationResult(flagged=flagged if overall is None else overall,
        categories={category: flagged}, category_scores={category: 0.9 if flagged else 0.01},
        model="test-model", latency_ms=1)


class WorkerUnitTests(unittest.TestCase):
    def test_context_recheck_is_opt_in_text_only_and_failure_retries(self):
        work = Work(uuid4(), uuid4(), "fingerprint", "Question\n\nKill Tony?", (), "text")
        first = TextModerationResult(flagged=True, categories={"violence": True},
            category_scores={"violence": 0.42}, model="test", latency_ms=1)
        context = ContextAssessment(decision="allow", reason_code="media_reference")
        with (patch("moderation_worker.claim_work", return_value=work),
              patch("moderation_worker.moderate_content", return_value=first),
              patch("moderation_worker.moderate_context", return_value=context) as recheck,
              patch("moderation_worker.finish_work") as finish):
            run_once(settings=Settings())
            recheck.assert_not_called()
            self.assertIsNone(finish.call_args.args[-1])
            run_once(settings=Settings(context_recheck_enabled=True))
            recheck.assert_called_once_with(work.text)
            self.assertEqual(finish.call_args.args[-1], context)
            recheck.side_effect = ModerationError("Unavailable", code="context_provider")
            run_once(settings=Settings(context_recheck_enabled=True))
            self.assertEqual(finish.call_args.args[4].code, "context_provider")

        image = Work(work.post_id, work.claim, work.content_hash, work.text, ("key",), "image")
        with (patch("moderation_worker.claim_work", return_value=image),
              patch("moderation_worker.moderation_image_input", return_value="https://private/image"),
              patch("moderation_worker.moderate_content", return_value=first),
              patch("moderation_worker.moderate_context") as recheck,
              patch("moderation_worker.finish_work")):
            run_once(settings=Settings(context_recheck_enabled=True))
            recheck.assert_not_called()

    def test_any_category_blocks_even_when_overall_flag_is_false(self):
        result = verdict(True, "illicit/violent", overall=False)
        self.assertTrue(result.blocked)
        self.assertEqual(audit_label(result), ("illicit", 0.9))
        self.assertEqual(audit_label(verdict(True, "future-category")), ("other", 0.9))
        self.assertEqual(audit_label(verdict(False, overall=True))[0], "other")

    def test_retry_delays_limit_and_exhaustion_preserve_pending(self):
        now = datetime.now(timezone.utc)
        post = Post(status="pending", moderation_attempts=1)
        settings = Settings()
        record_failure(post, settings, now, "provider_connection")
        self.assertEqual(post.moderation_next_attempt_at, now + timedelta(seconds=30))
        post.moderation_attempts = 2
        record_failure(post, settings, now, "provider_http_429", retry_after=180)
        self.assertEqual(post.moderation_next_attempt_at, now + timedelta(seconds=180))
        post.moderation_attempts = 3
        record_failure(post, settings, now, "provider_connection")
        self.assertEqual(post.status, "pending")
        self.assertEqual(post.moderation_exhausted_at, now)

    def test_claim_sql_scopes_queue_and_skips_locks(self):
        sql = str(eligible_posts(datetime.now(timezone.utc)).compile(dialect=postgresql.dialect()))
        for clause in ("spaces.kind =", "spaces.slug =", "spaces.deleted_at IS NULL",
                       "posts.moderation_exhausted_at IS NULL", "posts.moderation_next_attempt_at <=",
                       "ORDER BY public.posts.created_at, public.posts.id", "FOR UPDATE OF posts SKIP LOCKED"):
            self.assertIn(clause, sql)

    @patch("moderation.load_dotenv")
    @patch("moderation.OpenAI")
    def test_multimodal_request_contains_every_attachment(self, client, dotenv):
        requests = []
        def handle(request):
            requests.append(json.loads(request.content))
            return httpx2.Response(200, json={"model": "test-model", "results": [
                {"flagged": False, "categories": {"violence": False},
                 "category_scores": {"violence": len(requests) / 100}}
            ]})
        client.side_effect = lambda **kwargs: OpenAI(**kwargs,
            http_client=httpx2.Client(transport=httpx2.MockTransport(handle)))
        for count in (1, 2, 10):
            with self.subTest(count=count), patch.dict(os.environ, {"OPENAI_API_KEY": "test"}):
                requests.clear()
                urls = tuple(f"https://private/image-{i}?token=secret" for i in range(count))
                result = moderate_content("Title\n\nBody", urls)
                self.assertFalse(result.blocked)
                self.assertEqual(len(requests), count)
                self.assertEqual(result.image_count, count)
                self.assertEqual(result.category_scores, {"violence": count / 100})
                self.assertEqual([check.position for check in result.image_results], list(range(count)))
                self.assertEqual([check.category_scores["violence"] for check in result.image_results],
                                 [(i + 1) / 100 for i in range(count)])
                self.assertTrue(all(check.model == "test-model" for check in result.image_results))
                self.assertNotIn("https://private", result.model_dump_json())
                self.assertNotIn("secret", result.model_dump_json())
                for request, url in zip(requests, urls, strict=True):
                    self.assertEqual(request["input"], [
                        {"type": "text", "text": "Title\n\nBody"},
                        {"type": "image_url", "image_url": {"url": url}},
                    ])

    @patch("moderation.load_dotenv")
    @patch("moderation.OpenAI")
    def test_multiple_image_verdicts_reach_post_status_and_audit(self, client, dotenv):
        """FR-90–92: exercise real screening and finish logic with HTTP/DB doubles."""
        for outcome in ("allow", "block", "timeout", "exhausted"):
            with self.subTest(outcome=outcome):
                requests = []
                def handle(request):
                    requests.append(json.loads(request.content))
                    if len(requests) == 2 and outcome in ("timeout", "exhausted"):
                        raise httpx2.ReadTimeout("private URL must not be logged")
                    flagged = len(requests) == 2 and outcome == "block"
                    return httpx2.Response(200, json={"model": "test-model", "results": [
                        {"flagged": flagged, "categories": {"violence": flagged},
                         "category_scores": {"violence": 0.9 if flagged else 0.01}}
                    ]})
                client.side_effect = lambda **kwargs: OpenAI(**kwargs,
                    http_client=httpx2.Client(transport=httpx2.MockTransport(handle)))
                work = Work(uuid4(), uuid4(), "fingerprint", "Title\n\nBody", ("first", "second"), "image")
                post = Post(id=work.post_id, status="pending", moderation_claim=work.claim,
                            moderation_lease_until=datetime.now(timezone.utc) + timedelta(seconds=300),
                            moderation_attempts=3 if outcome == "exhausted" else 1)
                sessions = MagicMock()
                db = sessions.return_value.__enter__.return_value
                db.scalar.return_value = post
                db.get.return_value = Space(kind="campus", slug="general", deleted_at=None)
                with (patch.dict(os.environ, {"OPENAI_API_KEY": "test"}),
                      patch("moderation_worker.claim_work", return_value=work),
                      patch("moderation_worker.content_snapshot", return_value=(work.content_hash, work.images)),
                      patch("moderation_worker.moderation_image_input",
                            side_effect=lambda key: f"https://private/{key}?token=secret")):
                    self.assertTrue(run_once(sessions, Settings()))
                self.assertEqual(len(requests), 2)
                db.commit.assert_called_once()
                self.assertIsNone(post.moderation_claim)
                self.assertIsNone(post.moderation_lease_until)
                if outcome in ("allow", "block"):
                    self.assertEqual(post.status, "approved" if outcome == "allow" else "blocked")
                    audit = db.add.call_args.args[0]
                    self.assertEqual(audit.decision, outcome)
                    self.assertEqual(audit.content_hash, work.content_hash)
                    self.assertEqual(audit.provider_result["image_count"], 2)
                    self.assertEqual(len(audit.provider_result["image_results"]), 2)
                    self.assertNotIn("https://private", json.dumps(audit.provider_result))
                    self.assertNotIn("secret", json.dumps(audit.provider_result))
                else:
                    self.assertEqual(post.status, "pending")
                    self.assertEqual(post.moderation_error, "provider_connection")
                    db.add.assert_not_called()
                    if outcome == "exhausted":
                        self.assertIsNotNone(post.moderation_exhausted_at)
                    else:
                        self.assertIsNone(post.moderation_exhausted_at)
                        self.assertIsNotNone(post.moderation_next_attempt_at)

    @patch("moderation.load_dotenv")
    @patch("moderation.OpenAI")
    def test_retry_after_is_preserved_without_hidden_sdk_retries(self, client, dotenv):
        calls = []
        def handle(request):
            calls.append(request)
            return httpx2.Response(429, headers={"retry-after": "180"}, json={"error": {"message": "private"}})
        client.side_effect = lambda **kwargs: OpenAI(**kwargs,
            http_client=httpx2.Client(transport=httpx2.MockTransport(handle)))
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test"}), self.assertRaises(ModerationError) as caught:
            moderate_content("Text")
        self.assertEqual(caught.exception.retry_after, 180)
        self.assertEqual(len(calls), 1)
        self.assertNotIn("private", str(caught.exception))

    @patch("moderation_storage.httpx.post")
    def test_secret_storage_signing_is_separate_from_user_routes(self, send):
        send.return_value = httpx.Response(200, json={"signedURL": "/object/sign/post-images/u/id.png?token=private"})
        for key in ("sb_secret_test", "legacy-jwt"):
            with self.subTest(key=key), patch.dict(os.environ, {
                "SUPABASE_URL": "https://test.supabase.co", "SUPABASE_SECRET_KEY": key,
            }):
                url = sign_moderation_image("u/id.png")
                self.assertTrue(url.startswith("https://test.supabase.co/storage/v1/object/sign/"))
                headers = send.call_args.kwargs["headers"]
                self.assertEqual(headers["apikey"], key)
                self.assertEqual("Authorization" in headers, key == "legacy-jwt")

    @patch("moderation_storage.httpx.post")
    def test_storage_failures_never_return_a_url_or_upstream_details(self, send):
        with patch.dict(os.environ, {"SUPABASE_URL": "https://test", "SUPABASE_SECRET_KEY": "test"}):
            for response in (httpx.Response(403, text="private"), httpx.Response(200, json=[]),
                             httpx.Response(200, json={"signedURL": "https://wrong-host/private"})):
                send.return_value = response
                with self.assertRaises(ModerationError) as caught:
                    sign_moderation_image("u/id.png")
                self.assertNotIn("private", str(caught.exception))

    @patch("main.Thread")
    def test_lifespan_starts_and_stops_worker(self, thread):
        with patch.dict(os.environ, {"MODERATION_ENABLED": "true"}):
            with TestClient(app):
                thread.return_value.start.assert_called_once()
                stop = thread.call_args.kwargs["args"][0]
                self.assertFalse(stop.is_set())
            self.assertTrue(stop.is_set())
            thread.return_value.join.assert_called_once_with(5)

    @patch("main.Thread")
    def test_lifespan_does_not_start_worker_without_opt_in(self, thread):
        with patch.dict(os.environ, {}, clear=True):
            with TestClient(app):
                thread.assert_not_called()
