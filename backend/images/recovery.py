"""Owner-requested retries reuse an asset and reserve only missing job capacity."""
from datetime import datetime, timezone
from math import ceil

from fastapi import HTTPException
from sqlalchemy import select

from images.budget import storage_budget
from images.schemas import MAX_UNFINISHED_UPLOADS, PROCESSING_HEADROOM
from models import ImageStorageObject


def retry_image(db, upload):
    if upload.processing_status in {"pending", "processing", "ready"}:
        return  # Idempotent: concurrent retries cannot reserve headroom twice.
    if (upload.processing_status != "failed" or not upload.recovery_required
            or upload.deleted_at is not None or upload.original_deleted_at is not None or upload.uploaded_at is None):
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


def image_processing_state(upload):
    if upload.processing_status == "blocked":
        return "image_rejected", "This image was rejected by automatic screening."
    if upload.processing_status == "ready":
        return "ready", "Image processing and screening are complete."
    if upload.processing_status == "failed" and (upload.original_deleted_at is not None or upload.uploaded_at is None):
        return "failed", "The saved image input is unavailable. Select another image."
    if upload.processing_error or (upload.recovery_required and upload.processing_status == "failed"):
        return "service_unavailable", "Image processing is unavailable. Your saved input is preserved for retry."
    if upload.processing_status == "failed":
        return "failed", "This image could not be processed. Select another image."
    return "waiting", "Waiting for image processing and moderation."
