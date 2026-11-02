"""Backend-only Storage byte transfers are bounded and use private object paths."""
import os
import unittest
from unittest.mock import MagicMock, patch

import httpx

from images.worker_storage import check_response, read_image, write_image, remove_images
from moderation.client import ModerationError


class WorkerStorageTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"SUPABASE_URL": "http://127.0.0.1:54321",
                                      "SUPABASE_SECRET_KEY": "sb_secret_test"})
        env.start()
        self.addCleanup(env.stop)

    def test_private_download_uses_bounded_stream_and_backend_key(self):
        with patch("images.worker_storage.httpx.stream") as stream:
            stream.return_value.__enter__.return_value = httpx.Response(200, content=b"abc")
            self.assertEqual(read_image("owner/photo name.png"), b"abc")
            args, kwargs = stream.call_args
            self.assertTrue(args[1].endswith("/object/authenticated/post-images/owner/photo%20name.png"))
            self.assertEqual(kwargs["headers"], {"apikey": "sb_secret_test"})

    def test_oversized_stream_stops_and_error_does_not_echo_upstream(self):
        with patch("images.worker_storage.httpx.stream") as stream:
            response = MagicMock(is_success=True)
            response.iter_bytes.return_value = iter([b"abc", b"def"])
            stream.return_value.__enter__.return_value = response
            with patch("images.worker_storage.MAX_IMAGE_BYTES", 4), self.assertRaises(ModerationError):
                read_image("owner/photo.png")
            stream.side_effect = httpx.ConnectError("private host and token")
            with self.assertRaises(ModerationError) as caught:
                read_image("owner/photo.png")
            self.assertNotIn("token", str(caught.exception))

    def test_version_write_is_immutable_and_deletion_uses_api(self):
        with patch("images.worker_storage.httpx.post", return_value=httpx.Response(200)) as post:
            write_image("owner/variants/preview.webp", b"abc")
            self.assertEqual(post.call_args.kwargs["headers"]["x-upsert"], "false")
            self.assertEqual(post.call_args.kwargs["content"], b"abc")
        with patch("images.worker_storage.httpx.request", return_value=httpx.Response(200)) as request:
            remove_images(["owner/source.png"])
            self.assertEqual(request.call_args.args[0], "DELETE")
            self.assertEqual(request.call_args.kwargs["json"], {"prefixes": ["owner/source.png"]})

    def test_authentication_failures_are_distinct_from_outages_without_echoing_secrets(self):
        for status in (401,403):
            with self.assertRaises(ModerationError) as caught:
                check_response(httpx.Response(status,json={'message':'private secret'}),'storage_read')
            self.assertEqual(caught.exception.code,'storage_auth')
            self.assertNotIn('private',str(caught.exception))
        with self.assertRaises(ModerationError) as caught:
            check_response(httpx.Response(400,json={'message':"headers must have required property 'authorization'"}),'storage_read')
        self.assertEqual(caught.exception.code,'storage_auth')
        with self.assertRaises(ModerationError) as caught:
            check_response(httpx.Response(503,content=b'unavailable'),'storage_read')
        self.assertEqual(caught.exception.code,'storage_read')

    def test_streamed_gateway_auth_error_is_read_before_classification(self):
        response = httpx.Response(400, stream=httpx.ByteStream(
            b'{"message":"headers must have required property authorization; private secret"}'))
        self.assertFalse(response.is_stream_consumed)
        with patch("images.worker_storage.httpx.stream") as stream:
            stream.return_value.__enter__.return_value = response
            with self.assertRaises(ModerationError) as caught:
                read_image("owner/photo.png")
        self.assertEqual(caught.exception.code, "storage_auth")
        self.assertNotIn("private secret", str(caught.exception))
