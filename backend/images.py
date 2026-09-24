"""FR-02/FR-32/FR-90: reserve, upload directly to Storage, then confirm metadata."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import bearer, get_current_profile, require_verified_profile
from database import get_db
from image_schemas import (
    IMAGE_BUCKET, IMAGE_TYPES, ImagePreviewResponse, ImageUploadCreate,
    ImageUploadPolicy, ImageUploadResponse, ImageUploadTicket,
)
import image_storage
from models import ImageUpload, Profile

router = APIRouter(prefix="/images", tags=["images"])


def own_upload(db: Session, upload_id: UUID, profile: Profile) -> ImageUpload:
    upload = db.get(ImageUpload, upload_id)
    if upload is None or upload.owner_id != profile.id or upload.deleted_at is not None:
        raise HTTPException(404, "Image upload not found.")
    return upload


@router.get("/policy", response_model=ImageUploadPolicy)
def upload_policy() -> ImageUploadPolicy:
    """The browser uses the same byte/type limits as the API and Storage bucket."""
    return ImageUploadPolicy()


@router.post("", response_model=ImageUploadTicket, status_code=201)
def create_upload(
    payload: ImageUploadCreate, response: Response,
    profile: Profile = Depends(require_verified_profile),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> ImageUploadTicket:
    upload_id = uuid4()
    upload = ImageUpload(
        id=upload_id, owner_id=profile.id, bucket_id=IMAGE_BUCKET,
        object_key=f"{profile.id}/{upload_id}.{IMAGE_TYPES[payload.content_type]}",
        **payload.model_dump(),
    )
    db.add(upload)
    # Storage's RLS must see the reservation through a separate connection.
    db.commit()
    db.refresh(upload)
    token = image_storage.sign_upload(upload.object_key, credentials.credentials)
    response.headers["Cache-Control"] = "no-store"
    return ImageUploadTicket(upload=ImageUploadResponse.model_validate(upload), token=token)


@router.post("/{upload_id}/complete", response_model=ImageUploadResponse)
def complete_upload(
    upload_id: UUID, response: Response,
    profile: Profile = Depends(require_verified_profile),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> ImageUpload:
    upload = own_upload(db, upload_id, profile)
    response.headers["Cache-Control"] = "no-store"
    if upload.uploaded_at is not None:
        return upload  # Safe to retry after the browser loses a successful response.
    info = image_storage.object_info(upload.object_key, credentials.credentials)
    # Check Storage's actual object metadata, not a client "success" flag.
    if info.get("size") != upload.size_bytes or info.get("content_type") != upload.content_type:
        raise HTTPException(409, "Stored file size or type differs from the selected image. Select it again.")
    upload.uploaded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(upload)
    return upload


@router.get("", response_model=list[ImageUploadResponse])
def list_uploads(
    response: Response, profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> list[ImageUpload]:
    response.headers["Cache-Control"] = "no-store"
    return list(db.scalars(
        select(ImageUpload).where(
            ImageUpload.owner_id == profile.id, ImageUpload.deleted_at.is_(None),
            ImageUpload.uploaded_at.is_not(None),
        ).order_by(ImageUpload.created_at.desc(), ImageUpload.id.desc()).limit(20)
    ).all())


@router.get("/{upload_id}/preview", response_model=ImagePreviewResponse)
def preview_upload(
    upload_id: UUID, response: Response,
    profile: Profile = Depends(get_current_profile),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> ImagePreviewResponse:
    upload = own_upload(db, upload_id, profile)
    if upload.uploaded_at is None:
        raise HTTPException(409, "Finish uploading the image before previewing it.")
    response.headers["Cache-Control"] = "no-store"
    return ImagePreviewResponse(url=image_storage.sign_preview(upload.object_key, credentials.credentials))
