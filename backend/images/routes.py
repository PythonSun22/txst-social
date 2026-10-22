"""FR-02/FR-32/FR-90: reserve, upload directly to Storage, then confirm metadata."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import bearer, get_current_profile, require_verified_profile
from database import get_db
from images.schemas import (
    IMAGE_BUCKET, IMAGE_TYPES, ImagePreviewResponse, ImageUploadCreate,
    ImageUploadPolicy, ImageUploadResponse, ImageUploadTicket,
    ImageVariantResponse, VariantName,
    ImageUploadBatch, ImageStorageBudget, PROCESSING_HEADROOM, SOURCE_GRACE_SECONDS,
    UPLOAD_RESERVATION_SECONDS,
)
from images import storage as image_storage
from images.limits import reserve_upload_slot
from images.budget import check_capacity, expire_unfinished, storage_budget
from models import ImageStorageObject, ImageUpload, ImageVariant, Profile

router = APIRouter(prefix="/images", tags=["images"])


def upload_response(db: Session, upload: ImageUpload) -> ImageUploadResponse:
    # Unflushed in-memory records may not yet have server defaults.
    values = {name: getattr(upload, name) for name in (
        "id", "object_key", "original_name", "content_type", "size_bytes", "width", "height",
        "created_at", "uploaded_at")}
    return ImageUploadResponse(**values, bucket_id=upload.bucket_id or IMAGE_BUCKET,
        purpose=upload.purpose or "post", processing_status=upload.processing_status or "pending",
        original_deleted_at=upload.original_deleted_at,
        variants=[ImageVariantResponse.model_validate(v) for v in db.scalars(
            select(ImageVariant).where(ImageVariant.image_upload_id == upload.id).order_by(ImageVariant.name)
        ).all()])


def own_upload(db: Session, upload_id: UUID, profile: Profile) -> ImageUpload:
    upload = db.get(ImageUpload, upload_id)
    if upload is None or upload.owner_id != profile.id or upload.deleted_at is not None:
        raise HTTPException(404, "Image upload not found.")
    return upload


@router.get("/policy", response_model=ImageUploadPolicy)
def upload_policy() -> ImageUploadPolicy:
    """Selection, transfer and account limits supplied to every upload UI."""
    return ImageUploadPolicy()


@router.post("", response_model=ImageUploadTicket, status_code=201)
def create_upload(
    payload: ImageUploadCreate, response: Response,
    profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db),
) -> ImageUploadTicket:
    return reserve_images([payload], response, profile, db)[0]


def reserve_images(images: list[ImageUploadCreate], response: Response, profile: Profile, db: Session) -> list[ImageUploadTicket]:
    created_at = reserve_upload_slot(db, profile.id, len(images))
    expire_unfinished(db, created_at, profile.id)
    check_capacity(db, profile.id, images)
    uploads = []
    for payload in images:
        upload_id = uuid4()
        upload = ImageUpload(id=upload_id, owner_id=profile.id, bucket_id=IMAGE_BUCKET, created_at=created_at,
            object_key=f"{profile.id}/{upload_id}.{IMAGE_TYPES[payload.content_type]}",
            upload_method="authenticated",
            upload_expires_at=created_at + timedelta(seconds=UPLOAD_RESERVATION_SECONDS),
            processing_reserved_bytes=PROCESSING_HEADROOM[payload.purpose], **payload.model_dump())
        db.add(upload)
        uploads.append(upload)
    # Storage's RLS must see the reservation through a separate connection.
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    tickets = []
    for upload in uploads:
        db.refresh(upload)
        tickets.append(ImageUploadTicket(upload=upload_response(db, upload), upload_expires_at=upload.upload_expires_at))
    return tickets


@router.post("/batch", response_model=list[ImageUploadTicket], status_code=201)
def create_upload_batch(payload: ImageUploadBatch, response: Response,
    profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db)):
    return reserve_images(payload.images, response, profile, db)


@router.get("/budget", response_model=ImageStorageBudget)
def get_storage_budget(response: Response, profile: Profile = Depends(get_current_profile), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return storage_budget(db, profile.id)


@router.post("/{upload_id}/complete", response_model=ImageUploadResponse)
def complete_upload(
    upload_id: UUID, response: Response,
    profile: Profile = Depends(require_verified_profile),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> ImageUploadResponse:
    upload = own_upload(db, upload_id, profile)
    # The Storage write guard takes this same lock. Close authorization and
    # reconcile the ledger in one transaction, including concurrent completions.
    db.refresh(upload, with_for_update=True)
    if upload.deleted_at is not None:
        raise HTTPException(404, "Image upload not found.")
    response.headers["Cache-Control"] = "no-store"
    if upload.uploaded_at is not None:
        return upload_response(db, upload)  # Safe after an uncertain transfer.
    expires_at = (upload.upload_expires_at if upload.upload_method == "authenticated" else
                  upload.original_cleanup_after or upload.created_at + timedelta(seconds=SOURCE_GRACE_SECONDS))
    if (upload.original_deleted_at is not None or upload.processing_status == "failed"
            or expires_at <= datetime.now(timezone.utc)):
        raise HTTPException(410, "This upload reservation expired. Select the image again.")
    info = image_storage.object_info(upload.object_key, credentials.credentials)
    # Check Storage's actual object metadata, not a client "success" flag.
    if info.get("size") != upload.size_bytes or info.get("content_type") != upload.content_type:
        raise HTTPException(409, "Stored file size or type differs from the selected image. Select it again.")
    upload.uploaded_at = datetime.now(timezone.utc)
    original = db.scalar(select(ImageStorageObject).where(ImageStorageObject.object_key == upload.object_key).with_for_update())
    if original is None or original.deleted_at is not None:
        raise HTTPException(409, "Image storage reservation is unavailable.")
    original.size_bytes = info["size"]
    original.confirmed_at = upload.uploaded_at
    db.commit()
    db.refresh(upload)
    return upload_response(db, upload)


@router.get("", response_model=list[ImageUploadResponse])
def list_uploads(
    response: Response, profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> list[ImageUploadResponse]:
    response.headers["Cache-Control"] = "no-store"
    uploads = list(db.scalars(
        select(ImageUpload).where(
            ImageUpload.owner_id == profile.id, ImageUpload.deleted_at.is_(None),
            ImageUpload.uploaded_at.is_not(None),
        ).order_by(ImageUpload.created_at.desc(), ImageUpload.id.desc()).limit(20)
    ).all())
    return [upload_response(db, upload) for upload in uploads]


@router.get("/{upload_id}", response_model=ImageUploadResponse)
def get_upload(upload_id: UUID, response: Response,
               profile: Profile = Depends(get_current_profile), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return upload_response(db, own_upload(db, upload_id, profile))


@router.get("/{upload_id}/published-preview", response_model=ImagePreviewResponse)
def preview_published_profile_image(upload_id: UUID, response: Response,
    variant: VariantName = Query(default="avatar_small"),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    """Public access only to approved assets currently displayed by active profiles."""
    upload = db.get(ImageUpload, upload_id)
    active_profile = db.scalar(select(Profile.id).where(
        Profile.deleted_at.is_(None), Profile.suspended_at.is_(None),
        (Profile.profile_image_upload_id == upload_id) | (Profile.banner_image_upload_id == upload_id),
    ))
    if upload is None or upload.deleted_at is not None or upload.processing_status != "ready" or active_profile is None:
        raise HTTPException(404, "Profile image not found.")
    version = db.get(ImageVariant, (upload.id, variant))
    if version is None:
        raise HTTPException(404, "Image version not found.")
    response.headers["Cache-Control"] = "no-store"
    return ImagePreviewResponse(url=image_storage.sign_preview(version.object_key, credentials.credentials if credentials else None))


@router.get("/{upload_id}/preview", response_model=ImagePreviewResponse)
def preview_upload(
    upload_id: UUID, response: Response,
    profile: Profile = Depends(get_current_profile),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
    variant: VariantName | None = Query(default=None),
) -> ImagePreviewResponse:
    upload = own_upload(db, upload_id, profile)
    if upload.uploaded_at is None:
        raise HTTPException(409, "Finish uploading the image before previewing it.")
    response.headers["Cache-Control"] = "no-store"
    name = variant or {"post": "expanded", "avatar": "avatar_large", "banner": "banner"}[upload.purpose or "post"]
    version = db.get(ImageVariant, (upload.id, name))
    if version is None:
        raise HTTPException(409, "Image versions are not ready. Processing or screening may still be pending.")
    return ImagePreviewResponse(url=image_storage.sign_preview(version.object_key, credentials.credentials))
