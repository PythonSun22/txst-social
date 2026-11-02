"""FR-02/32/90/96: opt-in tests against real local Supabase Auth and Storage.

Run separately from backend/ after stopping local API/image workers:
RUN_LOCAL_STORAGE_TESTS=1 uv run python -m unittest discover -s tests \
    -p test_image_storage_integration.py -v

Configuration comes only from `supabase status --output json`, never .env.
Only generated accounts/objects are modified. Storage writes/deletes use HTTP;
SQL adjusts our fixture lifecycle state and reads Storage metadata for assertions.
No provider requests are made: processing verdicts are supplied explicitly.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
from threading import Barrier, Event
import unittest
from unittest.mock import patch
from urllib.parse import urlparse
from uuid import UUID, uuid4

import httpx
from PIL import Image
from sqlalchemy import create_engine, delete, select, text, update
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from models import ImageStorageObject, ImageUpload, Profile

ROOT = Path(__file__).resolve().parents[2]
LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def local_configuration(status):
    """Validate both destinations before using any credential or creating fixtures."""
    api = urlparse(status.get("API_URL", ""))
    database = make_url(status.get("DB_URL", ""))
    if (api.scheme != "http" or api.hostname not in LOOPBACK or api.port is None
            or api.username or api.password or api.path not in {"", "/"} or api.query or api.fragment
            or database.host not in LOOPBACK or database.port is None
            or database.get_backend_name() != "postgresql" or database.database != "postgres"):
        raise RuntimeError("Real Storage tests require the local Supabase API and PostgreSQL database.")
    public = status.get("PUBLISHABLE_KEY") or status.get("ANON_KEY")
    secret = status.get("SERVICE_ROLE_KEY") or status.get("SECRET_KEY")
    if not public or not secret:
        raise RuntimeError("Local Supabase Auth/Storage keys are unavailable.")
    return status["API_URL"].rstrip("/"), database.set(drivername="postgresql+psycopg"), public, secret


class LocalStorageConfigurationTests(unittest.TestCase):
    def test_remote_api_or_database_is_rejected_before_using_credentials(self):
        local = {"API_URL": "http://127.0.0.1:54321",
                 "DB_URL": "postgresql://postgres:local@127.0.0.1:54322/postgres",
                 "PUBLISHABLE_KEY": "local-public", "SERVICE_ROLE_KEY": "local-secret"}
        for changes in ({"API_URL": "https://example.supabase.co"},
                        {"DB_URL": "postgresql://postgres:local@example.com:5432/postgres"},
                        {"API_URL": "http://127.0.0.1:54321@elsewhere.example:80"}):
            with self.subTest(changes=changes), self.assertRaises(RuntimeError):
                local_configuration({**local, **changes})
        self.assertEqual(local_configuration(local)[0], local["API_URL"])


@unittest.skipUnless(os.getenv("RUN_LOCAL_STORAGE_TESTS") == "1", "Opt in to real local Supabase Storage tests")
class ImageStorageIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(["supabase", "status", "--output", "json"], cwd=ROOT,
                                capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise RuntimeError("Start local Supabase before running Storage integration tests.")
        cls.base, database, public, secret = local_configuration(json.loads(result.stdout))
        environment = patch.dict(os.environ, {
            "DATABASE_URL": database.render_as_string(hide_password=False),
            "SUPABASE_URL": cls.base, "SUPABASE_PUBLISHABLE_KEY": public,
            "SUPABASE_SECRET_KEY": secret, "SUPABASE_SERVICE_ROLE_KEY": "",
            "IMAGE_PROCESSING_ENABLED": "false", "MODERATION_ENABLED": "false",
            "OPENAI_API_KEY": "", "NO_PROXY": "127.0.0.1,localhost,::1",
        })
        environment.start()
        cls.addClassCleanup(environment.stop)
        cls.engine = create_engine(database, hide_parameters=True)
        cls.addClassCleanup(cls.engine.dispose)
        cls.sessions = sessionmaker(bind=cls.engine, expire_on_commit=False)
        with cls.engine.connect() as db:
            installed = set(db.scalars(text("select version from supabase_migrations.schema_migrations")))
            required = {path.name.split("_", 1)[0] for path in (ROOT / "supabase/migrations").glob("*.sql")}
            if not required <= installed:
                raise RuntimeError("Apply pending migrations to local Supabase before running Storage tests.")
            guards = set(db.scalars(text("""select tgname from pg_trigger
                where tgrelid='storage.objects'::regclass and tgenabled <> 'D'""")))
            if not {"guard_authenticated_image_write", "guard_image_source_deletion"} <= guards:
                raise RuntimeError("Local Storage upload/deletion guards are missing.")

        from database import get_db
        from main import app

        cls.app = app
        previous = dict(app.dependency_overrides)
        def restore_dependencies():
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
        cls.addClassCleanup(restore_dependencies)
        def local_db():
            with cls.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = local_db  # Real local SQL sessions, no DB doubles.
        cls.public_headers = {"apikey": public}
        cls.admin_headers = {"apikey": secret}
        if not secret.startswith("sb_secret_"):
            cls.admin_headers["Authorization"] = f"Bearer {secret}"

    def setUp(self):
        from fastapi.testclient import TestClient

        self.users = []
        self.keys = set()
        self.http = self.enterContext(httpx.Client(timeout=15, follow_redirects=False, trust_env=False))
        self.addCleanup(self.cleanup_fixtures)
        self.api = self.enterContext(TestClient(self.app))
        self.owner, self.token = self.create_user()
        self.headers = {"Authorization": f"Bearer {self.token}"}
        buffer = BytesIO()
        Image.new("RGB", (32, 32), "teal").save(buffer, "WEBP")
        self.data = buffer.getvalue()

    def create_user(self):
        nonce = uuid4().hex[:10]
        email, password = f"storage-test-{nonce}@txstate.edu", uuid4().hex + "Aa!7"
        response = self.http.post(f"{self.base}/auth/v1/admin/users", headers=self.admin_headers,
            json={"email": email, "password": password, "email_confirm": True,
                  "user_metadata": {"username": f"storage_{nonce}"}})
        self.assertTrue(response.is_success, "Local temporary account creation failed.")
        identity = UUID(response.json()["id"])
        self.users.append(identity)
        response = self.http.post(f"{self.base}/auth/v1/token?grant_type=password",
            headers=self.public_headers, json={"email": email, "password": password})
        self.assertTrue(response.is_success, "Local temporary account sign-in failed.")
        return identity, response.json()["access_token"]

    def reserve(self):
        response = self.api.post("/images/batch", headers=self.headers, json={"images": [{
            "original_name": "storage-test.webp", "content_type": "image/webp",
            "size_bytes": len(self.data), "width": 32, "height": 32, "purpose": "post"}]})
        self.assertEqual(response.status_code, 201, "Local image reservation failed.")
        upload = response.json()[0]["upload"]
        upload["id"] = UUID(upload["id"])
        self.keys.add(upload["object_key"])
        # A separately running local worker must not claim a fixture between HTTP requests.
        with self.sessions.begin() as db:
            db.get(ImageUpload, upload["id"]).processing_next_attempt_at = datetime.now(timezone.utc) + timedelta(days=1)
        return upload

    def upload(self, key, data=None, token=None, upsert=False, **headers):
        return self.http.post(f"{self.base}/storage/v1/object/post-images/{key}",
            content=self.data if data is None else data,
            headers={**self.public_headers, **({"Authorization": f"Bearer {token}"} if token else {}),
                     "Content-Type": "image/webp", "x-upsert": str(upsert).lower(), **headers})

    def complete(self, upload):
        response = self.api.post(f"/images/{upload['id']}/complete", headers=self.headers)
        self.assertEqual(response.status_code, 200, "Actual Storage metadata could not be confirmed.")
        return response.json()

    def saved_upload(self):
        upload = self.reserve()
        self.assertTrue(self.upload(upload["object_key"], token=self.token).is_success, "Owner upload failed.")
        self.complete(upload)
        return upload

    def read(self, key, headers=None):
        return self.http.get(f"{self.base}/storage/v1/object/authenticated/post-images/{key}",
                             headers=self.admin_headers if headers is None else headers)

    def remove(self, keys, headers=None):
        return self.http.request("DELETE", f"{self.base}/storage/v1/object/post-images",
            headers=self.admin_headers if headers is None else headers, json={"prefixes": keys})

    def budget(self):
        from images.budget import storage_budget
        with self.sessions() as db:
            return storage_budget(db, self.owner)

    def work(self, upload, attempts=1):
        from images.worker import Work
        with self.sessions.begin() as db:
            row = db.scalar(select(ImageUpload).where(ImageUpload.id == upload["id"]).with_for_update())
            row.processing_status = "processing"
            row.processing_attempts = attempts
            row.processing_claim = uuid4()
            row.processing_lease_until = datetime.now(timezone.utc) + timedelta(minutes=10)
            return Work(row.id, row.owner_id, row.processing_claim, row.object_key,
                        row.purpose, row.content_type, row.size_bytes)

    def store_versions(self, upload):
        from images.budget import stage_outputs, write_reserved
        from images.processing import process_image
        from images.worker import Settings, finish_work
        from images.worker_storage import write_image
        from moderation.client import TextModerationResult

        work = self.work(upload)
        outputs = [(output, f"{self.owner}/variants/{work.id}/{work.claim}/{output.name}.webp")
                   for output in process_image(self.data, "post", "image/webp")]
        self.keys.update(key for _, key in outputs)
        stage_outputs(self.sessions, work, outputs)
        for output, key in outputs:
            write_reserved(self.sessions, work, key, output.data, write_image)
        verdict = TextModerationResult(flagged=False, categories={"violence": False},
            category_scores={"violence": .01}, model="local-storage-test", latency_ms=0)
        self.assertTrue(finish_work(self.sessions, Settings(), work, outputs, verdict, None))
        return outputs

    def test_owner_upload_is_private_and_cannot_be_overwritten(self):
        _, other_token = self.create_user()
        upload = self.reserve()
        key = upload["object_key"]
        self.assertFalse(self.upload(key).is_success, "Anonymous upload was accepted.")
        self.assertFalse(self.upload(key, token=other_token).is_success, "Foreign owner upload was accepted.")
        unreserved = f"{self.owner}/{uuid4()}.webp"
        self.keys.add(unreserved)
        self.assertFalse(self.upload(unreserved, token=self.token).is_success, "Unreserved upload was accepted.")
        self.assertTrue(self.upload(key, token=self.token).is_success, "Owner upload failed.")
        self.assertFalse(self.upload(key, token=self.token).is_success, "Duplicate upload was accepted.")
        self.assertFalse(self.upload(key, token=self.token, upsert=True).is_success, "Overwrite was accepted.")
        self.assertEqual(self.read(key).content, self.data)
        self.assertFalse(self.read(key, self.public_headers).is_success, "Original became public.")
        self.assertFalse(self.read(key, {**self.public_headers, "Authorization": f"Bearer {other_token}"}).is_success)
        response = self.remove([key], {**self.public_headers, **self.headers})
        if response.is_success:
            # RLS can hide every target row, making DELETE a successful no-op.
            self.assertEqual(response.json(), [], "Owner deletion removed protected objects.")
        self.assertEqual(self.read(key).content, self.data, "A denied delete removed the original.")

    def test_mismatched_metadata_and_oversized_transfers_are_rejected(self):
        upload = self.reserve()
        key = upload["object_key"]
        self.assertFalse(self.upload(key, self.data + b"x", token=self.token).is_success)
        self.assertFalse(self.upload(key, token=self.token, **{"Content-Type": "image/png"}).is_success)
        self.assertFalse(self.upload(key, b"x" * 2_000_001, token=self.token).is_success)
        self.assertFalse(self.read(key).is_success, "A rejected transfer registered a readable object.")
        self.assertTrue(self.upload(key, token=self.token).is_success, "Rejected transfers damaged the open reservation.")

    def test_concurrent_duplicates_and_completion_count_the_source_once(self):
        upload = self.reserve()
        barrier = Barrier(2)
        def transfer():
            barrier.wait(timeout=5)
            return self.upload(upload["object_key"], token=self.token).is_success
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(transfer) for _ in range(2)]
            self.assertEqual(sorted(future.result(timeout=20) for future in futures), [False, True])
        barrier = Barrier(3)
        def confirm():
            barrier.wait(timeout=5)
            return self.complete(upload)
        def duplicate_during_completion():
            barrier.wait(timeout=5)
            return self.upload(upload["object_key"], token=self.token).is_success
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(confirm) for _ in range(2)]
            duplicate = pool.submit(duplicate_during_completion)
            responses = [future.result(timeout=20) for future in futures]
            self.assertFalse(duplicate.result(timeout=20), "An upload racing with completion replaced the source.")
        self.assertEqual(responses[0]["uploaded_at"], responses[1]["uploaded_at"])
        self.assertEqual(self.budget().used_bytes, len(self.data) + 2_000_000)
        self.assertEqual(self.read(upload["object_key"]).content, self.data)

    def test_expired_reservation_rejects_owner_and_elevated_uploads(self):
        upload = self.reserve()
        with self.sessions.begin() as db:
            db.get(ImageUpload, upload["id"]).upload_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.assertFalse(self.upload(upload["object_key"], token=self.token).is_success)
        response = self.http.post(f"{self.base}/storage/v1/object/post-images/{upload['object_key']}",
            content=self.data, headers={**self.admin_headers, "Content-Type": "image/webp"})
        self.assertFalse(response.is_success, "An elevated request bypassed a closed reservation.")
        self.assertFalse(self.read(upload["object_key"]).is_success)
        self.assertEqual(self.api.post(f"/images/{upload['id']}/complete", headers=self.headers).status_code, 410)

    def test_streamed_transfer_cannot_finish_after_reservation_expiry(self):
        upload = self.reserve()
        started, release = Event(), Event()
        def body():
            yield self.data[:len(self.data) // 2]
            started.set()
            if not release.wait(10):
                raise RuntimeError("Local upload stream was not released.")
            yield self.data[len(self.data) // 2:]
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(self.upload, upload["object_key"], body(), self.token,
                                 **{"Content-Length": str(len(self.data))})
            try:
                self.assertTrue(started.wait(5), "The local upload did not start.")
                with self.sessions.begin() as db:
                    db.execute(text("set local lock_timeout='5s'"))
                    db.get(ImageUpload, upload["id"]).upload_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            finally:
                release.set()
            self.assertFalse(future.result(timeout=20).is_success, "A late transfer registered an object.")
        self.assertFalse(self.read(upload["object_key"]).is_success)

    def test_recoverable_input_survives_elevated_delete_then_retry_cleanup_keeps_versions(self):
        from images.budget import delete_recorded
        from images.recovery import retry_image
        from images.worker import Settings, finish_work
        from images.worker_storage import remove_images

        upload = self.saved_upload()
        work = self.work(upload, attempts=3)
        finish_work(self.sessions, Settings(), work, [], None, "provider_connection")
        response = self.remove([upload["object_key"]])
        self.assertFalse(response.is_success, "Elevated Storage DELETE removed a recoverable input.")
        # Storage sanitizes database errors. Prove the guard through retained
        # bytes here and a successful delete with the same credentials after recovery.
        self.assertEqual(self.read(upload["object_key"]).content, self.data)
        self.assertEqual(self.budget().used_bytes, len(self.data))
        with self.sessions.begin() as db:
            db.execute(select(Profile.id).where(Profile.id == self.owner).with_for_update())
            row = db.scalar(select(ImageUpload).where(ImageUpload.id == upload["id"]).with_for_update())
            row.processing_next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            retry_image(db, row)
            row.processing_next_attempt_at = datetime.now(timezone.utc) + timedelta(days=1)
        outputs = self.store_versions(upload)
        with self.sessions.begin() as db:
            row = db.scalar(select(ImageUpload).where(ImageUpload.id == upload["id"]).with_for_update())
            delete_recorded(db, [row.object_key], remove_images)
            row.original_deleted_at = datetime.now(timezone.utc)
        self.assertFalse(self.read(upload["object_key"]).is_success)
        for output, key in outputs:
            self.assertEqual(self.read(key).content, output.data)
        preview = self.api.get(f"/images/{upload['id']}/preview", headers=self.headers)
        self.assertEqual(preview.status_code, 200, "The owner could not obtain a generated-version preview.")
        preview_url = preview.json()["url"]
        self.assertTrue(preview_url.startswith(f"{self.base}/storage/v1/object/sign/"))
        self.assertEqual(self.http.get(preview_url).content, outputs[-1][0].data)
        self.assertEqual(self.budget().used_bytes, sum(len(output.data) for output, _ in outputs))
        self.assertFalse(self.upload(upload["object_key"], token=self.token).is_success,
                         "The owner recreated a cleaned source.")
        response = self.http.post(f"{self.base}/storage/v1/object/post-images/{upload['object_key']}",
            content=self.data, headers={**self.admin_headers, "Content-Type": "image/webp"})
        self.assertFalse(response.is_success, "An elevated request recreated a cleaned source.")

    def test_ready_status_without_confirmed_versions_still_preserves_the_input(self):
        upload = self.saved_upload()
        with self.sessions.begin() as db:
            db.get(ImageUpload, upload["id"]).processing_status = "ready"
        self.assertFalse(self.remove([upload["object_key"]]).is_success,
                         "Ready metadata alone allowed the only input to be deleted.")
        self.assertEqual(self.read(upload["object_key"]).content, self.data)

    def cleanup_fixtures(self):
        if not self.users:
            return
        # Retire only this test's assets before API deletion. Never disable guards.
        with self.sessions.begin() as db:
            db.execute(update(ImageUpload).where(ImageUpload.owner_id.in_(self.users)).values(
                deleted_at=datetime.now(timezone.utc), processing_claim=None, processing_lease_until=None))
            inventory = db.scalars(text("""select name from storage.objects
                where bucket_id='post-images' and split_part(name,'/',1)=any(:owners)"""),
                {"owners": [str(owner) for owner in self.users]}).all()
        keys = sorted(self.keys | set(inventory))
        if keys:
            self.assertTrue(self.remove(keys).is_success, "Temporary Storage files could not be removed.")
        with self.sessions.begin() as db:
            self.assertEqual(db.scalar(text("""select count(*) from storage.objects
                where bucket_id='post-images' and split_part(name,'/',1)=any(:owners)"""),
                {"owners": [str(owner) for owner in self.users]}), 0, "Temporary Storage metadata remains.")
            db.execute(delete(ImageStorageObject).where(ImageStorageObject.owner_id.in_(self.users)))
            db.execute(delete(ImageUpload).where(ImageUpload.owner_id.in_(self.users)))
        for identity in self.users:
            response = self.http.delete(f"{self.base}/auth/v1/admin/users/{identity}", headers=self.admin_headers)
            self.assertTrue(response.is_success, "A temporary Auth account could not be removed.")


if __name__ == "__main__":
    unittest.main()
