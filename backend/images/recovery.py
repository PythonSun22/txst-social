"""Owner-requested retries reuse an asset and reserve only missing job capacity."""
from datetime import datetime, timezone
from math import ceil

from fastapi import HTTPException
from sqlalchemy import select

from images.budget import storage_budget
from images.lifecycle import PROCESSING_STATUSES, can_retry_image
from images.schemas import MAX_UNFINISHED_UPLOADS, PROCESSING_HEADROOM
from models import ImageStorageObject


def retry_image(db, upload):
    if upload.processing_status in (*PROCESSING_STATUSES, "ready"):
        return  # Idempotent: concurrent retries cannot reserve headroom twice.
    if not can_retry_image(upload):
        raise HTTPException(409, "This image cannot be retried. Select a new image.")
    now = datetime.now(timezone.utc)
    if upload.processing_next_attempt_at > now:
        wait = max(1, ceil((upload.processing_next_attempt_at-now).total_seconds()))
        raise HTTPException(429, "Wait before retrying this image.", headers={"Retry-After": str(wait)})
    source = db.scalar(select(ImageStorageObject).where(ImageStorageObject.object_key == upload.object_key).with_for_update())
    if source is None or source.deleted_at is not None or source.confirmed_at is None:
        raise HTTPException(409, "The saved image input is unavailable. Select a new image.")
    budget = storage_budget(db, upload.owner_id)
    required = max(0, PROCESSING_HEADROOM[upload.purpose] - upload.processing_reserved_bytes)
    if budget.unfinished_uploads >= MAX_UNFINISHED_UPLOADS:
        raise HTTPException(409, "Wait for another image job to finish before retrying.")
    if required > budget.available_bytes:
        raise HTTPException(413, "Not enough processing space to retry. Your saved input still counts toward storage.")
    upload.processing_reserved_bytes += required
    upload.processing_status = "pending"
    upload.processing_attempts = 0
    upload.processing_next_attempt_at = now
    upload.processing_claim = upload.processing_lease_until = None
    upload.processing_error = None
    upload.asset_cleanup_after = None
    # recovery_required remains true until a complete verdict+versions commit.
    db.flush()
