"""Pydantic schemas for API requests and responses."""

from uuid import UUID
from typing import Literal
from pydantic import BaseModel, ConfigDict


StudentLevel = Literal["freshman", "sophomore", "junior", "senior", "graduate"]


class HealthResponse(BaseModel):
    status: str


class DatabaseHealthResponse(BaseModel):
    database: str
    profile_count: int


class ProfileCreate(BaseModel):
    """What a student may set about themselves (FR-06)."""

    username: str
    display_name: str | None = None
    bio: str | None = None
    major: str | None = None
    student_level: StudentLevel | None = None
    profile_image_url: str | None = None

    # FR-11: a home college is a real college space, not free text.
    home_college_id: UUID | None = None


class ProfileResponse(ProfileCreate):
    """A public profile (FR-05).

    Deliberately no email: it is on the row so FR-01 and FR-02 can be enforced
    in the database, not so it can be served to anyone who asks.
    """

    id: UUID

    post_karma: int = 0
    comment_karma: int = 0

    model_config = ConfigDict(from_attributes=True)


class HomeCollegeResponse(BaseModel):
    """Display-safe college details resolved from a profile's foreign key."""

    id: UUID
    name: str
    short_name: str
    slug: str
    accent_hex: str | None = None
    crest_key: str | None = None


class CurrentProfileResponse(ProfileResponse):
    """The caller's profile and FR-02 verification state, without private account fields."""

    email_verified: bool
    home_college: HomeCollegeResponse | None = None
    followed_space_count: int = 0
    joined_community_count: int = 0
