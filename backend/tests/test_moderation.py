"""FR-90–92: screening errors must never become successful classifications."""

import json
import os
import unittest
from unittest.mock import patch
import httpx2 as httpx
from openai import OpenAI

from moderation import ModerationError, moderate_content, moderate_text


class ModerationTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.dotenv = patch("moderation.load_dotenv")
        self.dotenv.start()
        self.addCleanup(self.dotenv.stop)

    @patch("moderation.OpenAI")
    def test_preserves_safe_and_flagged_provider_results(self, send):
        for flagged in (False, True):
            with self.subTest(flagged=flagged):
                payload = {
                    "model": "test-model-version",
                    "results": [{
                        "flagged": flagged,
                        "categories": {"violence/graphic": flagged},
                        "category_scores": {"violence/graphic": 0.85 if flagged else 0.01},
                    }],
                }
                requests = []
                def handle(request):
                    requests.append(request)
                    return httpx.Response(200, json=payload)
                send.side_effect = lambda **kwargs: OpenAI(
                    **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handle))
                )
                result = moderate_text("A sample post")
                self.assertEqual(result.flagged, flagged)
                self.assertEqual(result.model, payload["model"])
                self.assertEqual(result.category_scores, payload["results"][0]["category_scores"])
                request = requests[0]
                self.assertEqual(json.loads(request.content)["input"], "A sample post")
                self.assertGreaterEqual(result.latency_ms, 0)

    @patch("moderation.OpenAI")
    def test_blank_input_does_not_call_provider(self, send):
        with self.assertRaises(ValueError):
            moderate_text(" \n ")
        send.assert_not_called()

    @patch("moderation.OpenAI")
    def test_missing_key_does_not_call_provider(self, send):
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            with self.assertRaisesRegex(ModerationError, "OPENAI_API_KEY"):
                moderate_text("A sample post")
        send.assert_not_called()

    @patch("moderation.OpenAI")
    def test_provider_errors_do_not_return_classifications(self, send):
        for status in (401, 429, 500):
            with self.subTest(status=status):
                requests = []
                def handle(request):
                    requests.append(request)
                    return httpx.Response(status, json={"error": {"message": "private provider message"}})
                send.side_effect = lambda **kwargs: OpenAI(
                    **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handle))
                )
                with self.assertRaisesRegex(ModerationError, f"HTTP {status}") as caught:
                    moderate_text("A sample post")
                self.assertNotIn("private provider message", str(caught.exception))
                self.assertEqual(len(requests), 1)

    @patch("moderation.OpenAI")
    def test_timeout_does_not_return_classification_or_retry(self, send):
        requests = []
        def handle(request):
            requests.append(request)
            raise httpx.ReadTimeout("private provider message")
        send.side_effect = lambda **kwargs: OpenAI(
            **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handle))
        )
        with self.assertRaisesRegex(ModerationError, "timed out"):
            moderate_text("A sample post")
        self.assertEqual(len(requests), 1)

    @patch("moderation.OpenAI")
    def test_invalid_results_do_not_return_classifications(self, send):
        for payload in (
            b"not json",
            b'{"model": "test", "results": []}',
            b'{"model": "test", "results": [{"flagged": false}]}',
        ):
            with self.subTest(payload=payload):
                def handle(request):
                    return httpx.Response(200, content=payload, headers={"Content-Type": "application/json"})
                send.side_effect = lambda **kwargs: OpenAI(
                    **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handle))
                )
                with self.assertRaises(ModerationError):
                    moderate_text("A sample post")

    @patch("moderation.OpenAI")
    def test_later_image_flag_blocks_even_with_false_overall_flag(self, send):
        for overall in (False, True):
            with self.subTest(overall=overall):
                requests = []
                def handle(request):
                    requests.append(json.loads(request.content))
                    flagged = len(requests) == 2
                    return httpx.Response(200, json={"model": "test-model", "results": [{
                        "flagged": overall if flagged else False,
                        "categories": {"violence": flagged, "sexual": False},
                        "category_scores": {"violence": 0.9 if flagged else 0.01,
                                            "sexual": 0.02 if flagged else 0.1},
                    }]})
                send.side_effect = lambda **kwargs: OpenAI(**kwargs,
                    http_client=httpx.Client(transport=httpx.MockTransport(handle)))
                result = moderate_content("Title and body", ("https://first", "https://second", "https://third"))
                self.assertTrue(result.blocked)
                self.assertEqual(result.flagged, overall)
                self.assertEqual(result.categories, {"violence": True, "sexual": False})
                self.assertEqual(result.category_scores, {"violence": 0.9, "sexual": 0.1})
                self.assertEqual(result.image_count, 3)
                self.assertEqual([check.position for check in result.image_results], [0, 1])
                self.assertFalse(result.image_results[0].blocked)
                self.assertTrue(result.image_results[1].blocked)
                # A later error cannot turn an already decisive block into retries.
                self.assertEqual(len(requests), 2)

    @patch("moderation.OpenAI")
    def test_later_image_failure_never_returns_partial_approval(self, send):
        safe = {"flagged": False, "categories": {"violence": False},
                "category_scores": {"violence": 0.01}}
        for failure, code in (
            ("timeout", "provider_connection"), ("rate_limit", "provider_http_429"),
            ("empty", "provider_response"), ("multiple", "provider_response"),
            ("malformed", "provider_response"),
        ):
            with self.subTest(failure=failure):
                requests = []
                def handle(request):
                    requests.append(request)
                    if len(requests) == 1:
                        return httpx.Response(200, json={"model": "test-model", "results": [safe]})
                    if failure == "timeout":
                        raise httpx.ReadTimeout("private")
                    if failure == "rate_limit":
                        return httpx.Response(429, headers={"retry-after": "180"},
                                              json={"error": {"message": "private"}})
                    results = {"empty": [], "multiple": [safe, safe], "malformed": [{"flagged": False}]}
                    return httpx.Response(200, json={"model": "test-model", "results": results[failure]})
                send.side_effect = lambda **kwargs: OpenAI(**kwargs,
                    http_client=httpx.Client(transport=httpx.MockTransport(handle)))
                with self.assertRaises(ModerationError) as caught:
                    moderate_content("Title and body", ("https://first", "https://second", "https://third"))
                self.assertEqual(caught.exception.code, code)
                if failure == "rate_limit":
                    self.assertEqual(caught.exception.retry_after, 180)
                self.assertEqual(len(requests), 2)

    @patch("moderation.OpenAI")
    def test_too_many_images_does_not_call_provider(self, send):
        with self.assertRaises(ValueError):
            moderate_content("Title", ("https://private",) * 11)
        send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
