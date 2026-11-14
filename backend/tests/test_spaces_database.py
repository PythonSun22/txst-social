"""Spaces persistence and migration checks on a disposable local database."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from unittest.mock import patch

from fastapi import HTTPException, Response
from sqlalchemy import func, select, text
from sqlalchemy.exc import ProgrammingError

from models import Follow, Post, Profile, Space
from profiles.routes import current_profile_response
from spaces.routes import change_follow, get_space, profile_spaces
from test_moderation_database import ImageDatabaseFixture
from test_moderation_worker import verdict
from moderation.worker import run_once


class SpaceDatabaseTests(ImageDatabaseFixture):
    def test_starter_spaces_are_seeded_without_fake_accounts(self):
        with self.sessions() as db:
            seeded = db.scalars(select(Space).where(Space.is_seeded.is_(True))).all()
            self.assertEqual({s.name for s in seeded}, {"Study Groups", "Campus Events", "Gaming", "Art",
                "San Marcos Life", "Technology", "Cooking", "Sports", "Music", "Pets"})
            self.assertTrue(all(s.created_by is None and s.kind == "community" for s in seeded))

    def test_follow_is_persistent_idempotent_and_visible_on_profile(self):
        for _ in range(2):
            with self.sessions() as db:
                result = change_follow("gaming", True, db.get(Profile, self.owner), Response(), db)
                self.assertEqual((result.following, result.follower_count), (True, 1))
        with self.sessions() as db:
            self.assertEqual([s.slug for s in profile_spaces(self.owner, Response(), None, db)], ["gaming"])
            profile = current_profile_response(db, db.get(Profile, self.owner))
            self.assertEqual((profile.followed_space_count, profile.joined_community_count), (1, 1))
        for _ in range(2):
            with self.sessions() as db:
                result = change_follow("gaming", False, db.get(Profile, self.owner), Response(), db)
                self.assertEqual((result.following, result.follower_count), (False, 0))

    def test_follow_changes_do_not_change_another_students_membership(self):
        other = uuid4()
        with self.sessions.begin() as db:
            db.execute(text("insert into auth.users values (:id, :email, now())"),
                       {"id": other, "email": f"u{other.hex[:12]}@txstate.edu"})
        try:
            with self.sessions() as db:
                change_follow("gaming", True, db.get(Profile, self.owner), Response(), db)
                change_follow("gaming", False, db.get(Profile, other), Response(), db)
            with self.sessions() as db:
                self.assertEqual(len(profile_spaces(self.owner, Response(), None, db)), 1)
                self.assertEqual(profile_spaces(other, Response(), None, db), [])
                self.assertEqual(get_space("gaming", Response(), None, db).follower_count, 1)
        finally:
            with self.sessions.begin() as db:
                db.execute(text("delete from auth.users where id=:id"), {"id": other})

    def test_concurrent_duplicate_follows_count_once(self):
        def follow(_):
            with self.sessions() as db:
                return change_follow("gaming", True, db.get(Profile, self.owner), Response(), db).follower_count
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(list(pool.map(follow, range(2))), [1, 1])
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Follow).where(Follow.user_id == self.owner)), 1)

    def test_browser_cannot_bypass_api_follow_gate(self):
        with self.sessions.begin() as db:
            db.execute(text("set local role authenticated"))
            with self.assertRaises(ProgrammingError) as caught:
                db.execute(text("insert into public.follows (user_id, space_id) select :id, id from public.spaces where slug='gaming'"), {"id": self.owner})
            self.assertEqual(caught.exception.orig.sqlstate, "42501")
            db.rollback()

    def test_general_is_not_followable(self):
        with self.sessions() as db:
            with self.assertRaises(HTTPException) as caught:
                change_follow("general", True, db.get(Profile, self.owner), Response(), db)
            self.assertEqual(caught.exception.status_code, 404)

    def test_community_posts_are_screened_and_published(self):
        identity = self.post()
        with self.sessions.begin() as db:
            db.get(Post, identity).space_id = db.scalar(select(Space.id).where(Space.slug == "gaming"))
        with patch("moderation.worker.moderate_content", return_value=verdict()):
            self.assertTrue(run_once(self.sessions))
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "approved")
