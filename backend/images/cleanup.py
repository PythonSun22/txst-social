"""FR-32/34: reference-aware Storage deletion with durable retries and quota accounting.

Upload tombstones and audit/attachment metadata are retained. Only Storage object
bytes are hard-deleted; a failed/uncertain delete never releases their charge.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update

from database import SessionLocal
from images.budget import delete_recorded, release_processing
from images.schemas import SOURCE_GRACE_SECONDS
from images.worker_storage import remove_images
from models import ImageStorageObject, ImageUpload, ImageVariant, Post, PostMedia, Profile
from moderation.client import ModerationError


def has_live_reference(db, upload_id):
    # All undeleted posts count, including private/blocked/exhausted posts. An
    # author may still inspect them. Do not infer deletion from publication state.
    keys = select(ImageVariant.object_key).where(ImageVariant.image_upload_id == upload_id)
    original = select(ImageUpload.object_key).where(ImageUpload.id == upload_id)
    post = select(PostMedia.post_id).join(Post, Post.id == PostMedia.post_id).where(
        Post.deleted_at.is_(None), or_(PostMedia.image_upload_id == upload_id,
            PostMedia.object_key.in_(keys), PostMedia.object_key.in_(original))).exists()
    profile = select(Profile.id).where(Profile.deleted_at.is_(None), or_(
        Profile.profile_image_upload_id == upload_id, Profile.banner_image_upload_id == upload_id,
        (or_(Profile.pending_profile_image_upload_id == upload_id, Profile.pending_banner_image_upload_id == upload_id)
         & select(ImageUpload.id).where(ImageUpload.id == upload_id,
             ImageUpload.processing_status.not_in(["blocked", "failed"])).exists()),
    )).exists()
    return db.scalar(select(post | profile))


def retire_unused_once(sessions=SessionLocal):
    """Fence attachment creation before doing any network deletion."""
    now = datetime.now(timezone.utc)
    with sessions() as db:
        candidate = db.execute(select(ImageUpload.id, ImageUpload.owner_id).where(
            ImageUpload.deleted_at.is_(None), ImageUpload.files_deleted_at.is_(None),
            ImageUpload.asset_cleanup_after <= now,
        ).order_by(ImageUpload.asset_cleanup_after, ImageUpload.id).limit(1)).first()
        if candidate is None:
            return False
        identity, owner = candidate
        # Same order as post creation, profile editing and worker activation.
        locked = db.scalar(select(Profile.id).where(Profile.id == owner).with_for_update(skip_locked=True))
        if locked is None:
            return False
        upload = db.scalar(select(ImageUpload).where(ImageUpload.id == identity,
            ImageUpload.deleted_at.is_(None), ImageUpload.asset_cleanup_after <= now)
            .with_for_update(skip_locked=True))
        if upload is None:
            return False
        if has_live_reference(db, identity):
            upload.asset_cleanup_after = None  # Reference-removal triggers queue it again.
        elif upload.processing_lease_until is not None and upload.processing_lease_until > now:
            upload.asset_cleanup_after = upload.processing_lease_until + timedelta(seconds=1)
        else:
            # Clearing failed pending selections preserves the existing approved
            # profile image. Deleted profiles' obsolete references can also go.
            for field in ("profile_image_upload_id", "banner_image_upload_id"):
                db.execute(update(Profile).where(Profile.deleted_at.is_not(None), getattr(Profile, field) == identity)
                    .values({field: None}))
            for field in ("pending_profile_image_upload_id", "pending_banner_image_upload_id"):
                db.execute(update(Profile).where(getattr(Profile, field) == identity).values({field: None}))
            upload.deleted_at = now
            upload.asset_cleanup_after = now
            upload.asset_cleanup_error = None
            if upload.processing_status in {"pending", "processing"}:
                upload.processing_status = "failed"
                upload.processing_error = "unused_image"
            upload.processing_claim = upload.processing_lease_until = None
            release_processing(db, upload)
        db.commit()
        return True


def retry_time(now, attempts):
    return now + timedelta(seconds=min(3600, 60 * 2 ** min(max(0, attempts - 1), 6)))


def delete_retired_once(sessions=SessionLocal):
    now = datetime.now(timezone.utc)
    with sessions() as db:
        upload = db.scalar(select(ImageUpload).where(ImageUpload.deleted_at.is_not(None),
            ImageUpload.files_deleted_at.is_(None), ImageUpload.asset_cleanup_after <= now,
        ).order_by(ImageUpload.asset_cleanup_after, ImageUpload.id).limit(1).with_for_update(skip_locked=True))
        if upload is None:
            return False
        # Old/manual tombstones may predate reference guards. Preserve their
        # files rather than assuming every tombstone was retired by this worker.
        if has_live_reference(db, upload.id):
            upload.asset_cleanup_error = "live_reference"
            upload.asset_cleanup_after = now + timedelta(hours=24)
            db.commit()
            return True
        source_after = upload.original_cleanup_after or upload.created_at + timedelta(seconds=SOURCE_GRACE_SECONDS)
        source_due = source_after <= now
        objects = list(db.scalars(select(ImageStorageObject).where(
            ImageStorageObject.image_upload_id == upload.id, ImageStorageObject.deleted_at.is_(None))).all())
        keys = {obj.object_key for obj in objects if obj.kind != "original" or source_due}
        # Metadata can outlive ledger backfills/old interrupted writes. Delete all
        # known version keys too, even when Storage already reports them absent.
        keys.update(db.scalars(select(ImageVariant.object_key).where(ImageVariant.image_upload_id == upload.id)).all())
        if source_due and upload.original_deleted_at is None:
            keys.add(upload.object_key)
        upload.asset_cleanup_attempts += 1
        try:
            if keys:
                delete_recorded(db, sorted(keys), remove_images)
            if source_due:
                upload.original_deleted_at = upload.original_deleted_at or now
            upload.asset_cleanup_error = None
            if upload.original_deleted_at is None:
                upload.asset_cleanup_after = source_after
            else:
                upload.files_deleted_at = now
                upload.asset_cleanup_after = None
        except ModerationError as error:
            upload.asset_cleanup_error = error.code
            upload.asset_cleanup_after = retry_time(now, upload.asset_cleanup_attempts)
        db.commit()
        return True


def cleanup_orphan_once(sessions=SessionLocal):
    """Clean inventory backfill objects without upload rows, including legacy keys."""
    now = datetime.now(timezone.utc)
    with sessions() as db:
        candidate = db.execute(select(ImageStorageObject.object_key, ImageStorageObject.owner_id).where(
            ImageStorageObject.image_upload_id.is_(None), ImageStorageObject.deleted_at.is_(None),
            ImageStorageObject.cleanup_after <= now,
        ).order_by(ImageStorageObject.cleanup_after, ImageStorageObject.object_key).limit(1)).first()
        if candidate is None:
            return False
        key, owner = candidate
        if db.scalar(select(Profile.id).where(Profile.id == owner).with_for_update(skip_locked=True)) is None:
            return False
        obj = db.scalar(select(ImageStorageObject).where(ImageStorageObject.object_key == key,
            ImageStorageObject.deleted_at.is_(None), ImageStorageObject.cleanup_after <= now).with_for_update(skip_locked=True))
        if obj is None:
            return False
        raw_post = db.scalar(select(select(PostMedia.post_id).join(Post, Post.id == PostMedia.post_id)
            .where(PostMedia.object_key == key, Post.deleted_at.is_(None)).exists()))
        linked = list(db.scalars(select(ImageUpload.id).where(ImageUpload.object_key == key).union(
            select(ImageVariant.image_upload_id).where(ImageVariant.object_key == key))).all())
        protected = raw_post or any(has_live_reference(db, identity) for identity in linked)
        source_capability = db.scalar(select(select(ImageUpload.id).where(ImageUpload.object_key == key,
            ImageUpload.original_cleanup_after > now).exists()))
        if protected or source_capability:
            obj.cleanup_after = now + timedelta(hours=24)
        else:
            obj.cleanup_attempts += 1
            try:
                delete_recorded(db, [key], remove_images)
                obj.cleanup_error = None
            except ModerationError as error:
                obj.cleanup_error = error.code
                obj.cleanup_after = retry_time(now, obj.cleanup_attempts)
        db.commit()
        return True
