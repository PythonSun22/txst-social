"""FR-32/90: owner notices and retry eligibility agree about retained inputs."""
from types import SimpleNamespace
import unittest

from images.lifecycle import can_retry_image, image_processing_state


class ImageLifecycleTests(unittest.TestCase):
    def upload(self, **values):
        return SimpleNamespace(**{
            "processing_status": "failed", "processing_error": "provider_connection",
            "recovery_required": True, "uploaded_at": object(),
            "original_deleted_at": None, "deleted_at": None, **values,
        })

    def test_only_failed_recoverable_saved_inputs_offer_retry(self):
        upload = self.upload()
        self.assertTrue(can_retry_image(upload))
        self.assertEqual(image_processing_state(upload)[0], "service_unavailable")
        for changes in ({"uploaded_at": None}, {"original_deleted_at": object()},
                        {"deleted_at": object()}, {"recovery_required": False},
                        {"processing_status": "blocked"}, {"processing_status": "ready"},
                        {"processing_status": "pending"}, {"processing_status": "processing"}):
            with self.subTest(changes=changes):
                self.assertFalse(can_retry_image(self.upload(**changes)))

    def test_invalid_input_is_not_described_as_a_service_outage(self):
        upload = self.upload(processing_error="invalid_image", recovery_required=False)
        state, message = image_processing_state(upload)
        self.assertEqual(state, "failed")
        self.assertNotIn("preserved for retry", message)

    def test_missing_input_is_not_described_as_recoverable(self):
        for changes in ({"uploaded_at": None}, {"original_deleted_at": object()}):
            with self.subTest(changes=changes):
                self.assertEqual(image_processing_state(self.upload(**changes))[0], "failed")
