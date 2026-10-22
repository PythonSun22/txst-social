"""FR-32 upload contracts; these describe an asset independently of any post."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

MAX_IMAGE_BYTES = 10_000_000
MAX_POST_IMAGES = 4
UPLOADS_PER_MINUTE = 10
UPLOADS_PER_HOUR = 40
ACCOUNT_STORAGE_BYTES = 50_000_000
MAX_UNFINISHED_UPLOADS = 10
# Enforced by the encoder as well as the accounting reservation.
VARIANT_MAX_BYTES = {"preview": 250_000, "expanded": 1_750_000,
                     "avatar_small": 50_000, "avatar_large": 200_000, "banner": 1_000_000}
PROCESSING_HEADROOM = {"post": 2_000_000, "avatar": 250_000, "banner": 1_000_000}
SOURCE_GRACE_SECONDS = 7500
IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
IMAGE_BUCKET = "post-images"
ImagePurpose = Literal["post", "avatar", "banner"]
VariantName = Literal["preview", "expanded", "avatar_small", "avatar_large", "banner"]


class ImageUploadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    original_name: str = Field(min_length=1, max_length=255)
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    size_bytes: int = Field(gt=0, le=MAX_IMAGE_BYTES, strict=True)
    width: int = Field(gt=0, le=2_147_483_647, strict=True)
    height: int = Field(gt=0, le=2_147_483_647, strict=True)
    purpose: ImagePurpose = "post"


class ImageVariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: VariantName
    width: int
    height: int
    size_bytes: int
    content_type: str


class ImageUploadResponse(ImageUploadCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bucket_id: str
    object_key: str
    created_at: datetime
    uploaded_at: datetime | None
    processing_status: Literal["pending", "processing", "ready", "blocked", "failed"] = "pending"
    variants: list[ImageVariantResponse] = Field(default_factory=list)
    original_deleted_at: datetime | None = None


class ImageUploadTicket(BaseModel):
    upload: ImageUploadResponse
    token: str


class ImageUploadBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    images: list[ImageUploadCreate] = Field(min_length=1, max_length=MAX_POST_IMAGES)


class ImageStorageBudget(BaseModel):
    limit_bytes: int = ACCOUNT_STORAGE_BYTES
    stored_bytes: int
    reserved_bytes: int
    used_bytes: int
    available_bytes: int
    unfinished_uploads: int
    max_unfinished_uploads: int = MAX_UNFINISHED_UPLOADS


class ImageUploadPolicy(BaseModel):
    max_bytes: int = MAX_IMAGE_BYTES
    allowed_types: list[str] = list(IMAGE_TYPES)
    max_images_per_post: int = MAX_POST_IMAGES
    uploads_per_minute: int = UPLOADS_PER_MINUTE
    uploads_per_hour: int = UPLOADS_PER_HOUR
    account_storage_bytes: int = ACCOUNT_STORAGE_BYTES
    max_unfinished_uploads: int = MAX_UNFINISHED_UPLOADS
    original_reservation_bytes: int = MAX_IMAGE_BYTES
    processing_headroom: dict[str, int] = PROCESSING_HEADROOM


class ImagePreviewResponse(BaseModel):
    url: str
    expires_in: int = 300
