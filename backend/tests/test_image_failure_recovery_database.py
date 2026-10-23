"""FR-32/90–92: credential outages, deletion fences and quota-safe recovery."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import patch

from fastapi import HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from images.budget import stage_outputs, storage_budget, write_reserved
from images.cleanup import delete_retired_once, retire_unused_once
from images.processing import process_image
from images.routes import abandon_upload, complete_upload, reserve_images, retry_upload
from images.schemas import ImageUploadCreate
from images.worker import Settings, claim_work, cleanup_original_once, finish_work, run_once
from models import ImageStorageObject, ImageUpload, Post, PostMedia, Profile
from moderation.client import ModerationError
from moderation.worker import run_once as screen_post
from posts.routes import retry_screening
from test_image_processing import source, verdict
from test_moderation_database import ImageDatabaseFixture
from worker_control import WorkerControl


class ImageFailureRecoveryTests(ImageDatabaseFixture):
    def asset(self):
        with self.sessions() as db:
            ticket = reserve_images([ImageUploadCreate(original_name='image.png', content_type='image/png',
                size_bytes=len(source()), width=1200, height=800)], Response(), db.get(Profile, self.owner), db)[0]
        self.uploads.append(ticket.upload.id)
        with self.sessions.begin() as db:
            db.execute(text("""insert into storage.objects(id,bucket_id,name,metadata)
              values(gen_random_uuid(),'post-images',:key,jsonb_build_object('size',cast(:size as bigint),'mimetype','image/png'))"""),
              {'key':ticket.upload.object_key,'size':len(source())})
        with self.sessions() as db, patch('images.routes.image_storage.object_info',
                return_value={'size':len(source()),'content_type':'image/png'}):
            complete_upload(ticket.upload.id, Response(), db.get(Profile,self.owner),
                HTTPAuthorizationCredentials(scheme='Bearer',credentials='test'),db)
        return ticket.upload.id

    def tearDown(self):
        with self.sessions.begin() as db:
            db.execute(text("update public.image_uploads set deleted_at=now() where owner_id=:owner"),{'owner':self.owner})
            db.execute(text("delete from storage.objects where name like :prefix"),{'prefix':f'{self.owner}/%'})
        super().tearDown()

    def fail(self, identity, code='provider_connection'):
        work = claim_work(self.sessions,Settings(),datetime.now(timezone.utc))
        self.assertEqual(work.id,identity)
        with self.sessions.begin() as db:
            db.get(ImageUpload,identity).processing_attempts=3
        finish_work(self.sessions,Settings(),work,[],None,code)
        with self.sessions.begin() as db:
            db.get(ImageUpload,identity).processing_next_attempt_at=self.now-timedelta(seconds=1)

    def test_authentication_pauses_both_workers_without_consuming_other_jobs(self):
        first,second=self.asset(),self.asset()
        post=self.post()
        control=WorkerControl()
        with (patch('images.worker.read_image',return_value=source()),
              patch('images.worker.moderate_content',side_effect=ModerationError('private key must not be logged',code='provider_http_401')),
              patch('images.worker.remove_images') as remove,
              self.assertLogs(level='WARNING') as logs):
            self.assertTrue(run_once(self.sessions,Settings(),control))
            self.assertFalse(run_once(self.sessions,Settings(),control))
            self.assertFalse(screen_post(self.sessions,control=control))
            remove.assert_not_called()
        self.assertTrue(control.paused.is_set())
        self.assertIn(control.worker_id,' '.join(logs.output))
        self.assertIn(str(first),' '.join(logs.output))
        self.assertNotIn('private key',' '.join(logs.output))
        with self.sessions() as db:
            a,b=db.get(ImageUpload,first),db.get(ImageUpload,second)
            self.assertEqual(a.processing_attempts,0)
            self.assertTrue(a.recovery_required)
            self.assertEqual(b.processing_attempts,0)
            from models import Post
            self.assertEqual(db.get(Post,post).moderation_attempts,0)

    def test_exhausted_service_failure_preserves_source_in_every_cleanup_path(self):
        identity=self.asset()
        self.fail(identity)
        with self.sessions.begin() as db:
            u=db.get(ImageUpload,identity)
            u.original_cleanup_after=u.asset_cleanup_after=self.now-timedelta(days=2)
        with patch('images.worker.remove_images') as remove, patch('images.cleanup.remove_images') as other:
            self.assertFalse(cleanup_original_once(self.sessions))
            self.assertFalse(retire_unused_once(self.sessions))
            remove.assert_not_called(); other.assert_not_called()
        with self.assertRaises(DBAPIError),self.sessions.begin() as db:
            db.execute(text("delete from storage.objects where name=(select object_key from public.image_uploads where id=:id)"),{'id':identity})
        with self.sessions() as db:
            self.assertEqual(storage_budget(db,self.owner).used_bytes,len(source()))
            self.assertIsNone(db.get(ImageUpload,identity).original_deleted_at)

    def test_concurrent_retry_charges_headroom_once_then_success_deletes_only_input(self):
        identity=self.asset()
        self.fail(identity,'storage_unavailable')
        def retry():
            with self.sessions() as db:
                return retry_upload(identity,Response(),db.get(Profile,self.owner),db).id
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(list(pool.map(lambda _:retry(),range(2))),[identity,identity])
        with self.sessions() as db:
            budget=storage_budget(db,self.owner)
            self.assertEqual(budget.used_bytes,len(source())+2_000_000)
            self.assertEqual(budget.unfinished_uploads,1)
            self.assertEqual(len(db.scalars(select(ImageUpload).where(ImageUpload.owner_id==self.owner)).all()),1)
        work=claim_work(self.sessions,Settings(),datetime.now(timezone.utc))
        outputs=[(o,f'{self.owner}/variants/{identity}/{work.claim}/{o.name}.webp') for o in process_image(source(),'post','image/png')]
        stage_outputs(self.sessions,work,outputs)
        for output,key in outputs:
            write_reserved(self.sessions,work,key,output.data,lambda *_:None)
        finish_work(self.sessions,Settings(),work,outputs,verdict(),None)
        with patch('images.worker.remove_images') as remove:
            self.assertTrue(cleanup_original_once(self.sessions))
            remove.assert_called_once_with([work.key])
        with self.sessions() as db:
            self.assertEqual(storage_budget(db,self.owner).used_bytes,sum(len(o.data) for o,_ in outputs))
            self.assertFalse(db.get(ImageUpload,identity).recovery_required)

    def test_owner_can_deliberately_abandon_preserved_unreferenced_input(self):
        identity=self.asset()
        self.fail(identity)
        with self.sessions() as db:
            abandon_upload(identity,db.get(Profile,self.owner),db)
        with patch('images.cleanup.remove_images') as remove:
            self.assertTrue(delete_retired_once(self.sessions))
            self.assertTrue(remove.called)
        with self.sessions() as db:
            self.assertEqual(storage_budget(db,self.owner).used_bytes,0)

    def test_retry_requires_owner_existing_source_and_available_headroom(self):
        identity=self.asset()
        self.fail(identity)
        with self.sessions() as db,self.assertRaises(HTTPException) as caught:
            retry_upload(identity,Response(),Profile(id=self.space),db)
        self.assertEqual(caught.exception.status_code,404)
        with self.sessions.begin() as db:
            db.add(ImageStorageObject(object_key=f'{self.owner}/other.webp',owner_id=self.owner,
                kind='orphan',size_bytes=49_000_000,confirmed_at=self.now))
        with self.sessions() as db,self.assertRaises(HTTPException) as caught:
            retry_upload(identity,Response(),db.get(Profile,self.owner),db)
        self.assertEqual(caught.exception.status_code,413)
        with self.sessions() as db:
            self.assertEqual(db.get(ImageUpload,identity).processing_status,'failed')

    def test_post_retry_requeues_images_but_never_approves_content(self):
        identity=self.asset()
        post_id=uuid4(); self.ids.append(post_id)
        with self.sessions.begin() as db:
            db.add(Post(id=post_id,author_id=self.owner,space_id=self.space,title='Test',body='Body',
                type='image',status='pending'))
            db.flush()
            db.add(PostMedia(post_id=post_id,position=0,image_upload_id=identity,
                object_key=db.get(ImageUpload,identity).object_key))
        self.fail(identity)
        self.assertFalse(screen_post(self.sessions))  # Failed images do not exhaust post attempts.
        with self.sessions() as db:
            response=retry_screening(post_id,Response(),db.get(Profile,self.owner),db)
            self.assertEqual(response.status,'pending')
            self.assertEqual(response.processing_state,'waiting_images')
            self.assertEqual(db.get(Post,post_id).moderation_attempts,0)
            self.assertEqual(db.get(ImageUpload,identity).processing_status,'pending')
        with self.sessions.begin() as db:
            db.get(ImageUpload,identity).processing_status='blocked'
            db.get(ImageUpload,identity).recovery_required=False
        with self.sessions() as db,self.assertRaises(HTTPException) as caught:
            retry_screening(post_id,Response(),db.get(Profile,self.owner),db)
        self.assertEqual(caught.exception.status_code,409)

    def test_post_credential_failure_preserves_retry_budget_and_pauses_before_next_post(self):
        first,second=self.post(),self.post()
        control=WorkerControl()
        with patch('moderation.worker.moderate_content',side_effect=ModerationError('secret',code='provider_http_401')):
            self.assertTrue(screen_post(self.sessions,control=control))
            self.assertFalse(screen_post(self.sessions,control=control))
        with self.sessions() as db:
            for identity in (first,second):
                self.assertEqual(db.get(Post,identity).moderation_attempts,0)
                self.assertIsNone(db.get(Post,identity).moderation_exhausted_at)

    def test_database_refuses_input_deletion_when_ready_versions_are_missing(self):
        identity=self.asset()
        with self.sessions.begin() as db:
            db.get(ImageUpload,identity).processing_status='ready'
        with patch('images.worker.remove_images') as remove:
            self.assertTrue(cleanup_original_once(self.sessions))
            remove.assert_not_called()
        with self.assertRaises(DBAPIError),self.sessions.begin() as db:
            db.execute(text('delete from storage.objects where name=(select object_key from public.image_uploads where id=:id)'),{'id':identity})
