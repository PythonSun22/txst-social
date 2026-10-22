"""FR-32/34/90: reference races, deletion retries and actual quota release in PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Event
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException, Response
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from images.budget import stage_outputs, storage_budget, write_reserved
from images.cleanup import cleanup_orphan_once, delete_retired_once, retire_unused_once
from images.processing import process_image
from images.worker import Settings, claim_work, finish_work
from models import ImageProcessingCheck, ImageStorageObject, ImageUpload, ImageVariant, Post, PostMedia, Profile
from moderation.client import ModerationError
from posts.routes import create_post, delete_own_post
from posts.schemas import PostCreate
from profiles.routes import update_current_profile
from profiles.schemas import ProfileUpdate
from test_image_processing import source, verdict
from test_moderation_database import ImageDatabaseFixture


class ImageCleanupDatabaseTests(ImageDatabaseFixture):
    def asset(self, purpose='post', status='ready'):
        identity = uuid4()
        self.uploads.append(identity)
        with self.sessions.begin() as db:
            upload = ImageUpload(id=identity, owner_id=self.owner, purpose=purpose, processing_status=status, upload_method='signed',
                object_key=f'{self.owner}/{identity}.png', original_name='image.png', content_type='image/png',
                size_bytes=100, width=10, height=10, uploaded_at=self.now)
            db.add(upload)
            db.flush()
            if status in {'ready', 'blocked'}:
                name = {'post': 'expanded', 'avatar': 'avatar_large', 'banner': 'banner'}[purpose]
                key = f'{self.owner}/variants/{identity}/{name}.webp'
                db.add(ImageVariant(image_upload_id=identity, name=name, object_key=key,
                    width=10, height=10, size_bytes=50, content_type='image/webp'))
                db.add(ImageStorageObject(object_key=key, owner_id=self.owner, image_upload_id=identity,
                    kind='variant', size_bytes=50, confirmed_at=self.now))
        return identity

    def force_due(self, identity, source_due=True):
        with self.sessions.begin() as db:
            upload = db.get(ImageUpload, identity)
            upload.asset_cleanup_after = self.now - timedelta(seconds=1)
            if source_due:
                upload.original_cleanup_after = self.now - timedelta(seconds=1)

    def attach(self, identity, post_id=None):
        post_id = post_id or self.post(images=1)
        with self.sessions.begin() as db:
            key = db.scalar(select(ImageVariant.object_key).where(ImageVariant.image_upload_id == identity).limit(1))
            db.execute(update(PostMedia).where(PostMedia.post_id == post_id)
                .values(image_upload_id=identity, object_key=key or db.get(ImageUpload, identity).object_key))
        return post_id

    def budget(self):
        with self.sessions() as db:
            return storage_budget(db, self.owner).used_bytes

    def remove_post(self, post_id):
        with self.sessions() as db:
            delete_own_post(post_id, db.get(Profile, self.owner), db)

    def test_shared_asset_survives_first_post_deletion_and_cleans_after_last(self):
        identity = self.asset()
        first, second = self.attach(identity), self.attach(identity)
        self.remove_post(first)
        with self.sessions() as db:
            queued = db.get(ImageUpload, identity).asset_cleanup_after
            self.assertGreater(queued, self.now + timedelta(minutes=4))
        self.force_due(identity)
        retire_unused_once(self.sessions)
        with self.sessions() as db:
            self.assertIsNone(db.get(ImageUpload, identity).deleted_at)
            self.assertIsNone(db.get(ImageUpload, identity).asset_cleanup_after)
        self.remove_post(second)
        self.force_due(identity)
        before = self.budget()
        retire_unused_once(self.sessions)
        with patch('images.cleanup.remove_images') as remove:
            self.assertTrue(delete_retired_once(self.sessions))
            self.assertEqual(len(remove.call_args.args[0]), 2)
        self.assertEqual(self.budget(), before - 150)
        with self.sessions() as db:
            upload = db.get(ImageUpload, identity)
            self.assertIsNotNone(upload.files_deleted_at)
            self.assertIsNotNone(db.get(Post, first))
            self.assertEqual(db.scalar(select(func.count()).select_from(PostMedia).where(PostMedia.image_upload_id == identity)), 2)
            self.assertEqual(db.scalar(select(func.count()).select_from(ImageVariant).where(ImageVariant.image_upload_id == identity)), 1)
        self.assertFalse(delete_retired_once(self.sessions))

    def test_pending_blocked_and_exhausted_posts_all_protect_references(self):
        for state in ('pending', 'blocked', 'approved', 'removed'):
            with self.subTest(state=state):
                identity = self.asset()
                post_id = self.attach(identity)
                with self.sessions.begin() as db:
                    post = db.get(Post, post_id)
                    post.status = state
                    post.moderation_exhausted_at = self.now
                self.force_due(identity)
                retire_unused_once(self.sessions)
                with self.sessions() as db:
                    self.assertIsNone(db.get(ImageUpload, identity).deleted_at)

    def test_preexisting_tombstone_does_not_bypass_live_reference_checks(self):
        identity = self.asset()
        post_id = self.attach(identity)
        with self.sessions.begin() as db:
            db.get(ImageUpload, identity).deleted_at = self.now
        self.force_due(identity)
        before = self.budget()
        with patch('images.cleanup.remove_images') as remove:
            delete_retired_once(self.sessions)
            remove.assert_not_called()
        self.assertEqual(self.budget(), before)
        self.remove_post(post_id)
        self.force_due(identity)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), before - 150)

    def test_never_attached_upload_gets_24_hour_grace_then_reclaims_files(self):
        identity = self.asset()
        with self.sessions() as db:
            self.assertGreater(db.get(ImageUpload, identity).asset_cleanup_after, self.now + timedelta(hours=23))
        self.assertFalse(retire_unused_once(self.sessions))
        self.force_due(identity)
        retire_unused_once(self.sessions)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), 0)

    def test_variants_can_go_before_source_token_horizon_but_source_stays_charged(self):
        identity = self.asset()
        self.force_due(identity, source_due=False)
        retire_unused_once(self.sessions)
        with patch('images.cleanup.remove_images') as remove:
            delete_retired_once(self.sessions)
            self.assertTrue(all('/variants/' in key for key in remove.call_args.args[0]))
        self.assertEqual(self.budget(), 100)
        with self.sessions() as db:
            upload = db.get(ImageUpload, identity)
            self.assertIsNone(upload.files_deleted_at)
            self.assertEqual(upload.asset_cleanup_after, upload.original_cleanup_after)
        self.force_due(identity)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), 0)

    def test_failed_delete_keeps_charge_and_retries_without_losing_metadata(self):
        identity = self.asset()
        self.force_due(identity)
        retire_unused_once(self.sessions)
        with patch('images.cleanup.remove_images', side_effect=ModerationError('private failure', code='storage_delete')):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), 150)
        with self.sessions() as db:
            upload = db.get(ImageUpload, identity)
            self.assertEqual(upload.asset_cleanup_error, 'storage_delete')
            self.assertEqual(upload.asset_cleanup_attempts, 1)
            self.assertIsNone(upload.files_deleted_at)
            self.assertGreater(upload.asset_cleanup_after, self.now)
        self.force_due(identity)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), 0)

    def test_db_failure_after_storage_delete_can_be_retried_idempotently(self):
        identity = self.asset()
        self.force_due(identity)
        retire_unused_once(self.sessions)
        db = self.sessions()
        with patch('images.cleanup.remove_images'), patch.object(db, 'commit', side_effect=RuntimeError('uncertain commit')):
            with self.assertRaises(RuntimeError):
                delete_retired_once(lambda: db)
        self.assertEqual(self.budget(), 150)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), 0)

    def test_retired_upload_cannot_be_reattached_through_api_or_direct_sql(self):
        identity = self.asset()
        self.force_due(identity, source_due=False)
        retire_unused_once(self.sessions)
        with self.sessions() as db, self.assertRaises(HTTPException) as caught:
            create_post(PostCreate(submission_id=uuid4(), title='Too late', image_ids=[identity]),
                Response(), db.get(Profile, self.owner), db)
        self.assertEqual(caught.exception.status_code, 422)
        post_id = self.post(images=1)
        with self.assertRaises(IntegrityError), self.sessions.begin() as db:
            db.execute(update(PostMedia).where(PostMedia.post_id == post_id).values(image_upload_id=identity))
        with self.assertRaises(IntegrityError), self.sessions.begin() as db:
            db.get(Profile, self.owner).pending_profile_image_upload_id = identity

    def test_pending_replacement_keeps_current_until_approved_then_queues_old(self):
        old, replacement = self.asset('avatar'), self.asset('avatar', 'pending')
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=old), Response(), db.get(Profile, self.owner), db)
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=replacement), Response(), db.get(Profile, self.owner), db)
        for identity in (old, replacement):
            self.force_due(identity)
            retire_unused_once(self.sessions)
            with self.sessions() as db:
                self.assertIsNone(db.get(ImageUpload, identity).deleted_at)
        work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        outputs = [(o, f'{self.owner}/variants/{work.id}/{work.claim}/{o.name}.webp')
            for o in process_image(source(), 'avatar', 'image/png')]
        stage_outputs(self.sessions, work, outputs)
        for output, key in outputs:
            write_reserved(self.sessions, work, key, output.data, lambda key, data: None)
        finish_work(self.sessions, Settings(), work, outputs, verdict(), None)
        with self.sessions() as db:
            self.assertEqual(db.get(Profile, self.owner).profile_image_upload_id, replacement)
            self.assertIsNotNone(db.get(ImageUpload, old).asset_cleanup_after)
        self.force_due(old)
        retire_unused_once(self.sessions)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        with self.sessions() as db:
            self.assertIsNotNone(db.get(ImageUpload, old).files_deleted_at)
            self.assertIsNone(db.get(ImageUpload, replacement).deleted_at)
            self.assertEqual(db.scalar(select(func.count()).select_from(ImageProcessingCheck).where(ImageProcessingCheck.image_upload_id == replacement)), 1)

    def test_failed_pending_selection_is_removed_without_removing_current_banner(self):
        old, replacement = self.asset('banner'), self.asset('banner', 'pending')
        for identity in (old, replacement):
            with self.sessions() as db:
                update_current_profile(ProfileUpdate(banner_image_upload_id=identity), Response(), db.get(Profile, self.owner), db)
        with self.sessions.begin() as db:
            db.get(ImageUpload, replacement).processing_status = 'failed'
        # Editing the other profile image must not cancel failed-selection cleanup.
        avatar = self.asset('avatar')
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=avatar), Response(), db.get(Profile, self.owner), db)
            self.assertIsNotNone(db.get(ImageUpload, replacement).asset_cleanup_after)
        self.force_due(replacement)
        retire_unused_once(self.sessions)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        with self.sessions() as db:
            profile = db.get(Profile, self.owner)
            self.assertEqual(profile.banner_image_upload_id, old)
            self.assertIsNone(profile.pending_banner_image_upload_id)
            self.assertIsNone(db.get(ImageUpload, old).deleted_at)

    def test_suspended_profile_retains_images_but_deleted_profile_releases_them(self):
        identity = self.asset('avatar')
        with self.sessions() as db:
            update_current_profile(ProfileUpdate(profile_image_upload_id=identity), Response(), db.get(Profile, self.owner), db)
        with self.sessions.begin() as db:
            db.get(Profile, self.owner).suspended_at = self.now
        self.force_due(identity)
        retire_unused_once(self.sessions)
        with self.sessions() as db:
            self.assertIsNone(db.get(ImageUpload, identity).deleted_at)
        with self.sessions.begin() as db:
            db.get(Profile, self.owner).deleted_at = self.now
        self.force_due(identity)
        retire_unused_once(self.sessions)
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), 0)
        with self.sessions() as db:
            self.assertIsNone(db.get(Profile, self.owner).profile_image_upload_id)

    def test_attachment_wins_account_lock_race_with_retirement(self):
        identity = self.asset()
        post_id = self.post(images=1)
        self.force_due(identity)
        held, release = Event(), Event()
        def attach_while_locked():
            with self.sessions.begin() as db:
                db.execute(select(Profile.id).where(Profile.id == self.owner).with_for_update())
                held.set()
                if not release.wait(10):
                    raise AssertionError('lock release timed out')
                db.execute(update(PostMedia).where(PostMedia.post_id == post_id).values(image_upload_id=identity))
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(attach_while_locked)
            self.assertTrue(held.wait(10))
            try:
                self.assertFalse(retire_unused_once(self.sessions))
            finally:
                release.set()
            future.result(timeout=15)
        self.force_due(identity)
        retire_unused_once(self.sessions)
        with self.sessions() as db:
            self.assertIsNone(db.get(ImageUpload, identity).deleted_at)

    def test_active_processing_lease_defers_retirement_and_stale_work_cannot_publish(self):
        identity = self.asset(status='pending')
        work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        self.force_due(identity)
        retire_unused_once(self.sessions)
        with self.sessions() as db:
            upload = db.get(ImageUpload, identity)
            self.assertIsNone(upload.deleted_at)
            self.assertGreater(upload.asset_cleanup_after, upload.processing_lease_until)
        with self.sessions.begin() as db:
            db.get(ImageUpload, identity).processing_lease_until = self.now - timedelta(seconds=1)
        self.force_due(identity)
        retire_unused_once(self.sessions)
        self.assertFalse(finish_work(self.sessions, Settings(), work, [], None, 'late'))
        with patch('images.cleanup.remove_images'):
            delete_retired_once(self.sessions)
        self.assertEqual(self.budget(), 0)

    def test_key_only_legacy_reference_protects_orphan_until_post_deleted(self):
        post_id = self.post(images=1)
        key = f'{self.owner}/legacy.webp'
        with self.sessions.begin() as db:
            db.add(ImageStorageObject(object_key=key, owner_id=self.owner, kind='orphan', size_bytes=500,
                confirmed_at=self.now, cleanup_after=self.now - timedelta(seconds=1)))
            db.flush()
            db.execute(update(PostMedia).where(PostMedia.post_id == post_id).values(image_upload_id=None, object_key=key))
        with patch('images.cleanup.remove_images') as remove:
            cleanup_orphan_once(self.sessions)
            remove.assert_not_called()
        self.remove_post(post_id)
        with self.sessions.begin() as db:
            db.get(ImageStorageObject, key).cleanup_after = self.now - timedelta(seconds=1)
        before = self.budget()
        with patch('images.cleanup.remove_images', side_effect=ModerationError('private', code='storage_delete')):
            cleanup_orphan_once(self.sessions)
        self.assertEqual(self.budget(), before)
        with self.sessions.begin() as db:
            obj = db.get(ImageStorageObject, key)
            self.assertEqual(obj.cleanup_error, 'storage_delete')
            self.assertEqual(obj.cleanup_attempts, 1)
            obj.cleanup_after = self.now - timedelta(seconds=1)
        with patch('images.cleanup.remove_images'):
            cleanup_orphan_once(self.sessions)
        self.assertEqual(self.budget(), before - 500)
        with self.assertRaises(IntegrityError), self.sessions.begin() as db:
            db.execute(update(PostMedia).where(PostMedia.post_id == post_id).values(object_key=key))
