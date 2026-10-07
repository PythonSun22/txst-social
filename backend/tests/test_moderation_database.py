"""FR-90–92 integration on a disposable loopback PostgreSQL database only.

Set MODERATION_TEST_DATABASE_URL to a fresh database named moderation_test*.
All repo migrations run against minimal Auth/Storage schema stand-ins. Provider
and Storage HTTP calls remain mocked: this does not test the Supabase services.
"""
import os
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost/test"
os.environ["MODERATION_ENABLED"] = "false"

from fastapi import HTTPException, Response
from sqlalchemy import create_engine, delete, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from models import ImageUpload, ModerationCheck, Post, PostMedia, Profile, Space
from moderation import ModerationError
from moderation_context import ContextAssessment
from moderation_worker import Settings, claim_work, finish_work, run_once
from posts import get_post
from test_moderation_worker import verdict


@unittest.skipUnless(os.getenv("MODERATION_TEST_DATABASE_URL"), "Set a disposable local moderation test database")
class ModerationDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = make_url(os.environ["MODERATION_TEST_DATABASE_URL"])
        if url.host not in {"127.0.0.1", "localhost", "::1"} or not (url.database or "").startswith("moderation_test"):
            raise RuntimeError("Refusing a non-local or non-test database.")
        cls.engine = create_engine(url)
        cls.sessions = sessionmaker(bind=cls.engine, expire_on_commit=False)
        with cls.engine.begin() as db:
            exists = db.scalar(text("select to_regclass('public.posts')"))
            if not exists:
                db.execute(text("""
                    create schema auth; create schema storage;
                    do $$ begin
                        if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
                        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
                    end $$;
                    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
                    create function auth.uid() returns uuid language sql stable as
                        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
                    create table storage.buckets (id text primary key, name text, public boolean,
                        file_size_limit bigint, allowed_mime_types text[]);
                    create table storage.objects (id uuid primary key, bucket_id text, name text);
                    alter table storage.objects enable row level security;
                    grant usage on schema public, auth, storage to anon, authenticated;
                    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
                """))
        if not exists:
            migrations = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
            for migration in sorted(migrations.glob("*.sql")):
                with cls.engine.begin() as db:
                    db.exec_driver_sql(migration.read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.ids = []
        self.uploads = []
        self.owner = uuid4()
        self.now = datetime.now(timezone.utc)
        with self.sessions.begin() as db:
            db.execute(text("insert into auth.users values (:id, :email, now())"),
                       {"id": self.owner, "email": f"u{self.owner.hex[:12]}@txstate.edu"})
            self.space = db.scalar(select(Space).where(Space.slug == "general")).id

    def tearDown(self):
        with self.sessions.begin() as db:
            db.execute(delete(Post).where(Post.id.in_(self.ids)))
            db.execute(delete(ImageUpload).where(ImageUpload.id.in_(self.uploads)))
            db.execute(text("delete from auth.users where id=:id"), {"id": self.owner})

    def post(self, age=0, images=0, **values):
        identity = uuid4()
        self.ids.append(identity)
        with self.sessions.begin() as db:
            post = Post(id=identity, author_id=self.owner, space_id=self.space,
                        title="Campus post", body="Study group", type="image" if images else "text",
                        created_at=self.now - timedelta(minutes=age),
                        moderation_next_attempt_at=self.now - timedelta(seconds=1), **values)
            db.add(post)
            db.flush()
            for position in range(images):
                uid = uuid4()
                self.uploads.append(uid)
                key = f"{self.owner}/{uid}.png"
                db.add(ImageUpload(id=uid, owner_id=self.owner, object_key=key, original_name="image.png",
                       content_type="image/png", size_bytes=100, width=10, height=10, uploaded_at=self.now))
                db.flush()
                db.add(PostMedia(post_id=identity, position=position, image_upload_id=uid, object_key=key, width=10, height=10))
        return identity

    def test_oldest_first_approval_audit_and_public_visibility(self):
        newer = self.post()
        older = self.post(age=5)
        with self.sessions() as db:
            with self.assertRaises(HTTPException): get_post(older, Response(), None, db)
        with patch("moderation_worker.moderate_content", return_value=verdict()):
            self.assertTrue(run_once(self.sessions))
        with self.sessions() as db:
            self.assertEqual(db.get(Post, newer).status, "pending")
            self.assertEqual(get_post(older, Response(), None, db).status, "approved")
            audit = db.scalar(select(ModerationCheck).where(ModerationCheck.post_id == older))
            self.assertEqual((audit.decision, audit.attempt, audit.policy_version), ("allow", 1, "forall-any-flag-v1"))
            self.assertEqual(len(audit.content_hash), 64)

    def test_category_flag_blocks_all_images_and_stays_private(self):
        identity = self.post(images=2)
        with (patch("moderation_worker.sign_moderation_image", side_effect=lambda key: f"https://private/{key}") as sign,
              patch("moderation_worker.moderate_content", return_value=verdict(True, "illicit", overall=False)) as screen):
            run_once(self.sessions)
        self.assertEqual(sign.call_count, 2)
        self.assertEqual(len(screen.call_args.args[1]), 2)
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "blocked")
            with self.assertRaises(HTTPException): get_post(identity, Response(), None, db)
            self.assertEqual(get_post(identity, Response(), db.get(Profile, self.owner), db).status, "blocked")
            audit = db.scalar(select(ModerationCheck).where(ModerationCheck.post_id == identity))
            self.assertNotIn("https://private", str(audit.provider_result))

    def test_context_recheck_approves_lone_violence_and_audits_both_results(self):
        identity = self.post()
        first = verdict(True)
        first.category_scores["violence"] = 0.42
        context = ContextAssessment(decision="allow", reason_code="media_reference")
        with (patch("moderation_worker.moderate_content", return_value=first),
              patch("moderation_worker.moderate_context", return_value=context)):
            run_once(self.sessions, Settings(context_recheck_enabled=True))
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "approved")
            audit = db.scalar(select(ModerationCheck).where(ModerationCheck.post_id == identity))
            self.assertEqual(audit.decision, "allow")
            self.assertEqual(audit.policy_version, "forall-context-recheck-v3")
            self.assertTrue(audit.provider_result["categories"]["violence"])
            self.assertEqual(audit.provider_result["context_recheck"], context.model_dump())

    def test_past_incident_recheck_approves_combined_flags(self):
        identity = self.post()
        first = verdict(True)
        first.categories["harassment"] = True
        first.category_scores.update(violence=0.426, harassment=0.568)
        context = ContextAssessment(decision="allow", reason_code="past_incident")
        with (patch("moderation_worker.moderate_content", return_value=first),
              patch("moderation_worker.moderate_context", return_value=context)):
            run_once(self.sessions, Settings(context_recheck_enabled=True))
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "approved")
            audit = db.scalar(select(ModerationCheck).where(ModerationCheck.post_id == identity))
            self.assertEqual(audit.decision, "allow")
            self.assertEqual(audit.provider_result["context_recheck"], context.model_dump())

    def test_context_failure_stays_pending_without_success_audit(self):
        identity = self.post()
        first = verdict(True)
        first.category_scores["violence"] = 0.42
        with (patch("moderation_worker.moderate_content", return_value=first),
              patch("moderation_worker.moderate_context",
                    side_effect=ModerationError("Unavailable", code="context_provider"))):
            run_once(self.sessions, Settings(context_recheck_enabled=True))
        with self.sessions() as db:
            post = db.get(Post, identity)
            self.assertEqual((post.status, post.moderation_attempts, post.moderation_error),
                             ("pending", 1, "context_provider"))
            self.assertIsNone(db.scalar(select(ModerationCheck).where(ModerationCheck.post_id == identity)))

    def test_failure_retry_does_not_block_newer_post_and_exhausts(self):
        older, newer = self.post(age=5), self.post()
        with patch("moderation_worker.moderate_content", side_effect=ModerationError("failure")):
            run_once(self.sessions)
        with patch("moderation_worker.moderate_content", return_value=verdict()):
            run_once(self.sessions)
        with self.sessions() as db:
            self.assertEqual(db.get(Post, newer).status, "approved")
            self.assertEqual(db.get(Post, older).moderation_attempts, 1)
        for _ in range(2):
            with self.sessions.begin() as db:
                db.get(Post, older).moderation_next_attempt_at = self.now - timedelta(seconds=1)
            with patch("moderation_worker.moderate_content", side_effect=ModerationError("failure")):
                run_once(self.sessions)
        with self.sessions() as db:
            post = db.get(Post, older)
            self.assertEqual((post.status, post.moderation_attempts), ("pending", 3))
            self.assertIsNotNone(post.moderation_exhausted_at)
            self.assertTrue(get_post(older, Response(), db.get(Profile, self.owner), db).moderation_failed)
        self.assertIsNone(claim_work(self.sessions, Settings(), self.now + timedelta(days=1)))

    def test_claim_survives_restart_stale_worker_cannot_publish(self):
        identity = self.post()
        first = claim_work(self.sessions, Settings(), self.now)
        self.assertIsNone(claim_work(self.sessions, Settings(), self.now + timedelta(seconds=1)))
        second = claim_work(self.sessions, Settings(), self.now + timedelta(seconds=301))
        finish_work(self.sessions, Settings(), first, verdict(), None, self.now + timedelta(seconds=302))
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "pending")
            self.assertEqual(db.get(Post, identity).moderation_attempts, 2)
        finish_work(self.sessions, Settings(), second, verdict(True), None, self.now + timedelta(seconds=303))
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "blocked")

    def test_last_attempt_crash_is_exhausted_after_lease(self):
        identity = self.post()
        claim_work(self.sessions, Settings(max_attempts=1), self.now)
        self.assertIsNone(claim_work(self.sessions, Settings(max_attempts=1), self.now + timedelta(seconds=301)))
        with self.sessions() as db:
            self.assertIsNotNone(db.get(Post, identity).moderation_exhausted_at)

    def test_locked_oldest_post_is_skipped_by_other_connection(self):
        older, newer = self.post(age=5), self.post()
        with self.sessions.begin() as locking:
            locking.scalar(select(Post).where(Post.id == older).with_for_update())
            work = claim_work(self.sessions, Settings(), self.now)
            self.assertEqual(work.post_id, newer)

    def test_changed_content_and_deleted_posts_are_not_published(self):
        for field, value in (("body", "Changed"), ("deleted_at", self.now)):
            identity = self.post()
            work = claim_work(self.sessions, Settings(), self.now)
            with self.sessions.begin() as db:
                setattr(db.get(Post, identity), field, value)
            finish_work(self.sessions, Settings(), work, verdict(), None, self.now + timedelta(seconds=1))
            with self.sessions() as db:
                self.assertEqual(db.get(Post, identity).status, "pending")
                self.assertIsNone(db.scalar(select(ModerationCheck).where(ModerationCheck.post_id == identity)))

    def test_other_spaces_and_approved_posts_are_not_queued(self):
        identity = self.post(status="approved")
        with self.sessions.begin() as db:
            college = db.scalar(select(Space).where(Space.kind == "college").limit(1))
            other = self.post()
            db.get(Post, other).space_id = college.id
        self.assertIsNone(claim_work(self.sessions, Settings(), self.now))
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).moderation_attempts, 0)

    def test_storage_failure_cannot_approve_from_text_alone(self):
        identity = self.post(images=1)
        with (patch("moderation_worker.sign_moderation_image", side_effect=ModerationError("unavailable")),
              patch("moderation_worker.moderate_content") as screen):
            run_once(self.sessions)
        screen.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "pending")

    def test_audit_failure_rolls_back_publication(self):
        identity = self.post()
        work = claim_work(self.sessions, Settings(), self.now)
        from sqlalchemy import event
        from sqlalchemy.orm import Session
        def fail_audit(session, context, instances):
            if any(isinstance(row, ModerationCheck) for row in session.new):
                raise RuntimeError("simulated audit failure")
        event.listen(Session, "before_flush", fail_audit)
        try:
            with self.assertRaises(RuntimeError):
                finish_work(self.sessions, Settings(), work, verdict(), None, self.now + timedelta(seconds=1))
        finally:
            event.remove(Session, "before_flush", fail_audit)
        with self.sessions() as db:
            self.assertEqual(db.get(Post, identity).status, "pending")
