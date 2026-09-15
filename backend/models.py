"""SQLAlchemy database models."""

import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Profile(Base):
    """Mirrors public.profiles.

    Kept in step with supabase/migrations by hand — when one changes, change
    both in the same commit.

    id is auth.users(id): Supabase Auth owns credentials, this table owns
    everything the application needs about a person.
    """

    __tablename__ = "profiles"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )

    username: Mapped[str] = mapped_column(
        String,
        unique=True,
        nullable=False,
    )

    display_name: Mapped[str | None] = mapped_column(String)
    bio: Mapped[str | None] = mapped_column(Text)
    major: Mapped[str | None] = mapped_column(String)
    profile_image_url: Mapped[str | None] = mapped_column(String)

    # Mirrored from auth.users by trigger. Never write these from here.
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True))

    email_verified_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    email: Mapped[str | None] = mapped_column(String)

    # Replaces the old free-text `college`: FR-11 makes a home college a
    # reference to a real college space.
    home_college_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # Denormalized caches of likes received (FR-07).
    post_karma: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comment_karma: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    suspended_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True))