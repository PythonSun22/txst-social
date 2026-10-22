"""Durable, single-job-at-a-time image processing and asset screening (FR-32/90).

Multiple API processes coordinate using database leases. Processing transactions
never span Storage/provider calls. General asset hard deletion/quotas are separate.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import logging
import math
import os
from threading import Event
from uuid import UUID, uuid4

from sqlalchemy import or_, select, update

from database import SessionLocal
from images.processing import Output, process_image
from images.worker_storage import image_data_url, read_image, remove_images, write_image
from models import ImageProcessingCheck, ImageUpload, ImageVariant, PostMedia, Profile
from moderation.client import ModerationError, moderate_content

logger = logging.getLogger(__name__)
LEASE_SECONDS = 600
# Supabase signed upload tokens last two hours. Wait for expiry before deleting
# the source, otherwise an outstanding token could recreate it after cleanup.
SOURCE_GRACE_SECONDS = 7500


@dataclass(frozen=True)
class Settings:
    attempts: int = 3
    retry_seconds: int = 30
    poll_seconds: int = 2

    @classmethod
    def from_env(cls):
        values = [int(os.getenv(name, default)) for name, default in (
            ("IMAGE_PROCESSING_MAX_ATTEMPTS", "3"), ("IMAGE_PROCESSING_RETRY_SECONDS", "30"),
            ("IMAGE_PROCESSING_POLL_SECONDS", "2"))]
        if not 1 <= values[0] <= 10 or not all(1 <= value <= 3600 for value in values[1:]):
            raise ValueError("Invalid image processing settings.")
        return cls(*values)


@dataclass(frozen=True)
class Work:
    id: UUID
    owner: UUID
    claim: UUID
    key: str
    purpose: str
    content_type: str
    size_bytes: int


def claim_work(sessions, settings: Settings, now: datetime) -> Work | None:
    with sessions() as db:
        upload = db.scalar(select(ImageUpload).where(
            ImageUpload.uploaded_at.is_not(None), ImageUpload.deleted_at.is_(None),
            ImageUpload.processing_status.in_(["pending", "processing"]),
            ImageUpload.processing_next_attempt_at <= now,
            or_(ImageUpload.processing_lease_until.is_(None), ImageUpload.processing_lease_until <= now),
        ).order_by(ImageUpload.created_at, ImageUpload.id).limit(1).with_for_update(skip_locked=True))
        if upload is None:
            return None
        if upload.processing_attempts >= settings.attempts:
            upload.processing_status = "failed"
            upload.processing_error = "attempt_limit"
            upload.processing_claim = upload.processing_lease_until = None
            db.commit()
            return None
        token = uuid4()
        upload.processing_status = "processing"
        upload.processing_attempts += 1
        upload.processing_claim = token
        upload.processing_lease_until = now + timedelta(seconds=LEASE_SECONDS)
        work = Work(upload.id, upload.owner_id, token, upload.object_key, upload.purpose,
                    upload.content_type, upload.size_bytes)
        db.commit()
        return work


def activate_profile(db, upload: ImageUpload):
    if upload.purpose not in {"avatar", "banner"}:
        return
    pending = "pending_profile_image_upload_id" if upload.purpose == "avatar" else "pending_banner_image_upload_id"
    current = "profile_image_upload_id" if upload.purpose == "avatar" else "banner_image_upload_id"
    profile = db.scalar(select(Profile).where(
        Profile.id == upload.owner_id, getattr(Profile, pending) == upload.id,
    ).with_for_update())
    if profile and profile.deleted_at is None and profile.suspended_at is None:
        # A replaced pending selection must never be activated by an old job.
        setattr(profile, current, upload.id)
        setattr(profile, pending, None)


def finish_work(sessions, settings: Settings, work: Work, outputs: list[tuple[Output, str]],
                result, failure: str | None, retry_after: float = 0) -> bool:
    now = datetime.now(timezone.utc)
    with sessions() as db:
        upload = db.scalar(select(ImageUpload).where(ImageUpload.id == work.id).with_for_update())
        if (upload is None or upload.deleted_at is not None or upload.processing_claim != work.claim
                or upload.processing_lease_until is None or upload.processing_lease_until <= now):
            return False
        if failure:
            upload.processing_error = failure
            upload.processing_status = "failed" if upload.processing_attempts >= settings.attempts else "pending"
            delay = max(settings.retry_seconds * 4 ** (upload.processing_attempts - 1), retry_after)
            try:
                if not math.isfinite(delay):
                    raise ValueError()
                upload.processing_next_attempt_at = now + timedelta(seconds=delay)
            except (ValueError, OverflowError):
                upload.processing_status = "failed"
                upload.processing_error = "invalid_retry_delay"
        else:
            for output, key in outputs:
                db.add(ImageVariant(image_upload_id=upload.id, name=output.name, object_key=key,
                                    width=output.width, height=output.height, size_bytes=len(output.data),
                                    content_type="image/webp"))
            largest, largest_key = outputs[-1]
            upload.processing_status = "blocked" if result.blocked else "ready"
            upload.processing_error = None
            upload.original_cleanup_after = max(now, upload.created_at + timedelta(seconds=SOURCE_GRACE_SECONDS))
            db.add(ImageProcessingCheck(
                image_upload_id=upload.id, attempt=upload.processing_attempts,
                decision="block" if result.blocked else "allow", model=result.model,
                policy_version="image-any-flag-v1", content_hash=hashlib.sha256(largest.data).hexdigest(),
                provider_result=result.model_dump(),
            ))
            # Store measured display dimensions; source metadata remains historical.
            db.execute(update(PostMedia).where(PostMedia.image_upload_id == upload.id).values(
                object_key=largest_key, width=largest.width, height=largest.height))
            db.flush()
            if not result.blocked:
                activate_profile(db, upload)
        upload.processing_claim = upload.processing_lease_until = None
        db.commit()
        return failure is None


def run_once(sessions=SessionLocal, settings: Settings | None = None) -> bool:
    settings = settings or Settings.from_env()
    work = claim_work(sessions, settings, datetime.now(timezone.utc))
    if work is None:
        return False
    stored: list[tuple[Output, str]] = []
    try:
        data = read_image(work.key)
        if len(data) != work.size_bytes:
            raise ValueError("Original size mismatch.")
        outputs = process_image(data, work.purpose, work.content_type)
        # Screen all pixels of the display master (no signed/loopback fetch needed).
        result = moderate_content("Student image upload", (image_data_url(outputs[-1].data),))
        for output in outputs:
            key = f"{work.owner}/variants/{work.id}/{work.claim}/{output.name}.webp"
            stored.append((output, key))  # Include an uncertain write in cleanup.
            write_image(key, output.data)
        committed = finish_work(sessions, settings, work, stored, result, None)
        if committed:
            return True
    except (ModerationError, ValueError) as error:
        finish_work(sessions, settings, work, [], None,
                    error.code if isinstance(error, ModerationError) else "invalid_image",
                    getattr(error, "retry_after", 0))
    except Exception:
        # Commit outcomes can be uncertain; never delete files that may be live.
        logger.error("Image processing interrupted; lease recovery will retry safely.")
        return True
    try:
        remove_images([key for _, key in stored])
    except ModerationError:
        logger.error("Unable to remove incomplete image versions.")
    return True


def cleanup_original_once(sessions=SessionLocal) -> bool:
    """Delete ONLY completed source inputs; general asset cleanup is deferred.

    Repeated deletes are safe. Retain the short row lock to serialize this one
    bounded Storage delete; processing/moderation never hold network transactions.
    """
    now = datetime.now(timezone.utc)
    with sessions() as db:
        upload = db.scalar(select(ImageUpload).where(
            ImageUpload.processing_status.in_(["ready", "blocked"]),
            ImageUpload.original_deleted_at.is_(None), ImageUpload.original_cleanup_after <= now,
        ).order_by(ImageUpload.original_cleanup_after).limit(1).with_for_update(skip_locked=True))
        if upload is None:
            return False
        try:
            remove_images([upload.object_key])
            upload.original_deleted_at = now
            upload.original_cleanup_error = None
        except ModerationError as error:
            upload.original_cleanup_error = error.code
            upload.original_cleanup_after = now + timedelta(minutes=5)
        db.commit()
        return True


def run_worker(stop: Event, settings: Settings):
    last_error = None
    while not stop.is_set():
        try:
            worked = run_once(settings=settings)
            cleaned = cleanup_original_once()
            last_error = None
        except Exception as error:
            signature = type(error).__name__
            if signature != last_error:
                logger.error("Image worker unavailable; check image migrations and configuration.")
                last_error = signature
            stop.wait(30)
            continue
        if not worked and not cleaned:
            stop.wait(settings.poll_seconds)
