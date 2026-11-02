"""FR-32: real transactions for capacity, slot limits and uncertain Storage writes."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select, update

from images.budget import (cleanup_attempt, cleanup_staged_once, expire_unfinished,
    stage_outputs, storage_budget, write_reserved)
from images.processing import process_image
from images.routes import complete_upload, reserve_images
from images.schemas import ImageUploadCreate, MAX_UPLOAD_BYTES, SOURCE_GRACE_SECONDS
from images.worker import Settings, claim_work, cleanup_original_once, finish_work
from models import ImageStorageObject, ImageUpload, ImageVariant, PostMedia, Profile
from moderation.client import ModerationError
from test_image_processing import source, verdict
from test_moderation_database import ImageDatabaseFixture


class ImageBudgetDatabaseTests(ImageDatabaseFixture):
    def reserve(self, count=1, purpose='post', size=100):
        payload = ImageUploadCreate(original_name='test.png', content_type='image/png', size_bytes=size,
            width=1200, height=800, purpose=purpose)
        with self.sessions() as db:
            return reserve_images([payload] * count, Response(), db.get(Profile, self.owner),
                db)

    def complete(self, ticket):
        with self.sessions() as db, patch('images.routes.image_storage.object_info',
                return_value={'size': ticket.upload.size_bytes, 'content_type': 'image/png'}):
            return complete_upload(ticket.upload.id, Response(), db.get(Profile, self.owner),
                HTTPAuthorizationCredentials(scheme='Bearer', credentials='test'), db)

    def budget(self):
        with self.sessions() as db:
            return storage_budget(db, self.owner)

    def expire_rate_history(self):
        # Keep capacity/unfinished jobs while moving their rate timestamps out of the minute window.
        with self.sessions.begin() as db:
            db.execute(update(ImageUpload).where(ImageUpload.owner_id == self.owner)
                .values(created_at=datetime.now(timezone.utc) - timedelta(minutes=2)))

    def test_initial_reservation_completion_and_original_cleanup_reconcile(self):
        ticket = self.reserve(size=len(source()))[0]
        self.assertEqual(self.budget().used_bytes, 4_000_000)
        self.assertEqual(self.budget().stored_bytes, 0)
        self.complete(ticket)
        self.assertEqual(self.budget().used_bytes, len(source()) + 2_000_000)
        work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        outputs = [(o, f'{self.owner}/variants/{work.id}/{work.claim}/{o.name}.webp')
            for o in process_image(source(), 'post', 'image/png')]
        stage_outputs(self.sessions, work, outputs)
        self.assertEqual(self.budget().used_bytes, len(source()) + 2_000_000)
        for output, key in outputs:
            write_reserved(self.sessions, work, key, output.data, lambda key, data: None)
        finish_work(self.sessions, Settings(), work, outputs, verdict(), None)
        actual = sum(len(o.data) for o, _ in outputs)
        self.assertEqual(self.budget().used_bytes, len(source()) + actual)
        self.assertEqual(self.budget().reserved_bytes, 0)
        self.assertEqual(self.budget().unfinished_uploads, 0)
        with self.sessions.begin() as db:
            db.get(ImageUpload, work.id).original_cleanup_after = datetime.now(timezone.utc) - timedelta(seconds=1)
        with patch('images.worker.remove_images', side_effect=ModerationError('delete failed', code='storage_delete')):
            cleanup_original_once(self.sessions)
        self.assertEqual(self.budget().used_bytes, len(source()) + actual)
        with self.sessions.begin() as db:
            db.get(ImageUpload, work.id).original_cleanup_after = datetime.now(timezone.utc) - timedelta(seconds=1)
        with patch('images.worker.remove_images'):
            cleanup_original_once(self.sessions)
        self.assertEqual(self.budget().used_bytes, actual)

    def test_four_image_batch_rejected_before_tokens_when_existing_files_leave_less_than_16mb(self):
        # Existing bytes need no image metadata to be charged (e.g. an old interrupted write).
        with self.sessions.begin() as db:
            db.add(ImageStorageObject(object_key=f'{self.owner}/old.webp', owner_id=self.owner,
                kind='orphan', size_bytes=35_000_000, confirmed_at=datetime.now(timezone.utc)))
        with self.assertRaises(HTTPException) as caught:
            self.reserve(count=4, size=MAX_UPLOAD_BYTES)
        self.assertEqual(caught.exception.status_code, 413)
        self.assertIn('16.00 MB', caught.exception.detail)
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(ImageUpload).where(ImageUpload.owner_id == self.owner)), 0)
        self.assertEqual(self.budget().used_bytes, 35_000_000)

    def test_concurrent_requests_cannot_spend_same_last_bytes(self):
        with self.sessions.begin() as db:
            db.add(ImageStorageObject(object_key=f'{self.owner}/existing.webp', owner_id=self.owner,
                kind='orphan', size_bytes=46_000_000, confirmed_at=datetime.now(timezone.utc)))
        barrier = Barrier(2)
        def request():
            barrier.wait(timeout=10)
            try:
                self.reserve()
                return 201
            except HTTPException as error:
                return error.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(request) for _ in range(2)]
            self.assertEqual(sorted(f.result(timeout=15) for f in futures), [201, 413])
        self.assertEqual(self.budget().used_bytes, 50_000_000)

    def test_ten_unfinished_slots_and_terminal_failure_releases_slot_not_files(self):
        for _ in range(10):
            self.complete(self.reserve(purpose='avatar')[0])
        self.expire_rate_history()
        self.assertEqual(self.budget().unfinished_uploads, 10)
        with self.assertRaises(HTTPException) as caught:
            self.reserve(purpose='banner')
        self.assertEqual(caught.exception.status_code, 409)
        with self.sessions.begin() as db:
            db.execute(update(ImageUpload).where(ImageUpload.owner_id == self.owner).values(processing_attempts=3))
        claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        self.assertEqual(self.budget().unfinished_uploads, 9)
        self.assertEqual(self.budget().stored_bytes, 1000)
        self.reserve(purpose='banner')
        self.assertEqual(self.budget().unfinished_uploads, 10)

    def test_concurrent_requests_cannot_spend_same_tenth_slot(self):
        for _ in range(9):
            self.complete(self.reserve(purpose='avatar')[0])
        self.expire_rate_history()
        barrier = Barrier(2)
        def request():
            barrier.wait(timeout=10)
            try:
                self.reserve(purpose='avatar')
                return 201
            except HTTPException as error:
                return error.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(request) for _ in range(2)]
            self.assertEqual(sorted(f.result(timeout=15) for f in futures), [201, 409])
        self.assertEqual(self.budget().unfinished_uploads, 10)

    def test_new_reservation_has_short_deadline_and_no_upload_token(self):
        ticket = self.reserve()[0]
        self.assertFalse(hasattr(ticket, 'token'))
        with self.sessions() as db:
            upload = db.get(ImageUpload, ticket.upload.id)
            self.assertEqual(upload.upload_method, 'authenticated')
            self.assertEqual(upload.upload_expires_at, upload.created_at + timedelta(minutes=15))
        self.assertEqual(self.budget().used_bytes, 4_000_000)

    def test_expired_abandoned_source_charged_until_storage_deletion(self):
        ticket = self.reserve()[0]
        with self.sessions.begin() as db:
            upload = db.get(ImageUpload, ticket.upload.id)
            upload.created_at = datetime.now(timezone.utc) - timedelta(seconds=SOURCE_GRACE_SECONDS + 1)
            upload.original_cleanup_after = datetime.now(timezone.utc) - timedelta(seconds=1)
            upload.upload_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.flush()
            expire_unfinished(db, datetime.now(timezone.utc), self.owner)
        self.assertEqual(self.budget().unfinished_uploads, 0)
        self.assertEqual(self.budget().used_bytes, MAX_UPLOAD_BYTES)
        with patch('images.worker.remove_images'):
            cleanup_original_once(self.sessions)
        self.assertEqual(self.budget().used_bytes, 0)
        with self.sessions() as db:
            self.assertIsNotNone(db.get(ImageUpload, ticket.upload.id))  # Metadata does not consume quota.

    def test_interrupted_write_stays_charged_after_terminal_failure_until_confirmed_deleted(self):
        ticket = self.reserve(size=len(source()))[0]
        self.complete(ticket)
        work = claim_work(self.sessions, Settings(), datetime.now(timezone.utc))
        output = process_image(source(), 'post', 'image/png')[0]
        key = f'{self.owner}/variants/{work.id}/{work.claim}/{output.name}.webp'
        stage_outputs(self.sessions, work, [(output, key)])
        with self.assertRaises(ModerationError):
            write_reserved(self.sessions, work, key, output.data,
                lambda key, data: (_ for _ in ()).throw(ModerationError('uncertain', code='storage_write')))
        with self.sessions.begin() as db:
            db.get(ImageUpload, work.id).processing_attempts = 3
        finish_work(self.sessions, Settings(), work, [], None, 'storage_write')
        self.assertEqual(self.budget().used_bytes, len(source()) + len(output.data))
        self.assertEqual(self.budget().unfinished_uploads, 0)
        with self.assertRaises(ModerationError):
            cleanup_attempt(self.sessions, [key], lambda keys: (_ for _ in ()).throw(ModerationError('failed', code='storage_delete')))
        self.assertEqual(self.budget().used_bytes, len(source()) + len(output.data))
        cleanup_staged_once(self.sessions, lambda keys: None)
        self.assertEqual(self.budget().used_bytes, len(source()))
        with self.assertRaises(ModerationError):
            write_reserved(self.sessions, work, key, output.data, lambda key, data: self.fail('stale write'))

    def test_shared_post_references_do_not_change_storage_charge(self):
        ticket = self.reserve()[0]
        before = self.budget().used_bytes
        for _ in range(2):
            post_id = self.post(images=1)
            with self.sessions.begin() as db:
                db.execute(update(PostMedia).where(PostMedia.post_id == post_id).values(image_upload_id=ticket.upload.id))
        # Two fixture uploads add their own verified 100-byte originals; references add zero.
        self.assertEqual(self.budget().used_bytes, before + 200)
