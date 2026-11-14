"""FR-05/FR-06/FR-11: profile reads, options, edits, and image ownership."""

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"
os.environ["IMAGE_PROCESSING_ENABLED"] = "false"

from fastapi.testclient import TestClient

from auth import get_current_profile, require_verified_profile
from database import get_db
from main import app
from models import College, ImageUpload, Major, Profile, Space

USER_ID = UUID("11111111-1111-4111-8111-111111111111")


class ProfileTests(unittest.TestCase):
    def test_student_search_keeps_active_account_filters_and_literal_wildcards(self):
        self.db.scalars.return_value.all.return_value = []
        response = self.client.get("/profiles/search", params={"q": "50%_off"})
        self.assertEqual(response.status_code, 200)
        from sqlalchemy.dialects import postgresql
        query = self.db.scalars.call_args.args[0]
        sql = str(query.compile(dialect=postgresql.dialect()))
        self.assertIn("profiles.deleted_at IS NULL", sql)
        self.assertIn("profiles.suspended_at IS NULL", sql)
        self.assertIn(r"%50\%\_off%", query.compile().params.values())

    def test_public_profile_exposes_shared_display_fields_without_private_state(self):
        avatar_id, banner_id = uuid4(), uuid4()
        self.profile.profile_image_upload_id = avatar_id
        self.profile.banner_image_upload_id = banner_id
        self.profile.pending_profile_image_upload_id = uuid4()
        self.db.scalar.side_effect = [True, self.profile, 2, 3]
        self.db.execute.return_value.one.return_value = (4, 3)

        response = self.client.get(f"/profiles/{USER_ID}")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["profile_image_upload_id"], str(avatar_id))
        self.assertEqual(data["banner_image_upload_id"], str(banner_id))
        self.assertEqual((data["followed_space_count"], data["joined_community_count"]), (4, 3))
        self.assertEqual((data["follower_count"], data["following_count"]), (2, 3))
        for private in ("email", "email_verified", "email_verified_at", "pending_profile_image_upload_id",
                        "pending_banner_image_upload_id", "profile_image_status", "banner_image_status",
                        "username_chosen", "academic_setup_completed", "academic_setup_completed_at"):
            self.assertNotIn(private, data)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_public_profile_does_not_render_an_unavailable_student(self):
        self.db.scalar.side_effect = [True, None]
        self.assertEqual(self.client.get(f"/profiles/{USER_ID}").status_code, 404)

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
        self.assertFalse(response.json()["username_chosen"])
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
        banner_id = uuid4()
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
        upload.purpose = "avatar"
        upload.processing_status = "ready"
        banner = ImageUpload(id=banner_id, owner_id=USER_ID, purpose="banner", processing_status="ready", uploaded_at=datetime.now(timezone.utc))
        self.db.get.side_effect = lambda model, key: major if model is Major else banner if key == banner_id else upload
        self.db.execute.return_value.one_or_none.return_value = None

        response = self.client.patch("/auth/me", json={
            "display_name": "  Bobby  ",
            "bio": "  Bobcat studying design.  ",
            "major_id": str(major_id),
            "student_level": "senior",
            "profile_image_upload_id": str(upload_id),
            "banner_image_upload_id": str(banner_id),
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["display_name"], "Bobby")
        self.assertEqual(response.json()["bio"], "Bobcat studying design.")
        self.assertEqual(response.json()["major"], "Interior Design")
        self.assertEqual(response.json()["profile_image_upload_id"], str(upload_id))
        self.assertEqual(response.json()["banner_image_upload_id"], str(banner_id))
        self.db.commit.assert_called_once()

    def test_first_username_choice_sets_permanent_handle(self):
        response = self.client.post("/auth/me/username", json={"username": "  New_Bobcat  "})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "new_bobcat")
        self.assertTrue(response.json()["username_chosen"])
        self.assertIsNotNone(self.profile.username_chosen_at)
        self.assertFalse(response.json()["academic_setup_completed"])

    def academic_choices(self):
        college_id, major_id = uuid4(), uuid4()
        space = Space(id=college_id, kind="college", slug="science_engineering", name="Science")
        college = College(space_id=college_id, short_name="Science")
        self.db.execute.return_value.one_or_none.return_value = (space, college)
        self.db.execute.return_value.scalar_one_or_none.return_value = college_id
        self.db.get.return_value = Major(id=major_id, college_id=college_id, name="Computer Science", degree="B.S.", active=True)
        self.profile.username_chosen_at = datetime.now(timezone.utc)
        return {"home_college_id": str(college_id), "major_id": str(major_id), "student_level": "sophomore"}

    def test_academic_setup_saves_profile_and_follows_its_college(self):
        payload = self.academic_choices()
        response = self.client.post("/auth/me/academics", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["home_college_id"], payload["home_college_id"])
        self.assertEqual(data["major_id"], payload["major_id"])
        self.assertEqual(data["major"], "Computer Science")
        self.assertEqual(data["student_level"], "sophomore")
        self.assertTrue(data["academic_setup_completed"])
        self.assertIsNotNone(self.profile.academic_setup_completed_at)
        insert = next(call.args[0] for call in self.db.execute.call_args_list if getattr(call.args[0], "is_insert", False))
        self.assertEqual(insert.table.name, "follows")
        self.assertEqual(insert.compile().params["user_id"], USER_ID)
        self.assertEqual(insert.compile().params["space_id"], UUID(payload["home_college_id"]))
        self.db.commit.assert_called_once()

    def test_academic_setup_requires_username_and_verified_email(self):
        payload = self.academic_choices()
        self.profile.username_chosen_at = None
        self.assertEqual(self.client.post("/auth/me/academics", json=payload).status_code, 409)
        self.profile.email_verified_at = None
        app.dependency_overrides.pop(require_verified_profile)
        self.assertEqual(self.client.post("/auth/me/academics", json=payload).status_code, 403)
        self.db.commit.assert_not_called()

    def test_academic_setup_requires_valid_academic_selections(self):
        payload = self.academic_choices()
        for incomplete in ({}, *({key: value for key, value in payload.items() if key != missing} for missing in payload)):
            self.assertEqual(self.client.post("/auth/me/academics", json=incomplete).status_code, 422)
        for invalid in (None, "", "second year"):
            self.assertEqual(self.client.post("/auth/me/academics", json={**payload, "student_level": invalid}).status_code, 422)
        self.db.execute.return_value.scalar_one_or_none.return_value = None
        self.assertEqual(self.client.post("/auth/me/academics", json=payload).status_code, 422)
        self.db.execute.return_value.scalar_one_or_none.return_value = UUID(payload["home_college_id"])
        for major in (None, Major(active=False), Major(active=True, college_id=uuid4())):
            self.db.get.return_value = major
            self.assertEqual(self.client.post("/auth/me/academics", json=payload).status_code, 422)
        self.assertIsNone(self.profile.academic_setup_completed_at)
        self.assertIsNone(self.profile.home_college_id)
        self.db.commit.assert_not_called()

    def test_repeated_setup_does_not_rejoin_or_change_completed_profile(self):
        payload = self.academic_choices()
        self.profile.home_college_id = UUID(payload["home_college_id"])
        self.profile.major_id = UUID(payload["major_id"])
        self.profile.student_level = payload["student_level"]
        self.profile.academic_setup_completed_at = datetime.now(timezone.utc)
        self.assertEqual(self.client.post("/auth/me/academics", json=payload).status_code, 200)
        changed = {**payload, "home_college_id": str(uuid4())}
        self.assertEqual(self.client.post("/auth/me/academics", json=changed).status_code, 409)
        self.assertEqual(self.client.post("/auth/me/academics", json={**payload, "student_level": "junior"}).status_code, 409)
        self.assertFalse(any(getattr(call.args[0], "is_insert", False) for call in self.db.execute.call_args_list))
        self.db.commit.assert_not_called()

    def test_academics_remain_editable_without_resetting_completed_setup(self):
        payload = self.academic_choices()
        completed = datetime.now(timezone.utc)
        self.profile.academic_setup_completed_at = completed
        response = self.client.patch("/auth/me", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["major_id"], payload["major_id"])
        self.assertEqual(response.json()["student_level"], "sophomore")
        self.assertTrue(response.json()["academic_setup_completed"])
        self.assertEqual(self.profile.academic_setup_completed_at, completed)
        self.assertEqual(self.client.patch("/auth/me", json={"academic_setup_completed_at": None}).status_code, 422)

    def test_blank_username_cannot_complete_choice(self):
        self.profile.username = "lynx_123456789abcdef"

        for username in (None, "", "  "):
            with self.subTest(username=username):
                response = self.client.post("/auth/me/username", json={"username": username})
                self.assertEqual(response.status_code, 422)
        self.assertEqual(self.profile.username, "lynx_123456789abcdef")
        self.db.commit.assert_not_called()

    def test_second_username_choice_is_rejected(self):
        self.profile.username_chosen_at = datetime.now(timezone.utc)

        response = self.client.post("/auth/me/username", json={"username": "another_bobcat"})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.profile.username, "bobcat")
        self.db.commit.assert_not_called()

    def test_username_is_not_editable_through_profile_patch(self):
        response = self.client.patch("/auth/me", json={"username": "another_bobcat"})

        self.assertEqual(response.status_code, 422)
        self.db.commit.assert_not_called()

    def test_other_profile_edits_work_after_username_choice(self):
        self.profile.username_chosen_at = datetime.now(timezone.utc)

        response = self.client.patch("/auth/me", json={
            "display_name": "Bobcat Student",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["display_name"], "Bobcat Student")
        self.assertEqual(self.profile.username, "bobcat")

    def test_invalid_username_is_rejected(self):
        for username in ("ab", "bad-name", "a" * 21):
            with self.subTest(username=username):
                response = self.client.post("/auth/me/username", json={"username": username})
                self.assertEqual(response.status_code, 422)
        self.db.commit.assert_not_called()

    def test_taken_username_is_reported(self):
        original = Mock()
        original.diag.constraint_name = "profiles_username_key"
        self.db.commit.side_effect = IntegrityError("update", {}, original)

        response = self.client.post("/auth/me/username", json={"username": "taken"})

        self.assertEqual(response.status_code, 409)
        self.assertIn("already taken", response.json()["detail"])
        self.db.rollback.assert_called_once()

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

    def test_processing_avatar_is_pending_and_keeps_current_photo(self):
        old_id, new_id = uuid4(), uuid4()
        self.profile.profile_image_upload_id = old_id
        self.db.get.return_value = ImageUpload(id=new_id, owner_id=USER_ID, purpose="avatar",
            processing_status="processing", uploaded_at=datetime.now(timezone.utc))
        response = self.client.patch("/auth/me", json={"profile_image_upload_id": str(new_id)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile_image_upload_id"], str(old_id))
        self.assertEqual(response.json()["pending_profile_image_upload_id"], str(new_id))
        self.assertEqual(response.json()["profile_image_status"], "processing")

    def test_banner_cannot_use_avatar_or_rejected_asset(self):
        old_id, new_id = uuid4(), uuid4()
        self.profile.banner_image_upload_id = old_id
        for purpose, state in [("avatar", "ready"), ("banner", "blocked"), ("banner", "failed")]:
            self.db.get.return_value = ImageUpload(id=new_id, owner_id=USER_ID, purpose=purpose,
                processing_status=state, uploaded_at=datetime.now(timezone.utc))
            response = self.client.patch("/auth/me", json={"banner_image_upload_id": str(new_id)})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(self.profile.banner_image_upload_id, old_id)
        self.db.commit.assert_not_called()

    def test_removing_image_cancels_pending_replacement(self):
        self.profile.profile_image_upload_id = uuid4()
        self.profile.pending_profile_image_upload_id = uuid4()
        response = self.client.patch("/auth/me", json={"profile_image_upload_id": None})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["profile_image_upload_id"])
        self.assertIsNone(response.json()["pending_profile_image_upload_id"])


if __name__ == "__main__":
    unittest.main()
