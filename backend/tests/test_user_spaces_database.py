"""FR-20/21/24/32: atomic creation and approved icon lifecycle on local Postgres."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException, Response
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError

from images.budget import stage_outputs, write_reserved
from images.cleanup import has_live_reference, retire_unused_once
from images.processing import process_image
from images.routes import abandon_upload, preview_published_profile_image
from images.worker import Settings, claim_work, finish_work
from models import Follow, ImageProcessingCheck, ImageUpload, ImageVariant, Moderator, Profile, Space
from profiles.routes import current_profile_response
from posts.routes import create_post
from posts.schemas import PostCreate
from spaces.routes import change_follow, create_space, get_space, list_spaces, profile_spaces
from spaces.schemas import SpaceCreate
from test_image_processing import source, verdict
from test_moderation_database import ImageDatabaseFixture


class UserSpaceDatabaseTests(ImageDatabaseFixture):
    def tearDown(self):
        with self.sessions.begin() as db:
            db.execute(delete(Space).where(Space.created_by == self.owner))
        super().tearDown()

    def payload(self, **changes):
        return SpaceCreate(name="Chess Club", slug=f"chess_{self.owner.hex[:12]}",
                           description="Play chess with fellow Bobcats.", **changes)

    def create(self, payload=None):
        with self.sessions() as db:
            return create_space(payload or self.payload(), Response(), db.get(Profile, self.owner), db)

    def photo(self, blocked=False):
        identity = uuid4()
        self.uploads.append(identity)
        with self.sessions.begin() as db:
            db.add(ImageUpload(id=identity, owner_id=self.owner, purpose="avatar", upload_method="signed",
                object_key=f"{self.owner}/{identity}.png", original_name="icon.png", content_type="image/png",
                size_bytes=len(source()), width=1200, height=800, uploaded_at=self.now))
        work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        outputs = [(output, f"{self.owner}/variants/{identity}/{output.name}.webp")
                   for output in process_image(source(), "avatar", "image/png")]
        stage_outputs(self.sessions, work, outputs)
        for output, key in outputs:
            write_reserved(self.sessions, work, key, output.data, lambda *_: None)
        finish_work(self.sessions, Settings(), work, outputs, verdict(blocked), None)
        return identity

    def test_creation_is_atomic_persistent_and_visible_in_existing_destinations(self):
        result = self.create()
        self.assertEqual((result.is_seeded, result.is_following, result.follower_count), (False, True, 1))
        with self.sessions() as db:
            self.assertIsNotNone(db.get(Moderator, (result.id, self.owner)))
            self.assertIsNotNone(db.get(Follow, (self.owner, result.id)))
            self.assertEqual(get_space(result.slug, Response(), None, db).name, "Chess Club")
            self.assertIn(result.id, [space.id for space in list_spaces(Response(), None, db, "Chess", "community")])
            self.assertIn(result.id, [space.id for space in profile_spaces(self.owner, Response(), None, db)])
            self.assertEqual(current_profile_response(db, db.get(Profile, self.owner)).joined_community_count, 1)

    def test_duplicate_concurrent_submissions_create_one_moderator_and_follow(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.create(), range(2)))
        self.assertEqual(results[0].id, results[1].id)
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Moderator).where(Moderator.space_id == results[0].id)), 1)
            self.assertEqual(db.get(Space, results[0].id).follower_count, 1)
            change_follow(results[0].slug, False, db.get(Profile, self.owner), Response(), db)
        self.assertFalse(self.create().is_following)

    def test_new_community_uses_the_existing_post_destination(self):
        result = self.create()
        with self.sessions() as db:
            post = create_post(PostCreate(submission_id=uuid4(), title="First meeting", body="Come play chess.", space=result.slug),
                               Response(), db.get(Profile, self.owner), db)
            self.ids.append(post.id)
            self.assertEqual(post.status, "pending")
            self.assertEqual(db.get(Space, result.id).post_count, 1)

    def test_membership_failure_rolls_back_space_and_moderator(self):
        with self.sessions() as db:
            db.execute(text("""create function public.reject_user_space_follow() returns trigger language plpgsql as
                $$ begin raise exception 'test failure' using errcode='check_violation'; end $$;
                create trigger reject_user_space_follow before insert on public.follows
                for each row execute function public.reject_user_space_follow();"""))
            with self.assertRaises(IntegrityError):
                create_space(self.payload(), Response(), db.get(Profile, self.owner), db)
        with self.sessions() as db:
            self.assertIsNone(db.scalar(select(Space.id).where(Space.created_by == self.owner)))
            self.assertIsNone(db.scalar(select(Moderator.space_id).where(Moderator.user_id == self.owner)))

    def test_icon_is_compressed_screened_public_and_protected_from_cleanup(self):
        identity = self.photo()
        result = self.create(self.payload(icon_image_upload_id=identity))
        self.assertEqual(result.icon_image_upload_id, identity)
        with self.sessions() as db:
            versions = db.scalars(select(ImageVariant).where(ImageVariant.image_upload_id == identity)).all()
            self.assertEqual({v.name for v in versions}, {"avatar_small", "avatar_large"})
            self.assertTrue(all(v.width == v.height <= 384 for v in versions))
            self.assertEqual(db.scalar(select(func.count()).select_from(ImageProcessingCheck)
                .where(ImageProcessingCheck.image_upload_id == identity)), 1)
            self.assertTrue(has_live_reference(db, identity))
            with patch("images.routes.image_storage.sign_preview", return_value="https://example.test/icon"):
                self.assertEqual(preview_published_profile_image(identity, Response(), "avatar_small", None, db).url,
                                 "https://example.test/icon")
            with self.assertRaises(HTTPException):
                abandon_upload(identity, db.get(Profile, self.owner), db)
        with self.sessions.begin() as db:
            db.execute(text("set local role anon"))
            self.assertTrue(db.scalar(text("select public.can_read_image_variant(:key)"), {"key": versions[0].object_key}))
        with self.sessions.begin() as db:
            db.get(ImageUpload, identity).asset_cleanup_after = self.now - timedelta(seconds=1)
        self.assertTrue(retire_unused_once(self.sessions))
        with self.sessions() as db:
            self.assertIsNone(db.get(ImageUpload, identity).deleted_at)
        with self.sessions.begin() as db:
            db.get(Space, result.id).deleted_at = self.now
        with self.sessions.begin() as db:
            self.assertIsNotNone(db.get(ImageUpload, identity).asset_cleanup_after)
            db.execute(text("set local role anon"))
            self.assertFalse(db.scalar(text("select public.can_read_image_variant(:key)"), {"key": versions[0].object_key}))

    def test_rejected_icon_cannot_create_a_space_or_be_published(self):
        identity = self.photo(blocked=True)
        with self.assertRaises(HTTPException) as caught:
            self.create(self.payload(icon_image_upload_id=identity))
        self.assertEqual(caught.exception.status_code, 422)
        with self.sessions.begin() as db:
            self.assertIsNone(db.scalar(select(Space.id).where(Space.created_by == self.owner)))
            version = db.scalar(select(ImageVariant).where(ImageVariant.image_upload_id == identity))
            db.execute(text("set local role anon"))
            if version:
                self.assertFalse(db.scalar(text("select public.can_read_image_variant(:key)"), {"key": version.object_key}))
