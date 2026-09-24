"""FR-02/FR-32/FR-90: upload authorization, limits and completion without live services."""

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from uuid import UUID, uuid4

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"

import httpx
from fastapi.testclient import TestClient

from database import get_db
from image_schemas import MAX_IMAGE_BYTES
from main import app
from models import ImageUpload, Profile

USER_ID = UUID("11111111-1111-4111-8111-111111111111")
HEADERS = {"Authorization": "Bearer test-token"}
PAYLOAD = {"original_name": "lake.png", "content_type": "image/png", "size_bytes": 1234, "width": 1200, "height": 800}


class ImageTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "public-key",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.profile = Profile(id=USER_ID, username="bobcat", email="bobcat@txstate.edu",
                               email_verified_at=datetime.now(timezone.utc))
        self.upload = ImageUpload(
            id=uuid4(), owner_id=USER_ID, bucket_id="post-images", object_key=f"{USER_ID}/image.png",
            created_at=datetime.now(timezone.utc), **PAYLOAD,
        )
        self.db = Mock()
        self.db.get.side_effect = lambda model, key: self.profile if model is Profile else self.upload
        self.db.refresh.side_effect = lambda row: setattr(row, "created_at", datetime.now(timezone.utc))
        self.db.scalars.return_value.all.return_value = [self.upload]
        app.dependency_overrides[get_db] = lambda: self.db
        self.addCleanup(app.dependency_overrides.clear)
        self.auth_patch = patch("auth.httpx.get", return_value=httpx.Response(200, json={
            "id": str(USER_ID), "email": "bobcat@txstate.edu",
        }))
        self.auth_patch.start()
        self.addCleanup(self.auth_patch.stop)
        self.storage_patch = patch("image_storage.httpx.request")
        self.storage = self.storage_patch.start()
        self.addCleanup(self.storage_patch.stop)
        self.storage.return_value = httpx.Response(200, json={"url": "/object/upload/sign/post-images/file?token=upload-token"})
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_fr02_auth_and_verification_required_before_reservation(self):
        self.assertEqual(self.client.post("/images", json=PAYLOAD).status_code, 401)
        self.profile.email_verified_at = None
        self.assertEqual(self.client.post("/images", json=PAYLOAD, headers=HEADERS).status_code, 403)
        self.db.add.assert_not_called()
        self.storage.assert_not_called()

    def test_fr32_policy_and_inclusive_size_boundary(self):
        policy = self.client.get("/images/policy").json()
        self.assertEqual(policy["max_bytes"], MAX_IMAGE_BYTES)
        response = self.client.post("/images", json={**PAYLOAD, "size_bytes": MAX_IMAGE_BYTES}, headers=HEADERS)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["upload"]["size_bytes"], MAX_IMAGE_BYTES)

    def test_invalid_files_and_forged_ownership_never_reach_storage(self):
        for fields in ({"size_bytes": 0}, {"size_bytes": MAX_IMAGE_BYTES + 1}, {"size_bytes": True},
                       {"width": 0}, {"height": -1}, {"content_type": "image/svg+xml"},
                       {"original_name": " "}, {"owner_id": str(uuid4())}, {"object_key": "another-user/image.png"}):
            with self.subTest(fields=fields):
                response = self.client.post("/images", json={**PAYLOAD, **fields}, headers=HEADERS)
                self.assertEqual(response.status_code, 422)
        self.db.add.assert_not_called()
        self.storage.assert_not_called()

    def test_fr32_reservation_generates_key_and_signs_with_user_token(self):
        response = self.client.post("/images", json={**PAYLOAD, "original_name": "../../lake.png"}, headers=HEADERS)
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["token"], "upload-token")
        self.assertEqual(body["upload"]["object_key"], f"{USER_ID}/{body['upload']['id']}.png")
        self.assertIsNone(body["upload"]["uploaded_at"])
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.db.commit.assert_called_once()
        args, kwargs = self.storage.call_args
        self.assertEqual(args[0], "POST")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-token")
        self.assertNotIn("x-upsert", kwargs["headers"])

    def test_other_owner_or_deleted_record_cannot_complete_or_preview(self):
        for owner, deleted in ((uuid4(), None), (USER_ID, datetime.now(timezone.utc))):
            self.upload.owner_id, self.upload.deleted_at = owner, deleted
            self.assertEqual(self.client.post(f"/images/{self.upload.id}/complete", headers=HEADERS).status_code, 404)
            self.assertEqual(self.client.get(f"/images/{self.upload.id}/preview", headers=HEADERS).status_code, 404)
        self.storage.assert_not_called()

    def test_fr90_completion_is_storage_confirmation_not_publication(self):
        self.storage.return_value = httpx.Response(200, json={"size": 1234, "content_type": "image/png"})
        response = self.client.post(f"/images/{self.upload.id}/complete", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.json()["uploaded_at"])
        self.assertNotIn("status", response.json())
        self.db.commit.assert_called_once()
        self.storage.reset_mock()
        retry = self.client.post(f"/images/{self.upload.id}/complete", headers=HEADERS)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json()["uploaded_at"], response.json()["uploaded_at"])
        self.storage.assert_not_called()

    def test_missing_or_mismatched_object_is_not_marked_uploaded(self):
        for data in ({"size": 10, "content_type": "image/png"}, {"size": 1234, "content_type": "text/html"}, {}):
            self.storage.return_value = httpx.Response(200, json=data)
            self.assertEqual(self.client.post(f"/images/{self.upload.id}/complete", headers=HEADERS).status_code, 409)
            self.assertIsNone(self.upload.uploaded_at)
        self.storage.return_value = httpx.Response(404, json={})
        self.assertEqual(self.client.post(f"/images/{self.upload.id}/complete", headers=HEADERS).status_code, 409)
        self.db.commit.assert_not_called()

    def test_storage_failure_does_not_claim_success_or_expose_details(self):
        self.storage.side_effect = httpx.ConnectError("private host details")
        response = self.client.post("/images", json=PAYLOAD, headers=HEADERS)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private host details", response.text)

    def test_private_preview_requires_completed_owned_upload(self):
        self.assertEqual(self.client.get(f"/images/{self.upload.id}/preview", headers=HEADERS).status_code, 409)
        self.upload.uploaded_at = datetime.now(timezone.utc)
        self.storage.return_value = httpx.Response(200, json={"signedURL": "/object/sign/post-images/image.png?token=private"})
        response = self.client.get(f"/images/{self.upload.id}/preview", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["url"].startswith("https://example.supabase.co/storage/v1/object/sign/"))
        self.assertEqual(self.storage.call_args.kwargs["json"], {"expiresIn": 300})
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_list_query_filters_by_owner_completion_and_soft_delete(self):
        self.upload.uploaded_at = datetime.now(timezone.utc)
        response = self.client.get("/images", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        statement = self.db.scalars.call_args.args[0]
        query = statement.compile()
        self.assertIn(USER_ID, query.params.values())
        self.assertIn("image_uploads.owner_id =", str(query))
        self.assertIn("uploaded_at IS NOT NULL", str(query))
        self.assertIn("deleted_at IS NULL", str(query))
        self.assertIn("LIMIT", str(query))

    def test_cors_accepts_post_from_frontend(self):
        response = self.client.options("/images", headers={"Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
