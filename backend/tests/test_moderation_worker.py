"""FR-90–92: provider payloads, private image signing and lifecycle without network."""
import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"
os.environ["MODERATION_ENABLED"] = "false"

import httpx
import httpx2
from fastapi.testclient import TestClient
from openai import OpenAI
from sqlalchemy.dialects import postgresql

from main import app
from models import Post
from moderation import ModerationError, TextModerationResult, moderate_content
from moderation_storage import sign_moderation_image
from moderation_worker import Settings, audit_label, eligible_posts, record_failure


def verdict(flagged=False, category="violence", overall=None):
    return TextModerationResult(flagged=flagged if overall is None else overall,
        categories={category: flagged}, category_scores={category: 0.9 if flagged else 0.01},
        model="test-model", latency_ms=1)


class WorkerUnitTests(unittest.TestCase):
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
                {"flagged": False, "categories": {"violence": False}, "category_scores": {"violence": 0.01}}
            ]})
        client.side_effect = lambda **kwargs: OpenAI(**kwargs,
            http_client=httpx2.Client(transport=httpx2.MockTransport(handle)))
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test"}):
            result = moderate_content("Title\n\nBody", ("https://test/first", "https://test/second"))
        self.assertFalse(result.blocked)
        self.assertEqual(requests[0]["input"], [
            {"type": "text", "text": "Title\n\nBody"},
            {"type": "image_url", "image_url": {"url": "https://test/first"}},
            {"type": "image_url", "image_url": {"url": "https://test/second"}},
        ])

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
