"""Pydantic contracts for public and current-user profile APIs."""

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StudentLevel(StrEnum):
    FRESHMAN = "freshman"
    SOPHOMORE = "sophomore"
    JUNIOR = "junior"
    SENIOR = "senior"
    GRADUATE = "graduate"


STUDENT_LEVELS = tuple(StudentLevel)


class ProfileCreate(BaseModel):
    """What a student may set about themselves (FR-06)."""

    username: str
    display_name: str | None = None
    bio: str | None = None
    major: str | None = None
    major_id: UUID | None = None
    student_level: StudentLevel | None = None
    profile_image_url: str | None = None
    profile_image_upload_id: UUID | None = None
    banner_image_upload_id: UUID | None = None

    # FR-11: a home college is a real college space, not free text.
    home_college_id: UUID | None = None


class ProfileResponse(ProfileCreate):
    """A public profile (FR-05), deliberately excluding private account fields."""

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


class MajorOptionResponse(BaseModel):
    id: UUID
    name: str
    degree: str
    college_id: UUID

    model_config = ConfigDict(from_attributes=True)


class ProfileOptionsResponse(BaseModel):
    colleges: list[HomeCollegeResponse]
    majors: list[MajorOptionResponse]
    student_levels: list[StudentLevel]


class ProfileUpdate(BaseModel):
    """Fields students may edit; identity and counters are never accepted."""

    display_name: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=500)
    major_id: UUID | None = None
    home_college_id: UUID | None = None
    student_level: StudentLevel | None = None
    profile_image_upload_id: UUID | None = None
    banner_image_upload_id: UUID | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("display_name", "bio")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class CurrentProfileResponse(ProfileResponse):
    """The caller's profile and verification state, without private fields."""

    email_verified: bool
    home_college: HomeCollegeResponse | None = None
    followed_space_count: int = 0
    joined_community_count: int = 0
