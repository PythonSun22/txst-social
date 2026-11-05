"""FR-24/70–73: space visibility, account gates and caller-owned follows."""
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock
from uuid import uuid4

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"
os.environ["MODERATION_ENABLED"] = "false"
os.environ["IMAGE_PROCESSING_ENABLED"] = "false"

from fastapi import Response
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
from auth import get_current_profile
from database import get_db
from main import app
from models import Profile, Space
from spaces.routes import available_spaces, serialize_spaces


class SpaceTests(unittest.TestCase):
    def setUp(self):
        self.profile = Profile(id=uuid4(), username="student", email="student@txstate.edu",
                               email_verified_at=datetime.now(timezone.utc))
        self.space = Space(id=uuid4(), slug="gaming", name="Gaming", kind="community",
                           description="Games", rules="", follower_count=1)
        self.db = Mock()
        self.db.scalar.return_value = self.space
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_profile] = lambda: self.profile
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_directory_excludes_general_and_deleted_spaces(self):
        sql = str(available_spaces().compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        self.assertIn("deleted_at IS NULL", sql)
        self.assertIn("'college', 'community'", sql)
        self.assertNotIn("'campus'", sql)

    def test_search_filters_kind_and_matches_only_space_names_and_slugs(self):
        self.db.scalars.return_value.all.return_value = []
        response = self.client.get("/spaces", params={"q": "  gaming  ", "kind": "community"})
        self.assertEqual(response.status_code, 200)
        query = self.db.scalars.call_args.args[0]
        sql = str(query.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        for clause in ("spaces.deleted_at IS NULL", "spaces.kind = 'community'", "spaces.name ILIKE",
                       "spaces.slug ILIKE", "%gaming%", "LIMIT 25"):
            self.assertIn(clause, sql)
        self.assertNotIn("spaces.description ILIKE", sql)

    def test_search_escapes_wildcards_and_rejects_invalid_filters(self):
        self.db.scalars.return_value.all.return_value = []
        self.assertEqual(self.client.get("/spaces", params={"q": "50%_off", "kind": "college"}).status_code, 200)
        params = self.db.scalars.call_args.args[0].compile().params
        self.assertIn(r"%50\%\_off%", params.values())
        self.assertEqual(self.client.get("/spaces", params={"kind": "students"}).status_code, 422)
        self.assertEqual(self.client.get("/spaces", params={"q": "x" * 51}).status_code, 422)

    def test_blank_search_does_not_return_the_whole_directory(self):
        self.assertEqual(self.client.get("/spaces", params={"q": "  "}).json(), [])
        self.db.scalars.assert_not_called()

    def test_follow_state_is_viewer_specific(self):
        self.db.scalars.return_value.all.return_value = [self.space.id]
        self.assertTrue(serialize_spaces(self.db, [self.space], self.profile)[0].is_following)
        self.assertFalse(serialize_spaces(self.db, [self.space], None)[0].is_following)

    def test_follow_uses_authenticated_identity_and_refreshes_count(self):
        response = self.client.put("/spaces/gaming/follow", json={"user_id": str(uuid4())})
        self.assertEqual(response.status_code, 200)
        params = self.db.execute.call_args.args[0].compile().params
        self.assertEqual(params["user_id"], self.profile.id)
        self.assertEqual(params["space_id"], self.space.id)
        self.db.commit.assert_called_once()
        self.db.refresh.assert_called_once_with(self.space)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_unverified_student_cannot_follow(self):
        self.profile.email_verified_at = None
        self.assertEqual(self.client.put("/spaces/gaming/follow").status_code, 403)
        self.db.execute.assert_not_called()

    def test_unknown_space_returns_404(self):
        self.db.scalar.return_value = None
        self.assertEqual(self.client.put("/spaces/not-real/follow").status_code, 404)
        self.db.commit.assert_not_called()

    def test_deleted_profile_cannot_expose_joined_spaces(self):
        self.profile.deleted_at = datetime.now(timezone.utc)
        self.db.get.return_value = self.profile
        self.assertEqual(self.client.get(f"/profiles/{self.profile.id}/spaces").status_code, 404)
