"""FR-02/32/90/96: real reservation fences, RLS and early cleanup transactions."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Event
from unittest.mock import patch
from uuid import uuid4

from fastapi import Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from images.budget import expire_unfinished, storage_budget
from images.routes import complete_upload, reserve_images
from images.schemas import ImageUploadCreate
from images.worker import cleanup_original_once
from models import ImageStorageObject, ImageUpload, Profile
from test_moderation_database import ImageDatabaseFixture


class AuthenticatedImageDatabaseTests(ImageDatabaseFixture):
    def reserve(self):
        with self.sessions() as db:
            return reserve_images([ImageUploadCreate(original_name='image.webp', content_type='image/webp',
                size_bytes=100, width=20, height=20)], Response(), db.get(Profile, self.owner),
                db)[0]

    def insert_object(self, db, ticket, owner=None, size=100):
        if owner is not None:
            db.execute(text("set local role authenticated"))
            db.execute(text("select set_config('request.jwt.claim.sub', :owner, true)"), {'owner': str(owner)})
        db.execute(text("""insert into storage.objects(id,bucket_id,name,metadata)
            values (:id,'post-images',:key,jsonb_build_object('size',cast(:size as bigint),'mimetype','image/webp'))"""),
            {'id': uuid4(), 'key': ticket.upload.object_key, 'size': size})

    def tearDown(self):
        with self.sessions.begin() as db:
            db.execute(text("delete from storage.objects where name like :prefix"), {'prefix': f'{self.owner}/%'})
        super().tearDown()

    def test_only_owner_can_insert_exact_open_reservation_and_no_overwrites(self):
        ticket = self.reserve()
        with self.engine.begin() as db:
            db.execute(text('grant select, insert, update, delete on storage.objects to authenticated'))
        with self.assertRaises(DBAPIError), self.sessions.begin() as db:
            self.insert_object(db, ticket, uuid4())
        with self.assertRaises(DBAPIError), self.sessions.begin() as db:
            self.insert_object(db, ticket, self.owner, size=101)
        with self.sessions.begin() as db:
            self.insert_object(db, ticket, self.owner)
        with self.sessions.begin() as db:
            db.execute(text('set local role authenticated'))
            db.execute(text("select set_config('request.jwt.claim.sub', :owner, true)"), {'owner': str(self.owner)})
            self.assertEqual(db.execute(text("update storage.objects set metadata='{}' where name=:key"),
                {'key': ticket.upload.object_key}).rowcount, 0)

    def test_closed_reservation_rejects_late_privileged_metadata_write_after_cleanup(self):
        ticket = self.reserve()
        with self.sessions.begin() as db:
            self.insert_object(db, ticket)
        with self.sessions() as db, patch('images.routes.image_storage.object_info',
                return_value={'size': 100, 'content_type': 'image/webp'}):
            complete_upload(ticket.upload.id, Response(), db.get(Profile, self.owner),
                HTTPAuthorizationCredentials(scheme='Bearer', credentials='test'), db)
        with self.sessions.begin() as db:
            db.get(ImageUpload, ticket.upload.id).processing_status = 'ready'
            db.get(ImageUpload, ticket.upload.id).processing_reserved_bytes = 0
        with patch('images.worker.remove_images') as remove:
            self.assertTrue(cleanup_original_once(self.sessions))
            remove.assert_called_once_with([ticket.upload.object_key])
        with self.sessions.begin() as db:
            db.execute(text('delete from storage.objects where name=:key'), {'key': ticket.upload.object_key})
        # Simulate a Storage request that passed its initial authorization before
        # completion, then tries to commit after deletion as an internal role.
        with self.assertRaises(DBAPIError), self.sessions.begin() as db:
            self.insert_object(db, ticket)
        with self.sessions() as db:
            self.assertEqual(storage_budget(db, self.owner).used_bytes, 0)

    def test_expiry_closes_upload_and_allows_early_abandoned_cleanup(self):
        ticket = self.reserve()
        with self.sessions.begin() as db:
            db.get(ImageUpload, ticket.upload.id).upload_expires_at = datetime.now(timezone.utc)-timedelta(seconds=1)
        with self.assertRaises(DBAPIError), self.sessions.begin() as db:
            self.insert_object(db, ticket)
        with self.sessions.begin() as db:
            expire_unfinished(db, datetime.now(timezone.utc), self.owner)
        with patch('images.worker.remove_images'):
            self.assertTrue(cleanup_original_once(self.sessions))
        with self.sessions() as db:
            self.assertEqual(storage_budget(db, self.owner).used_bytes, 0)

    def test_final_write_waits_for_closure_and_then_fails(self):
        ticket = self.reserve()
        started = Event()
        def late_write():
            with self.sessions.begin() as db:
                started.set()
                self.insert_object(db, ticket)
        with ThreadPoolExecutor(max_workers=1) as pool:
            with self.sessions.begin() as db:
                upload = db.scalar(select(ImageUpload).where(ImageUpload.id == ticket.upload.id).with_for_update())
                future = pool.submit(late_write)
                self.assertTrue(started.wait(5))
                upload.uploaded_at = datetime.now(timezone.utc)
            with self.assertRaises(DBAPIError):
                future.result(timeout=10)

    def test_legacy_signed_reservation_keeps_full_charge_and_grace(self):
        identity = uuid4()
        with self.sessions.begin() as db:
            db.add(ImageUpload(id=identity, owner_id=self.owner, object_key=f'{self.owner}/{identity}.png',
                original_name='old.png', content_type='image/png', size_bytes=5_000_000,
                width=100, height=100, upload_method='signed', processing_status='failed'))
        with self.sessions() as db:
            upload = db.get(ImageUpload, identity)
            self.assertEqual(db.get(ImageStorageObject, upload.object_key).size_bytes, 10_000_000)
            self.assertEqual(upload.original_cleanup_after, upload.created_at+timedelta(seconds=7500))
        with patch('images.worker.remove_images') as remove:
            self.assertFalse(cleanup_original_once(self.sessions))
            remove.assert_not_called()
