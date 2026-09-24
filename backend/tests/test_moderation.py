"""FR-90–92: screening errors must never become successful classifications."""

import json
import os
import unittest
from unittest.mock import patch
import httpx2 as httpx
from openai import OpenAI

from moderation import ModerationError, moderate_text


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


if __name__ == "__main__":
    unittest.main()
