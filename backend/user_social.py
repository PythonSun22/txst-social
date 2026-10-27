"""Student search, public profiles, and one-way user follows."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from auth import get_current_profile, get_optional_profile, require_verified_profile
from database import get_db
from models import Profile, UserFollow
from profile_schemas import ProfileResponse

router = APIRouter(tags=["student discovery and follows"])


def require_follow_schema(db: Session) -> None:
    """Fail with a migration hint while this feature's table is unavailable."""
    ready = db.scalar(text("select to_regclass('public.user_follows') is not null")) is True
    if not ready:
        raise HTTPException(503, "Apply the user follows migration before using student profiles.")


class ProfileListItem(BaseModel):
    """Public profile fields returned in search and connection lists."""

    id: UUID
    username: str
    display_name: str | None = None
    major: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PublicProfileResponse(ProfileResponse):
    """Public profile details with connection counts and viewer follow state."""

    follower_count: int = 0
    following_count: int = 0
    is_following: bool = False


class UserFollowResponse(BaseModel):
    following: bool
    follower_count: int


@router.get("/profiles/search", response_model=list[ProfileListItem])
def search_profiles(
    q: str = Query(min_length=1, max_length=50),
    db: Session = Depends(get_db),
) -> list[Profile]:
    """Search active students by username or display name."""
    term = q.strip()
    if not term:
        return []
    return list(db.scalars(
        select(Profile).where(
            Profile.deleted_at.is_(None), Profile.suspended_at.is_(None),
            Profile.username.ilike(f"%{term}%") | Profile.display_name.ilike(f"%{term}%"),
        ).order_by(Profile.username).limit(25)
    ).all())


@router.get("/profiles/{profile_id}", response_model=PublicProfileResponse)
def get_public_profile(
    profile_id: UUID,
    response: Response,
    viewer: Profile | None = Depends(get_optional_profile),
    db: Session = Depends(get_db),
) -> PublicProfileResponse:
    """Return public profile fields and the viewer's follow relationship."""
    require_follow_schema(db)
    profile = db.scalar(select(Profile).where(
        Profile.id == profile_id, Profile.deleted_at.is_(None), Profile.suspended_at.is_(None),
    ))
    if profile is None:
        raise HTTPException(404, "Profile not found.")
    response.headers["Cache-Control"] = "no-store"
    return PublicProfileResponse(
        **ProfileResponse.model_validate(profile).model_dump(),
        follower_count=db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.followed_id == profile.id)) or 0,
        following_count=db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == profile.id)) or 0,
        is_following=bool(viewer and db.get(UserFollow, (viewer.id, profile.id))),
    )


def profile_connections(
    profile_id: UUID, direction: str, response: Response, db: Session,
) -> list[ProfileListItem]:
    """Load active followers or followed profiles for one student."""
    require_follow_schema(db)
    target = db.get(Profile, profile_id)
    if target is None or target.deleted_at is not None or target.suspended_at is not None:
        raise HTTPException(404, "Profile not found.")
    response.headers["Cache-Control"] = "no-store"
    if direction == "followers":
        query = select(Profile).join(UserFollow, UserFollow.follower_id == Profile.id).where(
            UserFollow.followed_id == profile_id,
        )
    else:
        query = select(Profile).join(UserFollow, UserFollow.followed_id == Profile.id).where(
            UserFollow.follower_id == profile_id,
        )
    query = query.where(Profile.deleted_at.is_(None), Profile.suspended_at.is_(None)).order_by(Profile.username)
    return [ProfileListItem.model_validate(item) for item in db.scalars(query).all()]


@router.get("/profiles/{profile_id}/followers", response_model=list[ProfileListItem])
def get_followers(profile_id: UUID, response: Response, db: Session = Depends(get_db)) -> list[ProfileListItem]:
    """List active profiles that follow the requested student."""
    return profile_connections(profile_id, "followers", response, db)


@router.get("/profiles/{profile_id}/following", response_model=list[ProfileListItem])
def get_following(profile_id: UUID, response: Response, db: Session = Depends(get_db)) -> list[ProfileListItem]:
    """List active profiles followed by the requested student."""
    return profile_connections(profile_id, "following", response, db)


def change_user_follow(
    profile_id: UUID, follower: Profile, follow: bool, response: Response, db: Session,
) -> UserFollowResponse:
    """Apply a follow change and return the caller's state plus updated count."""
    require_follow_schema(db)
    target = db.scalar(select(Profile).where(
        Profile.id == profile_id, Profile.deleted_at.is_(None), Profile.suspended_at.is_(None),
    ))
    if target is None:
        raise HTTPException(404, "Profile not found.")
    if follower.id == profile_id:
        raise HTTPException(422, "You cannot follow yourself.")
    if follow:
        db.execute(insert(UserFollow).values(follower_id=follower.id, followed_id=profile_id).on_conflict_do_nothing())
    else:
        db.execute(select(UserFollow).where(
            UserFollow.follower_id == follower.id,
            UserFollow.followed_id == profile_id,
        ).with_for_update())
        relation = db.get(UserFollow, (follower.id, profile_id))
        if relation:
            db.delete(relation)
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return UserFollowResponse(
        following=bool(db.get(UserFollow, (follower.id, profile_id))),
        follower_count=db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.followed_id == profile_id)) or 0,
    )


@router.put("/profiles/{profile_id}/follow", response_model=UserFollowResponse)
def follow_profile(
    profile_id: UUID, response: Response,
    follower: Profile = Depends(require_verified_profile), db: Session = Depends(get_db),
) -> UserFollowResponse:
    """Create the caller's one-way follow relationship with a student."""
    return change_user_follow(profile_id, follower, True, response, db)


@router.delete("/profiles/{profile_id}/follow", response_model=UserFollowResponse)
def unfollow_profile(
    profile_id: UUID, response: Response,
    follower: Profile = Depends(get_current_profile), db: Session = Depends(get_db),
) -> UserFollowResponse:
    """Remove the caller's follow relationship with a student."""
    return change_user_follow(profile_id, follower, False, response, db)
