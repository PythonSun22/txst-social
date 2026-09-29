"""FR-05/FR-06/FR-11: profile reads, options, edits, and image ownership."""

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock
from uuid import UUID, uuid4

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"

from fastapi.testclient import TestClient

from auth import get_current_profile, require_verified_profile
from database import get_db
from main import app
from models import College, ImageUpload, Major, Profile, Space

USER_ID = UUID("11111111-1111-4111-8111-111111111111")


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.profile = Profile(
            id=USER_ID,
            username="bobcat",
            email="bobcat@txstate.edu",
            email_verified_at=datetime.now(timezone.utc),
            post_karma=0,
            comment_karma=0,
        )
        self.db = Mock()
        self.db.execute.return_value.one.return_value = (0, 0)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_profile] = lambda: self.profile
        app.dependency_overrides[require_verified_profile] = lambda: self.profile
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_current_profile_resolves_home_college(self):
        college_id = uuid4()
        self.profile.home_college_id = college_id
        self.profile.student_level = "junior"
        space = Space(
            id=college_id,
            kind="college",
            slug="science_engineering",
            name="College of Science and Engineering",
        )
        college = College(
            space_id=college_id,
            short_name="Science and Engineering",
            accent_hex="#501214",
            crest_key="science-engineering.png",
        )
        self.db.execute.return_value.one_or_none.return_value = (space, college)
        self.db.execute.return_value.one.return_value = (3, 2)

        response = self.client.get("/auth/me")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["home_college"], {
            "id": str(college_id),
            "name": "College of Science and Engineering",
            "short_name": "Science and Engineering",
            "slug": "science_engineering",
            "accent_hex": "#501214",
            "crest_key": "science-engineering.png",
        })
        self.assertEqual(response.json()["student_level"], "junior")
        self.assertEqual(response.json()["followed_space_count"], 3)
        self.assertEqual(response.json()["joined_community_count"], 2)

    def test_profile_options_are_normalized_database_values(self):
        college_id, major_id = uuid4(), uuid4()
        space = Space(
            id=college_id, kind="college", slug="science_engineering", name="Science"
        )
        college = College(space_id=college_id, short_name="Science", sort_order=1)
        major = Major(
            id=major_id,
            name="Computer Science",
            degree="B.S.",
            college_id=college_id,
            sort_order=1,
            active=True,
        )
        self.db.execute.return_value.all.return_value = [(space, college)]
        self.db.scalars.return_value.all.return_value = [major]

        response = self.client.get("/profile/options")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["majors"], [{
            "id": str(major_id),
            "name": "Computer Science",
            "degree": "B.S.",
            "college_id": str(college_id),
        }])
        self.assertEqual(response.json()["colleges"][0]["id"], str(college_id))
        self.assertEqual(response.json()["student_levels"][0], "freshman")

    def test_profile_update_accepts_catalog_major_and_owned_images(self):
        major_id, upload_id, college_id = uuid4(), uuid4(), uuid4()
        self.profile.home_college_id = college_id
        major = Major(
            id=major_id,
            name="Interior Design",
            degree="B.S.F.C.S.",
            college_id=college_id,
            active=True,
        )
        upload = ImageUpload(
            id=upload_id,
            owner_id=USER_ID,
            bucket_id="post-images",
            object_key="key",
            original_name="profile.webp",
            content_type="image/webp",
            size_bytes=10,
            width=100,
            height=100,
            uploaded_at=datetime.now(timezone.utc),
        )
        self.db.get.side_effect = lambda model, _: major if model is Major else upload
        self.db.execute.return_value.one_or_none.return_value = None

        response = self.client.patch("/auth/me", json={
            "display_name": "  Bobby  ",
            "bio": "  Bobcat studying design.  ",
            "major_id": str(major_id),
            "student_level": "senior",
            "profile_image_upload_id": str(upload_id),
            "banner_image_upload_id": str(upload_id),
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["display_name"], "Bobby")
        self.assertEqual(response.json()["bio"], "Bobcat studying design.")
        self.assertEqual(response.json()["major"], "Interior Design")
        self.assertEqual(response.json()["profile_image_upload_id"], str(upload_id))
        self.assertEqual(response.json()["banner_image_upload_id"], str(upload_id))
        self.db.commit.assert_called_once()

    def test_profile_update_rejects_major_from_another_college(self):
        major_id, selected_college_id = uuid4(), uuid4()
        self.profile.home_college_id = selected_college_id
        self.db.get.return_value = Major(
            id=major_id,
            name="Computer Science",
            degree="B.S.",
            college_id=uuid4(),
            active=True,
        )

        response = self.client.patch("/auth/me", json={"major_id": str(major_id)})

        self.assertEqual(response.status_code, 422)
        self.assertIn("selected college", response.json()["detail"])
        self.db.commit.assert_not_called()

    def test_profile_update_rejects_unowned_image(self):
        upload_id = uuid4()
        self.db.get.return_value = ImageUpload(
            id=upload_id,
            owner_id=uuid4(),
            bucket_id="post-images",
            object_key="key",
            original_name="other.webp",
            content_type="image/webp",
            size_bytes=10,
            width=100,
            height=100,
            uploaded_at=datetime.now(timezone.utc),
        )

        response = self.client.patch(
            "/auth/me", json={"profile_image_upload_id": str(upload_id)}
        )

        self.assertEqual(response.status_code, 422)
        self.db.commit.assert_not_called()

    def test_cors_allows_profile_patch(self):
        response = self.client.options("/auth/me", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "authorization,content-type",
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("PATCH", response.headers["access-control-allow-methods"])


if __name__ == "__main__":
    unittest.main()
