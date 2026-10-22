"""FR-32: account-wide rolling limits on original upload reservations."""

from datetime import datetime, timedelta
from math import ceil
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from images.schemas import UPLOADS_PER_MINUTE, UPLOADS_PER_HOUR
from models import ImageUpload, Profile


def reserve_upload_slot(db: Session, owner_id: UUID, count: int = 1) -> datetime:
    """Hold the account lock through insertion/commit in the calling transaction.

    Count all reservations, including incomplete, blocked and soft-deleted ones.
    Variants and completion retries do not create reservations. The lock is in
    PostgreSQL so concurrent requests across API processes share the same budget.
    """
    db.execute(select(Profile.id).where(Profile.id == owner_id).with_for_update())
    now = db.scalar(select(func.clock_timestamp()))  # After the lock; one clock across API hosts.
    recent = list(db.scalars(select(ImageUpload.created_at).where(
        ImageUpload.owner_id == owner_id,
        ImageUpload.created_at > now - timedelta(hours=1),
    ).order_by(ImageUpload.created_at)).all())

    waits = []
    for seconds, maximum in ((60, UPLOADS_PER_MINUTE), (3600, UPLOADS_PER_HOUR)):
        window = [created for created in recent if created > now - timedelta(seconds=seconds)]
        if len(window) + count > maximum:
            waits.append(ceil((window[-(maximum - count + 1)] + timedelta(seconds=seconds) - now).total_seconds()))
    if waits:
        retry_after = max(1, *waits)
        raise HTTPException(429,
            f"Image upload limit reached ({UPLOADS_PER_MINUTE} per minute, "
            f"{UPLOADS_PER_HOUR} per hour across posts, profile photos and banners). "
            f"Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after), "Cache-Control": "no-store"})
    return now
