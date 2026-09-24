"""FR-32 upload contracts; these describe an asset independently of any post."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

MAX_IMAGE_BYTES = 10_000_000
IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
IMAGE_BUCKET = "post-images"


class ImageUploadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    original_name: str = Field(min_length=1, max_length=255)
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    size_bytes: int = Field(gt=0, le=MAX_IMAGE_BYTES, strict=True)
    width: int = Field(gt=0, le=2_147_483_647, strict=True)
    height: int = Field(gt=0, le=2_147_483_647, strict=True)


class ImageUploadResponse(ImageUploadCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bucket_id: str
    object_key: str
    created_at: datetime
    uploaded_at: datetime | None


class ImageUploadTicket(BaseModel):
    upload: ImageUploadResponse
    token: str


class ImageUploadPolicy(BaseModel):
    max_bytes: int = MAX_IMAGE_BYTES
    allowed_types: list[str] = list(IMAGE_TYPES)


class ImagePreviewResponse(BaseModel):
    url: str
    expires_in: int = 300
