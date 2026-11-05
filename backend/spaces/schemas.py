"""FR-24/70–73: public space metadata and viewer-specific follow state."""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SpaceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=80)
    slug: str = Field(min_length=3, max_length=21, pattern=r"^[a-z0-9_]+$")
    description: str = Field(min_length=1, max_length=500)
    rules: str = Field(default="", max_length=2000)
    icon_image_upload_id: UUID | None = None

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, value):
        if isinstance(value, str):
            value = value.strip().lower()
            if value == "create":
                raise ValueError("This URL handle is reserved. Choose another.")
        return value


class SpaceResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    rules: str
    kind: Literal["college", "community"]
    is_seeded: bool
    icon_image_upload_id: UUID | None = None
    follower_count: int
    is_following: bool


class SpaceFollowResponse(BaseModel):
    following: bool
    follower_count: int
