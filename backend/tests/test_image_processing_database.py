"""Opt-in real PostgreSQL lifecycle/RLS tests; HTTP providers/Storage are mocked.

Run against a fresh loopback database named moderation_test* using
MODERATION_TEST_DATABASE_URL. The fixture applies every checked-in migration.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from fastapi import Response
from sqlalchemy import select, text

from images.processing import process_image
from images.routes import retry_upload
from images.worker import Settings, claim_work, finish_work, cleanup_original_once
from images.budget import stage_outputs, write_reserved
from models import ImageUpload, ImageVariant, ImageProcessingCheck, Profile
from profiles.routes import current_profile_response, update_current_profile
from profiles.schemas import ProfileUpdate
from test_image_processing import source, verdict
from test_moderation_database import ImageDatabaseFixture


class ImageProcessingDatabaseTests(ImageDatabaseFixture):
    def upload(self, purpose="avatar"):
        uid = uuid4()
        self.uploads.append(uid)
        with self.sessions.begin() as db:
            db.add(ImageUpload(id=uid, owner_id=self.owner, purpose=purpose, upload_method="signed", object_key=f"{self.owner}/{uid}.png",
                original_name="test.png", content_type="image/png", size_bytes=len(source()), width=1200, height=800,
                uploaded_at=self.now))
        return uid

    def finish(self, work, blocked=False):
        outputs = [(o, f"{self.owner}/variants/{work.id}/{o.name}.webp") for o in process_image(source(), work.purpose, "image/png")]
        stage_outputs(self.sessions, work, outputs)
        for output, key in outputs:
            write_reserved(self.sessions, work, key, output.data, lambda key, data: None)
        return finish_work(self.sessions, Settings(), work, outputs, verdict(blocked), None)

    def test_pending_profile_activation_is_atomic_with_variants_and_audit(self):
        uid = self.upload()
        with self.sessions() as db:
            profile = db.get(Profile, self.owner)
            update_current_profile(ProfileUpdate(profile_image_upload_id=uid), Response(), profile, db)
            self.assertIsNone(profile.profile_image_upload_id)
            self.assertEqual(profile.pending_profile_image_upload_id, uid)
        work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        self.assertTrue(self.finish(work))
        with self.sessions() as db:
            self.assertEqual(db.get(Profile, self.owner).profile_image_upload_id, uid)
            self.assertEqual(db.get(ImageUpload, uid).processing_status, "ready")
            self.assertEqual(len(db.scalars(select(ImageVariant).where(ImageVariant.image_upload_id == uid)).all()), 2)
            self.assertEqual(len(db.scalars(select(ImageProcessingCheck).where(ImageProcessingCheck.image_upload_id == uid)).all()), 1)

    def test_old_claim_cannot_replace_new_selection_and_flag_keeps_previous(self):
        first = self.upload()
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=first), Response(), db.get(Profile, self.owner), db)
        first_work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        second = self.upload()
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=second), Response(), db.get(Profile, self.owner), db)
        self.finish(first_work)
        with self.sessions() as db:
            profile = db.get(Profile, self.owner)
            self.assertIsNone(profile.profile_image_upload_id)
            self.assertEqual(profile.pending_profile_image_upload_id, second)
        self.finish(claim_work(self.sessions, Settings(), datetime.now(timezone.utc)), blocked=True)
        with self.sessions() as db:
            self.assertIsNone(db.get(Profile, self.owner).profile_image_upload_id)
            self.assertEqual(db.get(ImageUpload, second).processing_status, "blocked")

    def test_failed_profile_replacement_can_retry_without_losing_current_avatar(self):
        current = self.upload()
        self.finish(claim_work(self.sessions, Settings(), datetime.now(timezone.utc)))
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=current), Response(),
                                   db.get(Profile, self.owner), db)
        replacement = self.upload()
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=replacement), Response(),
                                   db.get(Profile, self.owner), db)
        work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        finish_work(self.sessions, Settings(attempts=1), work, [], None, "storage_unavailable")
        with self.sessions.begin() as db:
            db.get(ImageUpload, replacement).processing_next_attempt_at = self.now - timedelta(seconds=1)
        with self.sessions() as db:
            profile = db.get(Profile, self.owner)
            failed = current_profile_response(db, profile)
            self.assertEqual(failed.profile_image_upload_id, current)
            self.assertEqual(failed.profile_image_status, "failed")
            retry_upload(replacement, Response(), profile, db)
            self.assertEqual(profile.profile_image_upload_id, current)
        self.finish(claim_work(self.sessions, Settings(), datetime.now(timezone.utc)))
        with self.sessions() as db:
            recovered = current_profile_response(db, db.get(Profile, self.owner))
            self.assertEqual(recovered.profile_image_upload_id, replacement)
            self.assertIsNone(recovered.pending_profile_image_upload_id)
            self.assertIsNone(recovered.profile_image_status)

    def test_rls_hides_unapproved_variants_and_never_publishes_original(self):
        uid = self.upload()
        self.finish(claim_work(self.sessions, Settings(), datetime.now(timezone.utc)))
        with self.sessions.begin() as db:
            key = db.scalar(select(ImageVariant.object_key).where(ImageVariant.image_upload_id == uid).limit(1))
            db.execute(text("set local role anon"))
            self.assertFalse(db.scalar(text("select public.can_read_image_variant(:key)"), {"key": key}))
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=uid), Response(), db.get(Profile, self.owner), db)
        with self.sessions.begin() as db:
            original = db.get(ImageUpload, uid).object_key
            db.execute(text("set local role anon"))
            self.assertTrue(db.scalar(text("select public.can_read_image_variant(:key)"), {"key": key}))
            self.assertFalse(db.scalar(text("select public.can_read_image_variant(:key)"), {"key": original}))
            self.assertEqual(len(db.scalars(select(ImageVariant).where(ImageVariant.image_upload_id == uid)).all()), 2)

    def test_cleanup_waits_for_upload_token_expiry_and_preserves_variants(self):
        uid = self.upload()
        self.finish(claim_work(self.sessions, Settings(), datetime.now(timezone.utc)))
        with patch("images.worker.remove_images") as remove:
            self.assertFalse(cleanup_original_once(self.sessions))
            remove.assert_not_called()
            with self.sessions.begin() as db:
                db.get(ImageUpload, uid).original_cleanup_after = self.now - timedelta(seconds=1)
            self.assertTrue(cleanup_original_once(self.sessions))
            remove.assert_called_once()
        with self.sessions() as db:
            self.assertIsNotNone(db.get(ImageUpload, uid).original_deleted_at)
            self.assertEqual(len(db.scalars(select(ImageVariant).where(ImageVariant.image_upload_id == uid)).all()), 2)
