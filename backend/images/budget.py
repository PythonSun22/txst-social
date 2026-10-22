"""Durable accounting for source capabilities, processing headroom and object writes."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import case, func, or_, select, true, update

from images.schemas import (ACCOUNT_STORAGE_BYTES, MAX_IMAGE_BYTES, MAX_UNFINISHED_UPLOADS,
                            PROCESSING_HEADROOM, SOURCE_GRACE_SECONDS, ImageStorageBudget)
from models import ImageStorageObject, ImageUpload, ImageVariant
from moderation.client import ModerationError


def storage_budget(db, owner) -> ImageStorageBudget:
    # ONE statement/snapshot: processing converts reservations into actual objects atomically.
    objects = select(
        func.coalesce(func.sum(case((ImageStorageObject.covered_by_reservation.is_(False), ImageStorageObject.size_bytes), else_=0)), 0).label("charged"),
        func.coalesce(func.sum(case((ImageStorageObject.confirmed_at.is_not(None), ImageStorageObject.size_bytes), else_=0)), 0).label("stored"),
    ).where(ImageStorageObject.owner_id == owner, ImageStorageObject.deleted_at.is_(None)).subquery()
    jobs = select(
        func.coalesce(func.sum(ImageUpload.processing_reserved_bytes), 0).label("held"),
        func.count().filter(ImageUpload.processing_status.in_(["pending", "processing"]),
                            ImageUpload.deleted_at.is_(None)).label("unfinished"),
    ).where(ImageUpload.owner_id == owner).subquery()
    charged, stored, held, unfinished = db.execute(select(objects.c.charged, objects.c.stored, jobs.c.held, jobs.c.unfinished)
        .select_from(objects.join(jobs, true()))).one()
    used = int(charged + held)
    return ImageStorageBudget(stored_bytes=int(stored), reserved_bytes=max(0, used - int(stored)),
        used_bytes=used, available_bytes=max(0, ACCOUNT_STORAGE_BYTES - used), unfinished_uploads=int(unfinished))


def release_processing(db, upload):
    # Orphan writes become individually charged when their covering reservation ends.
    db.execute(update(ImageStorageObject).where(ImageStorageObject.image_upload_id == upload.id,
        ImageStorageObject.covered_by_reservation.is_(True)).values(covered_by_reservation=False))
    upload.processing_reserved_bytes = 0


def expire_unfinished(db, now, owner=None):
    query = select(ImageUpload).where(ImageUpload.processing_status.in_(["pending", "processing"]),
        or_(ImageUpload.deleted_at.is_not(None),
            (ImageUpload.uploaded_at.is_(None) & (ImageUpload.original_cleanup_after <= now))))
    if owner is not None:
        query = query.where(ImageUpload.owner_id == owner)
    for upload in db.scalars(query.with_for_update(skip_locked=True)).all():
        upload.processing_status = "failed"
        upload.processing_error = "upload_expired"
        upload.processing_claim = upload.processing_lease_until = None
        upload.original_cleanup_after = max(now, upload.original_cleanup_after or now,
            upload.created_at + timedelta(seconds=SOURCE_GRACE_SECONDS))
        release_processing(db, upload)
    db.flush()


def check_capacity(db, owner, images):
    budget = storage_budget(db, owner)
    if budget.unfinished_uploads + len(images) > MAX_UNFINISHED_UPLOADS:
        raise HTTPException(409, f"At most {MAX_UNFINISHED_UPLOADS} unfinished image uploads are allowed per account. "
            f"You have {budget.unfinished_uploads}; wait for processing or expired-upload cleanup before adding {len(images)} more.")
    required = sum(MAX_IMAGE_BYTES + PROCESSING_HEADROOM[image.purpose] for image in images)
    if required > budget.available_bytes:
        raise HTTPException(413, f"These {len(images)} image upload(s) need {required / 1_000_000:.2f} MB of reserved capacity, "
            f"including temporary originals and processing space. You have {budget.available_bytes / 1_000_000:.2f} MB available "
            "in your 50 MB account budget. Four maximum-size post images need 48 MB while originals are retained; "
            "existing images may leave too little room. No files from this batch have been transferred.")


def stage_outputs(sessions, work, outputs):
    """Persist EVERY prospective write before Storage, including uncertain writes."""
    now = datetime.now(timezone.utc)
    with sessions() as db:
        upload = db.scalar(select(ImageUpload).where(ImageUpload.id == work.id).with_for_update())
        if (upload is None or upload.processing_claim != work.claim or upload.deleted_at is not None
                or upload.processing_lease_until is None or upload.processing_lease_until <= now):
            raise ModerationError("Image job expired.", code="stale_image_job")
        previous = db.scalar(select(func.coalesce(func.sum(ImageStorageObject.size_bytes), 0)).where(
            ImageStorageObject.image_upload_id == work.id, ImageStorageObject.covered_by_reservation.is_(True),
            ImageStorageObject.deleted_at.is_(None)))
        if previous + sum(len(output.data) for output, _ in outputs) > upload.processing_reserved_bytes:
            raise ModerationError("Processing capacity is occupied by incomplete writes.", code="processing_capacity")
        for output, key in outputs:
            db.add(ImageStorageObject(object_key=key, owner_id=work.owner, image_upload_id=work.id,
                kind="variant", size_bytes=len(output.data), covered_by_reservation=True, attempt_claim=work.claim))
        db.commit()


def write_reserved(sessions, work, key, data, write):
    # A bounded Storage call holds the object lock. Cleanup uses the same lock:
    # an old worker cannot recreate a file after its capacity has been released.
    with sessions() as db:
        obj = db.scalar(select(ImageStorageObject).where(ImageStorageObject.object_key == key).with_for_update())
        active = db.scalar(select(ImageUpload.id).where(ImageUpload.id == work.id,
            ImageUpload.processing_claim == work.claim, ImageUpload.processing_lease_until > func.clock_timestamp(),
            ImageUpload.deleted_at.is_(None)))
        if obj is None or obj.deleted_at is not None or obj.attempt_claim != work.claim or active is None or obj.size_bytes != len(data):
            raise ModerationError("Image write reservation expired.", code="stale_image_job")
        write(key, data)
        obj.confirmed_at = datetime.now(timezone.utc)
        db.commit()


def delete_recorded(db, keys, remove):
    """Callers commit only after Storage confirms deletion; failures keep all charges."""
    objects = db.scalars(select(ImageStorageObject).where(ImageStorageObject.object_key.in_(keys))
        .order_by(ImageStorageObject.object_key).with_for_update()).all()
    remove(keys)
    now = datetime.now(timezone.utc)
    for obj in objects:
        obj.deleted_at = now


def cleanup_attempt(sessions, keys, remove):
    if not keys:
        return
    with sessions() as db:
        delete_recorded(db, keys, remove)
        db.commit()


def cleanup_staged_once(sessions, remove):
    """Interrupted attempt files are not live variants; active jobs retain their locks."""
    with sessions() as db:
        obj = db.scalar(select(ImageStorageObject).where(
            ImageStorageObject.kind == "variant", ImageStorageObject.deleted_at.is_(None),
            ImageStorageObject.attempt_claim.is_not(None),
            ~select(ImageVariant.image_upload_id).where(ImageVariant.object_key == ImageStorageObject.object_key).exists(),
            ~select(ImageUpload.id).where(ImageUpload.id == ImageStorageObject.image_upload_id,
                ImageUpload.processing_claim == ImageStorageObject.attempt_claim,
                ImageUpload.processing_lease_until > func.clock_timestamp()).exists(),
        ).order_by(ImageStorageObject.created_at).limit(1).with_for_update(skip_locked=True))
        if obj is None:
            return False
        delete_recorded(db, [obj.object_key], remove)
        db.commit()
        return True
