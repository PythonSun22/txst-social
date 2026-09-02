from uuid import UUID

from pydantic import BaseModel, ConfigDict


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