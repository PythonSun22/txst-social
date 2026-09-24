"""Opt-in FR-30/32/50/51/60/90 integration check; every fixture is rolled back.

Run from backend: uv run python scripts/check_post_database.py --run
Uses DATABASE_URL from backend/.env and an existing active, verified profile.
No Auth users or Storage objects are created; this checks SQL/API integration.
"""
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import Response
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from database import engine  # noqa: E402
from models import ImageUpload, Post, PostMedia, Profile, Space  # noqa: E402
from post_schemas import PostCreate  # noqa: E402
from posts import create_post, list_posts, set_like  # noqa: E402


def check():
    fixtures = []
    with engine.connect() as connection:
        transaction = connection.begin()
        db = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            profile = db.scalar(select(Profile).where(
                Profile.deleted_at.is_(None), Profile.suspended_at.is_(None),
                Profile.email_verified_at.is_not(None),
            ).limit(1))
            assert profile is not None, "An active verified test account is required."
            owner_id = profile.id
            space = db.scalar(select(Space).where(Space.slug == "general", Space.kind == "campus"))
            original_count, original_karma = space.post_count, profile.post_karma

            def submit(body, images):
                payload = PostCreate(submission_id=uuid4(), title="Rollback-only integration check", body=body, image_ids=images)
                saved = create_post(payload, Response(), profile, db)
                fixtures.append(saved.id)
                db.execute(text("set constraints all immediate"))
                db.execute(text("set constraints all deferred"))
                assert saved.status == "pending"
                assert create_post(payload, Response(), profile, db).id == saved.id
                return saved

            first = submit("Text-only post", [])
            uploads = [ImageUpload(id=uuid4(), owner_id=owner_id, bucket_id="post-images",
                object_key=f"{owner_id}/{uuid4()}.png", original_name="rollback-check.png",
                content_type="image/png", size_bytes=100, width=20, height=10,
                uploaded_at=datetime.now(timezone.utc)) for _ in range(2)]
            db.add_all(uploads)
            db.flush()
            image_ids = [u.id for u in uploads]
            mixed = submit("Text and ordered images", image_ids[::-1])
            image_only = submit(None, image_ids[:1])
            assert [m.image_upload_id for m in db.scalars(select(PostMedia).where(
                PostMedia.post_id == mixed.id).order_by(PostMedia.position))] == image_ids[::-1]
            db.refresh(space)
            assert space.post_count == original_count + 3

            def feed(viewer, cursor=None, limit=50):
                return list_posts(Response(), cursor, limit, viewer, db)

            own = feed(profile)
            assert [p.id for p in own.items if p.id in fixtures] == [image_only.id, mixed.id, first.id]
            paged = feed(profile, limit=1)
            assert paged.items[0].id == image_only.id and paged.next_cursor
            assert feed(profile, paged.next_cursor, 1).items[0].id == mixed.id
            assert not set(fixtures).intersection(p.id for p in feed(None).items)
            assert not set(fixtures).intersection(p.id for p in feed(Profile(id=uuid4())).items)

            assert set_like(db, first.id, profile, True).like_count == 1
            assert set_like(db, first.id, profile, True).like_count == 1
            assert next(p for p in feed(profile).items if p.id == first.id).liked
            assert set_like(db, first.id, profile, False).like_count == 0
            assert set_like(db, first.id, profile, False).like_count == 0
            db.refresh(profile)
            assert profile.post_karma == original_karma

            # Only this rollback fixture is approved, to exercise the public read path.
            db.get(Post, mixed.id).status = "approved"
            db.flush()
            assert mixed.id in {p.id for p in feed(None).items}

            # Check the database policies with actual anon/authenticated roles.
            db.execute(text("set constraints all immediate"))
            db.execute(text("select set_config('request.jwt.claim.sub', :id, true)"), {"id": str(owner_id)})
            db.execute(text("set local role authenticated"))
            assert db.scalar(text("select count(*) from public.post_media where post_id = :id"), {"id": image_only.id}) == 1
            with db.begin_nested() as savepoint:
                try:
                    db.execute(text("insert into public.post_likes(user_id, post_id) values (:uid, :pid)"), {"uid": owner_id, "pid": first.id})
                except ProgrammingError:
                    savepoint.rollback()
                else:
                    raise AssertionError("Direct browser like writes must be denied by RLS.")
            db.execute(text("reset role"))
            db.execute(text("select set_config('request.jwt.claim.sub', '', true)"))
            db.execute(text("set local role anon"))
            assert db.scalar(text("select count(*) from public.post_media where post_id = :id"), {"id": image_only.id}) == 0
            assert db.scalar(text("select count(*) from public.post_media where post_id = :id"), {"id": mixed.id}) == 2
            db.execute(text("reset role"))

            with db.begin_nested() as savepoint:
                try:
                    db.execute(text("delete from public.post_media where post_id = :id"), {"id": image_only.id})
                except IntegrityError:
                    savepoint.rollback()
                else:
                    raise AssertionError("An image post without attachments must fail the database constraint.")
            print("PASS: text/image/mixed persistence, order, retry, newest-first pagination, pending visibility, like/unlike counters, RLS and media constraint.")
        finally:
            db.close()
            transaction.rollback()
        assert not connection.scalar(select(Post.id).where(Post.id.in_(fixtures)).limit(1))
        print("PASS: all test changes rolled back; no fixture posts persisted.")


if __name__ == "__main__":
    if sys.argv[1:] != ["--run"]:
        raise SystemExit("Explicit opt-in required: python scripts/check_post_database.py --run")
    check()
