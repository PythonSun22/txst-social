"""Discover spaces and persist follows against the authenticated profile."""
from uuid import UUID
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from auth import get_current_profile, get_optional_profile, require_verified_profile
from database import get_db
from models import Follow, Profile, Space
from spaces.schemas import SpaceFollowResponse, SpaceResponse

router = APIRouter(tags=["spaces"])


def available_spaces():
    return select(Space).where(Space.deleted_at.is_(None), Space.kind.in_(["college", "community"]))


def serialize_spaces(db: Session, rows: list[Space], viewer: Profile | None) -> list[SpaceResponse]:
    followed = set(db.scalars(select(Follow.space_id).where(Follow.user_id == viewer.id)).all()) if viewer else set()
    return [SpaceResponse(id=s.id, slug=s.slug, name=s.name, description=s.description,
                          rules=s.rules, kind=s.kind, follower_count=s.follower_count,
                          is_following=s.id in followed) for s in rows]


@router.get("/spaces", response_model=list[SpaceResponse])
def list_spaces(response: Response, viewer: Profile | None = Depends(get_optional_profile),
                db: Session = Depends(get_db),
                q: Annotated[str | None, Query(max_length=50)] = None,
                kind: Literal["college", "community"] | None = None):
    response.headers["Cache-Control"] = "no-store"
    query = available_spaces()
    if kind:
        query = query.where(Space.kind == kind)
    if q is not None:
        term = q.strip()
        if not term:
            return []
        pattern = "%" + term.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_") + "%"
        query = query.where(or_(Space.name.ilike(pattern, escape="\\"),
                               Space.slug.ilike(pattern, escape="\\"))).limit(25)
    rows = list(db.scalars(query.order_by(Space.kind.desc(), Space.name)).all())
    return serialize_spaces(db, rows, viewer)


@router.get("/spaces/{slug}", response_model=SpaceResponse)
def get_space(slug: str, response: Response, viewer: Profile | None = Depends(get_optional_profile),
              db: Session = Depends(get_db)):
    space = db.scalar(available_spaces().where(Space.slug == slug))
    if space is None:
        raise HTTPException(404, "Space not found.")
    response.headers["Cache-Control"] = "no-store"
    return serialize_spaces(db, [space], viewer)[0]


@router.get("/profiles/{profile_id}/spaces", response_model=list[SpaceResponse])
def profile_spaces(profile_id: UUID, response: Response,
                   viewer: Profile | None = Depends(get_optional_profile), db: Session = Depends(get_db)):
    profile = db.get(Profile, profile_id)
    if profile is None or profile.deleted_at is not None or profile.suspended_at is not None:
        raise HTTPException(404, "Profile not found.")
    rows = list(db.scalars(available_spaces().join(Follow, Follow.space_id == Space.id)
                          .where(Follow.user_id == profile_id).order_by(Space.name)).all())
    response.headers["Cache-Control"] = "no-store"
    return serialize_spaces(db, rows, viewer)


def change_follow(slug: str, following: bool, profile: Profile, response: Response, db: Session):
    # Match signup's account-before-space lock order, including FK checks.
    db.execute(select(Profile.id).where(Profile.id == profile.id).with_for_update())
    space = db.scalar(available_spaces().where(Space.slug == slug).with_for_update())
    if space is None:
        raise HTTPException(404, "Space not found.")
    if following:
        db.execute(insert(Follow).values(user_id=profile.id, space_id=space.id).on_conflict_do_nothing())
    else:
        db.execute(delete(Follow).where(Follow.user_id == profile.id, Follow.space_id == space.id))
    db.commit()
    db.refresh(space)  # The database trigger maintains the counter in this transaction.
    response.headers["Cache-Control"] = "no-store"
    return SpaceFollowResponse(following=following, follower_count=space.follower_count)


@router.put("/spaces/{slug}/follow", response_model=SpaceFollowResponse)
def follow_space(slug: str, response: Response, profile: Profile = Depends(require_verified_profile),
                 db: Session = Depends(get_db)):
    return change_follow(slug, True, profile, response, db)


@router.delete("/spaces/{slug}/follow", response_model=SpaceFollowResponse)
def unfollow_space(slug: str, response: Response, profile: Profile = Depends(get_current_profile),
                   db: Session = Depends(get_db)):
    return change_follow(slug, False, profile, response, db)
