"""FR-01/FR-02/FR-96: exercise the real HTTP auth dependencies without external services."""

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from uuid import UUID

# Tests must never connect to a developer's database.
os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"

import httpx
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from auth import require_verified_profile
from database import get_db
from main import app
from models import Profile

USER_ID = UUID("11111111-1111-4111-8111-111111111111")


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_PUBLISHABLE_KEY": "test-public-key",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.profile = Profile(
            id=USER_ID, username="bobcat", email="bobcat@txstate.edu",
            email_verified_at=datetime.now(timezone.utc), post_karma=0, comment_karma=0,
        )
        self.db = Mock()
        self.db.get.return_value = self.profile
        app.dependency_overrides[get_db] = lambda: self.db
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.auth_request = patch("auth.httpx.get")
        self.remote = self.auth_request.start()
        self.addCleanup(self.auth_request.stop)
        self.remote.return_value = httpx.Response(200, json={
            "id": str(USER_ID), "email": "bobcat@txstate.edu", "is_anonymous": False,
        })

    def get_me(self, **kwargs):
        return self.client.get("/auth/me", headers={"Authorization": "Bearer test-token"}, **kwargs)

    def test_missing_or_wrong_scheme_is_401_without_network(self):
        for headers in ({}, {"Authorization": "Basic abc"}, {"Authorization": "Bearer "}):
            with self.subTest(headers=headers):
                response = self.client.get("/auth/me", headers=headers)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.remote.assert_not_called()
        self.db.get.assert_not_called()

    def test_valid_identity_comes_from_supabase_not_request(self):
        response = self.get_me(params={"author_id": "22222222-2222-4222-8222-222222222222"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], str(USER_ID))
        self.assertTrue(response.json()["email_verified"])
        self.assertNotIn("email", response.json())
        self.assertNotIn("is_admin", response.json())
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.db.get.assert_called_once_with(Profile, USER_ID)
        self.remote.assert_called_once_with(
            "https://example.supabase.co/auth/v1/user",
            headers={"apikey": "test-public-key", "Authorization": "Bearer test-token"},
            timeout=10.0,
        )

    def test_invalid_or_expired_token_is_401(self):
        for status in (401, 403):
            self.remote.return_value = httpx.Response(status, json={"message": "private upstream detail"})
            response = self.get_me()
            self.assertEqual(response.status_code, 401)
            self.assertNotIn("private upstream detail", response.text)
        self.db.get.assert_not_called()

    def test_auth_outage_fails_closed(self):
        self.remote.side_effect = httpx.ConnectError("private host detail")
        self.assertEqual(self.get_me().status_code, 503)
        self.db.get.assert_not_called()

    def test_bad_upstream_responses_are_503(self):
        for response in (
            httpx.Response(500), httpx.Response(429), httpx.Response(200, text="invalid json"),
            httpx.Response(200, json={"id": "not-a-uuid"}), httpx.Response(200, json=[]),
        ):
            with self.subTest(response=response):
                self.remote.return_value = response
                self.assertEqual(self.get_me().status_code, 503)
        self.db.get.assert_not_called()

    def test_missing_configuration_is_503(self):
        with patch.dict(os.environ, {"SUPABASE_URL": ""}):
            self.assertEqual(self.get_me().status_code, 503)
        self.remote.assert_not_called()

    def test_fr01_rejects_non_campus_and_anonymous_identities(self):
        for extra in ({"email": "bobcat@example.com"}, {"is_anonymous": True}):
            self.remote.return_value = httpx.Response(200, json={
                "id": str(USER_ID), "email": "bobcat@txstate.edu", **extra,
            })
            self.assertEqual(self.get_me().status_code, 403)
        self.db.get.assert_not_called()

    def test_missing_profile_is_rejected_without_creating_one(self):
        self.db.get.return_value = None
        self.assertEqual(self.get_me().status_code, 403)
        self.db.add.assert_not_called()

    def test_fr96_inactive_and_non_campus_profiles_rejected(self):
        for field, value in (("suspended_at", datetime.now(timezone.utc)),
                             ("deleted_at", datetime.now(timezone.utc)),
                             ("email", "bobcat@example.com")):
            with self.subTest(field=field):
                original = getattr(self.profile, field)
                setattr(self.profile, field, value)
                self.assertEqual(self.get_me().status_code, 403)
                setattr(self.profile, field, original)

    def test_fr02_unverified_can_identify_but_cannot_write(self):
        # A test-only endpoint proves the reusable write gate without adding a product route.
        write_app = FastAPI()
        write_app.dependency_overrides[get_db] = lambda: self.db

        @write_app.post("/write")
        def write(profile: Profile = Depends(require_verified_profile)):
            return {"author_id": str(profile.id)}

        with TestClient(write_app) as client:
            headers = {"Authorization": "Bearer test-token"}
            self.assertEqual(client.post("/write", headers=headers).json(), {"author_id": str(USER_ID)})
            self.profile.email_verified_at = None
            response = self.get_me()
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.json()["email_verified"])
            self.assertEqual(client.post("/write", headers=headers).status_code, 403)

    def test_cors_allows_configured_frontend_authorization_header(self):
        headers = {"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET",
                   "Access-Control-Request-Headers": "authorization"}
        response = self.client.options("/auth/me", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3000")
        headers["Origin"] = "https://untrusted.example"
        self.assertEqual(self.client.options("/auth/me", headers=headers).status_code, 400)


if __name__ == "__main__":
    unittest.main()
