"""FR-90–92: durable, oldest-first ForAll screening with bounded retries.

Posts are committed before this worker can see them. Attempts and leases survive
restarts; only the current claim may atomically publish a result and its audit.
"""
import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Event
from uuid import UUID, uuid4

from sqlalchemy import or_, select

from database import SessionLocal
from models import ModerationCheck, Post, PostMedia, Space
from moderation import ModerationError, TextModerationResult, moderate_content
from moderation_storage import sign_moderation_image

logger = logging.getLogger(__name__)
POLICY_VERSION = "forall-any-flag-v1"
LEASE_SECONDS = 300


@dataclass(frozen=True)
class Settings:
    max_attempts: int = 3
    retry_seconds: int = 30
    poll_seconds: int = 2

    @classmethod
    def from_env(cls):
        values = {
            "max_attempts": int(os.getenv("MODERATION_MAX_ATTEMPTS", "3")),
            "retry_seconds": int(os.getenv("MODERATION_RETRY_SECONDS", "30")),
            "poll_seconds": int(os.getenv("MODERATION_POLL_SECONDS", "2")),
        }
        if not 1 <= values["max_attempts"] <= 10 or not all(
            1 <= values[key] <= 3600 for key in ("retry_seconds", "poll_seconds")
        ):
            raise ValueError("Invalid moderation worker settings.")
        return cls(**values)

    def retry_delay(self, attempts: int) -> int:
        return min(3600, self.retry_seconds * 4 ** (attempts - 1))


@dataclass(frozen=True)
class Work:
    post_id: UUID
    claim: UUID
    content_hash: str
    text: str
    images: tuple[str, ...]
    post_type: str


def content_snapshot(db, post: Post) -> tuple[str, tuple[str, ...]]:
    media = list(db.scalars(select(PostMedia).where(
        PostMedia.post_id == post.id,
    ).order_by(PostMedia.position)).all())
    content = [post.title, post.body, post.type, post.url, str(post.space_id),
               post.edited_at.isoformat() if post.edited_at else None,
               [(m.position, str(m.image_upload_id), m.object_key) for m in media]]
    digest = hashlib.sha256(json.dumps(content, ensure_ascii=False).encode()).hexdigest()
    return digest, tuple(m.object_key for m in media)


def eligible_posts(now: datetime):
    """Retry delay and lease expiry determine eligibility, independently of age."""
    return select(Post).join(Space, Post.space_id == Space.id).where(
        Space.kind == "campus", Space.slug == "general", Space.deleted_at.is_(None),
        Post.status == "pending", Post.deleted_at.is_(None),
        Post.moderation_exhausted_at.is_(None), Post.moderation_next_attempt_at <= now,
        or_(Post.moderation_lease_until.is_(None), Post.moderation_lease_until <= now),
    ).order_by(Post.created_at, Post.id).limit(1).with_for_update(of=Post, skip_locked=True)


def claim_work(session_factory, settings: Settings, now: datetime) -> Work | None:
    with session_factory() as db:
        post = db.scalar(eligible_posts(now))
        if post is None:
            return None
        # A process can die during its final attempt, before recording failure.
        if post.moderation_attempts >= settings.max_attempts:
            post.moderation_exhausted_at = now
            post.moderation_error = "attempt_limit"
            post.moderation_claim = None
            post.moderation_lease_until = None
            db.commit()
            return None
        digest, images = content_snapshot(db, post)
        token = uuid4()
        post.moderation_attempts += 1
        post.moderation_claim = token
        post.moderation_lease_until = now + timedelta(seconds=LEASE_SECONDS)
        work = Work(post.id, token, digest, f"{post.title}\n\n{post.body or ''}", images, post.type)
        # Count before the network call so a crash cannot reset the retry budget.
        db.commit()
        return work


def record_failure(post: Post, settings: Settings, now: datetime, code: str, retry_after: float = 0):
    post.moderation_error = code
    if post.moderation_attempts >= settings.max_attempts:
        post.moderation_exhausted_at = now
    else:
        delay = max(settings.retry_delay(post.moderation_attempts), retry_after)
        # Do not overflow on a malformed server delay; never retry before its hint.
        try:
            post.moderation_next_attempt_at = now + timedelta(seconds=delay)
        except OverflowError:
            post.moderation_exhausted_at = now
            post.moderation_error = "invalid_retry_delay"


def audit_label(result: TextModerationResult) -> tuple[str, float]:
    if not result.blocked:
        return "clean", max(result.category_scores.values())
    candidates = [name for name, flagged in result.categories.items() if flagged]
    if not candidates:
        return "other", max(result.category_scores.values())
    category = max(candidates, key=lambda name: result.category_scores[name])
    family = category.split("/")[0]
    label = {"sexual": "sexual_content", "self-harm": "self_harm"}.get(family, family)
    if label not in {"harassment", "hate", "sexual_content", "self_harm", "violence", "illicit"}:
        label = "other"
    return label, result.category_scores[category]


def finish_work(session_factory, settings: Settings, work: Work,
                result: TextModerationResult | None, failure: ModerationError | None,
                now: datetime):
    with session_factory() as db:
        post = db.scalar(select(Post).where(Post.id == work.post_id).with_for_update())
        if post is None or post.moderation_claim != work.claim:
            return
        if post.moderation_lease_until is None or post.moderation_lease_until <= now:
            return  # An expired worker cannot publish, even before another claim.
        space = db.get(Space, post.space_id)
        if (post.status != "pending" or post.deleted_at is not None or space is None
                or space.deleted_at is not None or space.kind != "campus" or space.slug != "general"):
            post.moderation_claim = None
            post.moderation_lease_until = None
            db.commit()
            return
        digest, _ = content_snapshot(db, post)
        if digest != work.content_hash:
            failure = ModerationError("Content changed during screening.", code="content_changed")
        if failure is not None:
            record_failure(post, settings, now, failure.code, failure.retry_after)
        elif result is not None:
            label, score = audit_label(result)
            db.add(ModerationCheck(
                post_id=post.id, label=label, score=score,
                decision="block" if result.blocked else "allow", model_version=result.model,
                latency_ms=result.latency_ms, provider_result=result.model_dump(),
                content_hash=work.content_hash, policy_version=POLICY_VERSION,
                attempt=post.moderation_attempts,
            ))
            post.status = "blocked" if result.blocked else "approved"
            post.moderation_error = None
        else:
            record_failure(post, settings, now, "missing_result")
        post.moderation_claim = None
        post.moderation_lease_until = None
        db.commit()


def run_once(session_factory=SessionLocal, settings: Settings | None = None) -> bool:
    """Claim at most one post; never keep a DB transaction open across provider I/O."""
    settings = settings or Settings.from_env()
    work = claim_work(session_factory, settings, datetime.now(timezone.utc))
    if work is None:
        return False
    result, failure = None, None
    try:
        if work.post_type == "link":
            raise ModerationError("Link destinations are not screened.", code="unsupported_link")
        if (work.post_type == "image") != bool(work.images):
            raise ModerationError("Post attachments are inconsistent.", code="invalid_media")
        urls = tuple(sign_moderation_image(key) for key in work.images)
        result = moderate_content(work.text, urls)
    except ModerationError as error:
        failure = error
    except Exception:
        # Never log request bodies, private signed URLs, credentials, or provider errors.
        logger.error("Post moderation failed unexpectedly; the post remains pending.")
        failure = ModerationError("Screening failed.", code="unexpected_failure")
    finish_work(session_factory, settings, work, result, failure, datetime.now(timezone.utc))
    return True


def run_worker(stop: Event, settings: Settings):
    """One thread per API process; database claims coordinate multiple processes."""
    last_error = None
    while not stop.is_set():
        try:
            worked = run_once(settings=settings)
            if last_error is not None:
                logger.info("Moderation worker recovered and resumed screening.")
                last_error = None
        except Exception as error:
            sqlstate = getattr(getattr(error, "orig", None), "sqlstate", None)
            signature = sqlstate or type(error).__name__
            if signature != last_error:
                if sqlstate == "42703":
                    logger.error(
                        "Moderation database columns are missing. Apply "
                        "20260926000000_automatic_post_moderation.sql to this database."
                    )
                else:
                    logger.error(
                        "Moderation database operation failed (SQLSTATE %s); "
                        "check the migration and database availability.",
                        sqlstate or "unknown",
                    )
                last_error = signature
            stop.wait(max(30, settings.poll_seconds))
            continue
        if not worked:
            stop.wait(settings.poll_seconds)
