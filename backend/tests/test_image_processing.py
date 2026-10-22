"""FR-32/90: actual codecs, durable processing outcomes and source cleanup."""
import os
os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"
os.environ["IMAGE_PROCESSING_ENABLED"] = "false"

from datetime import datetime, timedelta, timezone
from io import BytesIO
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from PIL import Image

from image_processing import process_image
from image_processing_worker import Work, Settings, SOURCE_GRACE_SECONDS, claim_work, finish_work, run_once, cleanup_original_once
from image_worker_storage import image_data_url
from models import ImageUpload, ImageVariant, Profile
from moderation import ModerationError, TextModerationResult


def source(size=(1200, 800), mode="RGB", format="PNG"):
    buffer = BytesIO()
    Image.new(mode, size, (20, 70, 110, 128) if mode == "RGBA" else (20, 70, 110)).save(buffer, format)
    return buffer.getvalue()


def verdict(blocked=False):
    return TextModerationResult(flagged=blocked, categories={"violence": blocked},
        category_scores={"violence": .9 if blocked else .01}, model="test", latency_ms=1)


class CodecTests(unittest.TestCase):
    def test_purpose_outputs_and_aspect_ratios(self):
        expected = {"post": [("preview", 600, 400), ("expanded", 1200, 800)],
                    "avatar": [("avatar_small", 96, 96), ("avatar_large", 384, 384)],
                    "banner": [("banner", 1200, 800)]}
        for purpose, sizes in expected.items():
            with self.subTest(purpose=purpose):
                outputs = process_image(source(), purpose, "image/png")
                self.assertEqual([(o.name, o.width, o.height) for o in outputs], sizes)
                for output in outputs:
                    with Image.open(BytesIO(output.data)) as decoded:
                        self.assertEqual(decoded.format, "WEBP")
                        self.assertEqual(decoded.size, (output.width, output.height))
                        self.assertFalse(decoded.getexif())

    def test_small_sources_never_upscale_and_alpha_is_preserved(self):
        outputs = process_image(source((40, 20), "RGBA"), "post", "image/png")
        self.assertTrue(all((o.width, o.height) == (40, 20) for o in outputs))
        with Image.open(BytesIO(outputs[-1].data)) as decoded:
            self.assertIn("A", decoded.getbands())
            self.assertEqual(decoded.getpixel((0, 0))[3], 128)

    def test_exif_orientation_and_metadata_stripping(self):
        image = Image.new("RGB", (120, 80))
        exif = Image.Exif()
        exif[274] = 6
        exif[270] = "Private source description"
        buffer = BytesIO()
        image.save(buffer, "JPEG", exif=exif)
        output = process_image(buffer.getvalue(), "post", "image/jpeg")[-1]
        self.assertEqual((output.width, output.height), (80, 120))
        with Image.open(BytesIO(output.data)) as decoded:
            self.assertFalse(decoded.getexif())

    def test_invalid_type_corruption_animation_and_pixel_limit(self):
        for data, mime in [(b"not an image", "image/png"), (source(), "image/jpeg")]:
            with self.assertRaises(ValueError):
                process_image(data, "post", mime)
        with patch("image_processing.MAX_SOURCE_PIXELS", 10), self.assertRaises(ValueError):
            process_image(source((20, 20)), "post", "image/png")
        buffer = BytesIO()
        Image.new("RGB", (10, 10), "red").save(buffer, "WEBP", save_all=True,
            append_images=[Image.new("RGB", (10, 10), "blue")], duration=100, loop=0)
        with self.assertRaises(ValueError):
            process_image(buffer.getvalue(), "post", "image/webp")


class ProcessingWorkerTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.work = Work(uuid4(), uuid4(), uuid4(), "owner/source.png", "post", "image/png", 10)
        self.sessions = MagicMock()
        self.db = self.sessions.return_value.__enter__.return_value
        self.upload = ImageUpload(id=self.work.id, owner_id=self.work.owner, purpose="post",
            object_key=self.work.key, processing_claim=self.work.claim,
            processing_lease_until=self.now + timedelta(minutes=10), processing_attempts=1,
            created_at=self.now, processing_status="processing")
        self.db.scalar.return_value = self.upload

    def test_ready_variants_audit_and_source_grace_commit_together(self):
        outputs = [(output, f"owner/{output.name}.webp") for output in process_image(source(), "post", "image/png")]
        self.assertTrue(finish_work(self.sessions, Settings(), self.work, outputs, verdict(), None))
        self.assertEqual(self.upload.processing_status, "ready")
        self.assertGreaterEqual(self.upload.original_cleanup_after,
                                self.upload.created_at + timedelta(seconds=SOURCE_GRACE_SECONDS))
        self.assertEqual(sum(isinstance(call.args[0], ImageVariant) for call in self.db.add.call_args_list), 2)
        self.db.commit.assert_called_once()

    def test_flag_blocks_asset_and_provider_failure_never_marks_ready(self):
        outputs = [(output, f"owner/{output.name}.webp") for output in process_image(source(), "post", "image/png")]
        finish_work(self.sessions, Settings(), self.work, outputs, verdict(True), None)
        self.assertEqual(self.upload.processing_status, "blocked")
        self.upload.processing_claim = self.work.claim
        self.upload.processing_lease_until = self.now + timedelta(minutes=10)
        self.db.reset_mock()
        finish_work(self.sessions, Settings(), self.work, [], None, "provider_connection")
        self.assertEqual(self.upload.processing_status, "pending")
        self.db.add.assert_not_called()
        self.upload.processing_claim = self.work.claim
        self.upload.processing_lease_until = self.now + timedelta(minutes=10)
        self.upload.processing_attempts = 3
        finish_work(self.sessions, Settings(), self.work, [], None, "provider_connection")
        self.assertEqual(self.upload.processing_status, "failed")

    def test_expired_or_replaced_claim_cannot_publish(self):
        for claim, lease in [(uuid4(), self.now + timedelta(minutes=10)), (self.work.claim, self.now - timedelta(seconds=1))]:
            self.upload.processing_claim, self.upload.processing_lease_until = claim, lease
            self.assertFalse(finish_work(self.sessions, Settings(), self.work, [], verdict(), None))
        self.db.commit.assert_not_called()

    def test_profile_activation_checks_latest_pending_selection(self):
        self.upload.purpose = "avatar"
        profile = Profile(id=self.work.owner, pending_profile_image_upload_id=self.work.id)
        self.db.scalar.side_effect = [self.upload, profile]
        outputs = [(o, f"owner/{o.name}.webp") for o in process_image(source(), "avatar", "image/png")]
        finish_work(self.sessions, Settings(), self.work, outputs, verdict(), None)
        self.assertEqual(profile.profile_image_upload_id, self.work.id)
        self.assertIsNone(profile.pending_profile_image_upload_id)
        self.assertIn("pending_profile_image_upload_id", str(self.db.scalar.call_args.args[0]))

    def test_failed_or_partial_storage_does_not_publish(self):
        data = source()
        work = Work(self.work.id, self.work.owner, self.work.claim, self.work.key, "post", "image/png", len(data))
        with (patch("image_processing_worker.claim_work", return_value=work),
              patch("image_processing_worker.read_image", return_value=data),
              patch("image_processing_worker.moderate_content", return_value=verdict()),
              patch("image_processing_worker.write_image", side_effect=[None, ModerationError("failed", code="storage_write")]),
              patch("image_processing_worker.finish_work") as finish,
              patch("image_processing_worker.remove_images") as remove):
            run_once(settings=Settings())
            self.assertEqual(finish.call_args.args[5], "storage_write")
            self.assertEqual(len(remove.call_args.args[0]), 2)

    def test_source_cleanup_uses_storage_api_and_retries(self):
        with patch("image_processing_worker.remove_images") as remove:
            self.assertTrue(cleanup_original_once(self.sessions))
            remove.assert_called_once_with([self.upload.object_key])
            self.assertIsNotNone(self.upload.original_deleted_at)
            query = str(self.db.scalar.call_args.args[0])
            self.assertIn("original_cleanup_after <=", query)
            self.assertIn("processing_status IN", query)
        self.upload.original_deleted_at = None
        with patch("image_processing_worker.remove_images", side_effect=ModerationError("offline", code="storage_delete")):
            cleanup_original_once(self.sessions)
        self.assertIsNone(self.upload.original_deleted_at)
        self.assertEqual(self.upload.original_cleanup_error, "storage_delete")

    def test_crash_consumes_budget_and_data_url_needs_no_external_fetch(self):
        self.upload.processing_attempts = 3
        self.assertIsNone(claim_work(self.sessions, Settings(), self.now))
        self.assertEqual(self.upload.processing_status, "failed")
        self.assertEqual(image_data_url(b"abc"), "data:image/webp;base64,YWJj")


if __name__ == "__main__":
    unittest.main()
