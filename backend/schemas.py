"""Pydantic schemas for API requests and responses."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str


class DatabaseHealthResponse(BaseModel):
    database: str
    profile_count: int


class ProfileCreate(BaseModel):
    username: str
    display_name: str | None = None
    bio: str | None = None
    college: str | None = None
    major: str | None = None
    profile_image_url: str | None = None


class ProfileResponse(ProfileCreate):
    id: UUID

    model_config = ConfigDict(from_attributes=True)