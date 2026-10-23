"""Durable, single-job-at-a-time image processing and asset screening (FR-32/90).

Multiple API processes coordinate using database leases. Processing transactions
never span provider calls. Bounded object writes/deletes lock their accounting rows.
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
from images.schemas import SOURCE_GRACE_SECONDS
from images.budget import (cleanup_attempt, cleanup_staged_once, delete_recorded,
                           expire_unfinished, release_processing, source_cleanup_time, stage_outputs, write_reserved)
from images.cleanup import cleanup_orphan_once, delete_retired_once, retire_unused_once
from models import ImageProcessingCheck, ImageStorageObject, ImageUpload, ImageVariant, PostMedia, Profile
from moderation.client import ModerationError, moderate_content
from worker_control import WorkerControl, credential_error

logger = logging.getLogger(__name__)
LEASE_SECONDS = 600
# Legacy signed uploads retain their two-hour grace. Authenticated uploads close
# on completion and can be cleaned as soon as processing is terminal.


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
            upload.recovery_required = True
            upload.processing_claim = upload.processing_lease_until = None
            release_processing(db, upload)
            upload.original_cleanup_after = source_cleanup_time(upload, now)
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
        # Match profile edits, attachment creation and retirement lock order.
        db.execute(select(Profile.id).where(Profile.id == work.owner).with_for_update())
        upload = db.scalar(select(ImageUpload).where(ImageUpload.id == work.id).with_for_update())
        if (upload is None or upload.deleted_at is not None or upload.processing_claim != work.claim
                or upload.processing_lease_until is None or upload.processing_lease_until <= now):
            return False
        if failure:
            upload.processing_error = failure
            upload.recovery_required = failure not in {"invalid_image", "upload_expired", "unused_image"}
            if credential_error(failure):
                upload.processing_attempts = max(0, upload.processing_attempts - 1)
            upload.processing_status = "failed" if upload.processing_attempts >= settings.attempts else "pending"
            delay = max(settings.retry_seconds * 4 ** max(0, upload.processing_attempts - 1), retry_after)
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
            upload.recovery_required = False
            if upload.asset_cleanup_after is None:
                upload.asset_cleanup_after = now + timedelta(hours=24)
            upload.original_cleanup_after = source_cleanup_time(upload, now)
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
        if upload.processing_status in {"ready", "blocked", "failed"}:
            release_processing(db, upload)
            upload.original_cleanup_after = source_cleanup_time(upload, now)
        upload.processing_claim = upload.processing_lease_until = None
        db.commit()
        return failure is None


def run_once(sessions=SessionLocal, settings: Settings | None = None, control: WorkerControl | None = None) -> bool:
    settings = settings or Settings.from_env()
    if control and control.paused.is_set():
        return False
    work = claim_work(sessions, settings, datetime.now(timezone.utc))
    if work is None:
        return False
    logger.info("Image processing started worker_id=%s job_id=%s", control.worker_id if control else "manual", work.id)
    stored: list[tuple[Output, str]] = []
    try:
        data = read_image(work.key)
        if len(data) != work.size_bytes:
            raise ValueError("Original size mismatch.")
        outputs = process_image(data, work.purpose, work.content_type)
        # Screen all pixels of the display master (no signed/loopback fetch needed).
        result = moderate_content("Student image upload", (image_data_url(outputs[-1].data),))
        stored = [(output, f"{work.owner}/variants/{work.id}/{work.claim}/{output.name}.webp") for output in outputs]
        stage_outputs(sessions, work, stored)
        for output, key in stored:
            write_reserved(sessions, work, key, output.data, write_image)
        committed = finish_work(sessions, settings, work, stored, result, None)
        if committed:
            return True
    except (ModerationError, ValueError) as error:
        code = error.code if isinstance(error, ModerationError) else "invalid_image"
        logger.warning("Image processing failed worker_id=%s job_id=%s code=%s",
                       control.worker_id if control else "manual", work.id, code)
        if control and credential_error(code):
            control.pause(code, work.id)
        finish_work(sessions, settings, work, [], None,
                    code,
                    getattr(error, "retry_after", 0))
    except Exception:
        # Commit outcomes can be uncertain; never delete files that may be live.
        logger.error("Image processing interrupted worker_id=%s job_id=%s code=unexpected_failure",
                     control.worker_id if control else "manual", work.id)
        # Safe even after an uncertain success commit: a cleared/replaced claim
        # cannot be changed. Persist preservation when the claim is still ours.
        try:
            finish_work(sessions, settings, work, [], None, "unexpected_failure")
        except Exception:
            pass  # A database outage leaves the durable lease for recovery.
        return True
    if control and control.paused.is_set():
        return True  # No further Storage calls with credentials known to be broken.
    try:
        cleanup_attempt(sessions, [key for _, key in stored], remove_images)
    except ModerationError:
        logger.error("Unable to remove incomplete image versions.")
    return True


def cleanup_original_once(sessions=SessionLocal) -> bool:
    """Remove terminal/expired source inputs after their upload capabilities expire.

    Repeated deletes are safe. Retain the short row lock to serialize this one
    bounded Storage delete; provider screening never holds a database transaction.
    """
    now = datetime.now(timezone.utc)
    with sessions() as db:
        expire_unfinished(db, now)
        db.commit()
        upload = db.scalar(select(ImageUpload).where(
            ImageUpload.processing_status.in_(["ready", "blocked", "failed"]),
            ImageUpload.recovery_required.is_(False),
            ImageUpload.original_deleted_at.is_(None), ImageUpload.original_cleanup_after <= now,
        ).order_by(ImageUpload.original_cleanup_after).limit(1).with_for_update(skip_locked=True))
        if upload is None:
            return False
        if upload.processing_status in {"ready", "blocked"}:
            expected = {"post": {"preview", "expanded"}, "avatar": {"avatar_small", "avatar_large"}, "banner": {"banner"}}[upload.purpose]
            confirmed = set(db.scalars(select(ImageVariant.name).join(ImageStorageObject,
                ImageStorageObject.object_key == ImageVariant.object_key).where(
                ImageVariant.image_upload_id == upload.id, ImageStorageObject.confirmed_at.is_not(None),
                ImageStorageObject.deleted_at.is_(None))).all())
            if not expected <= confirmed:
                upload.original_cleanup_error = "versions_unavailable"
                upload.original_cleanup_after = now + timedelta(minutes=5)
                db.commit()
                return True  # Preserve input without starving other cleanup jobs.
        try:
            delete_recorded(db, [upload.object_key], remove_images)
            upload.original_deleted_at = now
            upload.original_cleanup_error = None
        except ModerationError as error:
            if credential_error(error.code):
                raise
            upload.original_cleanup_error = error.code
            upload.original_cleanup_after = now + timedelta(minutes=5)
        db.commit()
        return True


def run_worker(stop: Event, settings: Settings, control: WorkerControl | None = None):
    control = control or WorkerControl()
    last_error = None
    while not stop.is_set() and not control.paused.is_set():
        try:
            staged = cleanup_staged_once(SessionLocal, remove_images)
            worked = run_once(settings=settings, control=control)
            if control.paused.is_set():
                break
            cleaned = cleanup_original_once()
            retired = retire_unused_once()
            deleted = delete_retired_once()
            orphan = cleanup_orphan_once()
            last_error = None
        except Exception as error:
            if isinstance(error, ModerationError) and credential_error(error.code):
                control.pause(error.code, "cleanup")
                break
            signature = type(error).__name__
            if signature != last_error:
                logger.error("Image worker unavailable; check image migrations and configuration.")
                last_error = signature
            stop.wait(30)
            continue
        if not any((worked, cleaned, staged, retired, deleted, orphan)):
            stop.wait(settings.poll_seconds)
