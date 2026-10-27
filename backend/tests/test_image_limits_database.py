"""FR-32: opt-in PostgreSQL checks, including two requests for the final slot."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from images.limits import reserve_upload_slot
from models import ImageUpload
from test_moderation_database import ImageDatabaseFixture


class ImageLimitDatabaseTests(ImageDatabaseFixture):
    def reservation(self, created, purpose="post", deleted=False):
        uid = uuid4()
        return ImageUpload(id=uid, owner_id=self.owner, object_key=f"{self.owner}/{uid}.png",
            original_name="test.png", content_type="image/png", size_bytes=100, width=10, height=10,
            purpose=purpose, created_at=created, deleted_at=created if deleted else None)

    def test_concurrent_final_slot_only_admits_one_reservation(self):
        with self.sessions.begin() as db:
            db.add_all([self.reservation(datetime.now(timezone.utc)) for _ in range(9)])
        barrier = Barrier(2)

        def request_slot():
            with self.sessions() as db:
                barrier.wait(timeout=10)
                try:
                    created = reserve_upload_slot(db, self.owner)
                    db.add(self.reservation(created))
                    db.commit()
                    return 201
                except HTTPException as error:
                    db.rollback()
                    return error.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            requests = [pool.submit(request_slot) for _ in range(2)]
            self.assertEqual(sorted(request.result(timeout=15) for request in requests), [201, 429])

    def test_hourly_budget_counts_deleted_incomplete_and_all_purposes(self):
        with self.sessions.begin() as db:
            db.add_all([self.reservation(datetime.now(timezone.utc) - timedelta(minutes=2),
                purpose=("post", "avatar", "banner")[i % 3], deleted=i % 2 == 0) for i in range(40)])
        with self.sessions() as db, self.assertRaises(HTTPException) as caught:
            reserve_upload_slot(db, self.owner)
        self.assertEqual(caught.exception.status_code, 429)

    def test_database_rejects_fifth_attachment(self):
        self.post(images=4)
        with self.assertRaises(IntegrityError):
            self.post(images=5)

    def test_existing_fifth_image_can_still_receive_worker_key_updates(self):
        post_id = self.post(images=4)
        with self.sessions.begin() as db:
            # Simulate a row that existed before this migration, in this disposable DB only.
            db.execute(text("alter table public.post_media disable trigger post_media_four_images"))
            db.execute(text("update public.post_media set position=4 where post_id=:id and position=3"), {"id": post_id})
            db.execute(text("set constraints all immediate"))
            db.execute(text("alter table public.post_media enable trigger post_media_four_images"))
            result = db.execute(text("update public.post_media set object_key='legacy/expanded.webp' where post_id=:id and position=4"), {"id": post_id})
            self.assertEqual(result.rowcount, 1)
