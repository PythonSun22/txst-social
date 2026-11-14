"""Discover spaces and persist follows against the authenticated profile."""
from uuid import UUID, uuid4
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_profile, get_optional_profile, require_verified_profile
from database import get_db
from models import Follow, ImageUpload, Moderator, Profile, Space
from spaces.schemas import SpaceCreate, SpaceFollowResponse, SpaceResponse

router = APIRouter(tags=["spaces"])


def available_spaces():
    return select(Space).where(Space.deleted_at.is_(None), Space.kind.in_(["college", "community"]))


def serialize_spaces(db: Session, rows: list[Space], viewer: Profile | None) -> list[SpaceResponse]:
    followed = set(db.scalars(select(Follow.space_id).where(Follow.user_id == viewer.id)).all()) if viewer else set()
    return [SpaceResponse(id=s.id, slug=s.slug, name=s.name, description=s.description,
                          rules=s.rules, kind=s.kind, is_seeded=s.is_seeded, follower_count=s.follower_count,
                          icon_image_upload_id=s.icon_image_upload_id,
                          is_following=s.id in followed) for s in rows]


@router.post("/spaces", response_model=SpaceResponse, status_code=201)
def create_space(payload: SpaceCreate, response: Response,
                 profile: Profile = Depends(require_verified_profile), db: Session = Depends(get_db)):
    """Create a community, its first moderator and its first follow atomically."""
    db.execute(select(Profile.id).where(Profile.id == profile.id).with_for_update())
    existing = db.scalar(select(Space).where(Space.slug == payload.slug))
    response.headers["Cache-Control"] = "no-store"
    if existing is not None:
        # Recover a lost success response without creating a second space or
        # rejoining an account that later chose to unfollow.
        if (existing.created_by == profile.id and existing.deleted_at is None
                and existing.kind == "community" and not existing.is_seeded
                and all(getattr(existing, key) == value for key, value in payload.model_dump().items())):
            response.status_code = 200
            return serialize_spaces(db, [existing], profile)[0]
        raise HTTPException(409, "That space URL handle is already in use. Choose another.")
    if payload.icon_image_upload_id:
        upload = db.scalar(select(ImageUpload).where(ImageUpload.id == payload.icon_image_upload_id).with_for_update())
        if (upload is None or upload.owner_id != profile.id or upload.purpose != "avatar"
                or upload.uploaded_at is None or upload.processing_status != "ready"
                or upload.deleted_at is not None or upload.files_deleted_at is not None):
            raise HTTPException(422, "Choose your own space photo that has finished processing and passed screening.")
    space = Space(id=uuid4(), **payload.model_dump(), kind="community", is_seeded=False,
                  created_by=profile.id, follower_count=0, post_count=0)
    try:
        db.add(space)
        db.flush()
        db.add_all([Moderator(space_id=space.id, user_id=profile.id, granted_by=profile.id),
                    Follow(space_id=space.id, user_id=profile.id)])
        db.commit()
    except IntegrityError as cause:
        db.rollback()
        if getattr(getattr(cause.orig, "diag", None), "constraint_name", None) == "spaces_slug_key":
            raise HTTPException(409, "That space URL handle is already in use. Choose another.") from None
        raise
    db.refresh(space)
    return serialize_spaces(db, [space], profile)[0]


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
