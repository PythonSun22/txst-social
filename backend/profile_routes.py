"""Profile reads, selectable metadata, and current-user edits (FR-05/06/11)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_current_profile, require_verified_profile
from database import get_db
from models import College, Follow, ImageUpload, Major, Profile, Space
from profile_schemas import (
    STUDENT_LEVELS,
    CurrentProfileResponse,
    HomeCollegeResponse,
    MajorOptionResponse,
    ProfileOptionsResponse,
    ProfileResponse,
    ProfileUpdate,
)

router = APIRouter(tags=["profiles"])


def college_response(row: tuple[Space, College]) -> HomeCollegeResponse:
    space, college = row
    return HomeCollegeResponse(
        id=space.id,
        name=space.name,
        short_name=college.short_name,
        slug=space.slug,
        accent_hex=college.accent_hex,
        crest_key=college.crest_key,
    )


def validate_profile_image(
    db: Session, upload_id: UUID | None, profile: Profile
) -> ImageUpload | None:
    upload = db.get(ImageUpload, upload_id) if upload_id else None
    if upload_id and (
        upload is None
        or upload.owner_id != profile.id
        or upload.uploaded_at is None
        or upload.deleted_at is not None
    ):
        raise HTTPException(422, "Choose one of your completed image uploads.")
    return upload


def current_profile_response(db: Session, profile: Profile) -> CurrentProfileResponse:
    home_college = None
    if profile.home_college_id is not None:
        college_row = db.execute(
            select(Space, College)
            .join(College, College.space_id == Space.id)
            .where(
                Space.id == profile.home_college_id,
                Space.kind == "college",
                Space.deleted_at.is_(None),
            )
        ).one_or_none()
        if college_row is not None:
            home_college = college_response(college_row)

    followed_space_count, joined_community_count = db.execute(
        select(
            func.count(Follow.space_id),
            func.count(Follow.space_id).filter(Space.kind == "community"),
        )
        .select_from(Follow)
        .join(Space, Space.id == Follow.space_id)
        .where(
            Follow.user_id == profile.id,
            Space.kind.in_(["college", "community"]),
            Space.deleted_at.is_(None),
        )
    ).one()

    return CurrentProfileResponse(
        **ProfileResponse.model_validate(profile).model_dump(),
        email_verified=profile.email_verified_at is not None,
        home_college=home_college,
        followed_space_count=followed_space_count,
        joined_community_count=joined_community_count,
    )


@router.get("/auth/me", response_model=CurrentProfileResponse)
def current_profile(
    response: Response,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> CurrentProfileResponse:
    response.headers["Cache-Control"] = "no-store"
    return current_profile_response(db, profile)


@router.get("/profile/options", response_model=ProfileOptionsResponse)
def profile_options(
    response: Response,
    _: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> ProfileOptionsResponse:
    response.headers["Cache-Control"] = "private, max-age=3600"
    college_rows = db.execute(
        select(Space, College)
        .join(College, College.space_id == Space.id)
        .where(Space.kind == "college", Space.deleted_at.is_(None))
        .order_by(College.sort_order, Space.name)
    ).all()
    majors = db.scalars(
        select(Major).where(Major.active.is_(True)).order_by(Major.sort_order)
    ).all()
    return ProfileOptionsResponse(
        colleges=[college_response(row) for row in college_rows],
        majors=[MajorOptionResponse.model_validate(major) for major in majors],
        student_levels=list(STUDENT_LEVELS),
    )


@router.patch("/auth/me", response_model=CurrentProfileResponse)
def update_current_profile(
    payload: ProfileUpdate,
    response: Response,
    profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db),
) -> CurrentProfileResponse:
    updates = payload.model_fields_set

    if "display_name" in updates:
        profile.display_name = payload.display_name
    if "bio" in updates:
        profile.bio = payload.bio
    if "student_level" in updates:
        profile.student_level = payload.student_level

    if "home_college_id" in updates and payload.home_college_id is not None:
        college_exists = db.execute(
            select(College.space_id)
            .join(Space, Space.id == College.space_id)
            .where(
                College.space_id == payload.home_college_id,
                Space.kind == "college",
                Space.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        if college_exists is None:
            raise HTTPException(422, "Choose a valid college.")

    selected_college_id = (
        payload.home_college_id
        if "home_college_id" in updates
        else profile.home_college_id
    )
    selected_major_id = payload.major_id if "major_id" in updates else profile.major_id
    selected_major = None
    if {"home_college_id", "major_id"} & updates and selected_major_id:
        selected_major = db.get(Major, selected_major_id)
        if selected_major is None or not selected_major.active:
            raise HTTPException(422, "Choose a valid major.")
        if selected_major.college_id != selected_college_id:
            raise HTTPException(422, "Choose a major offered by your selected college.")

    if "home_college_id" in updates:
        profile.home_college_id = payload.home_college_id
    if "major_id" in updates:
        profile.major_id = payload.major_id
        profile.major = selected_major.name if selected_major else None
    if "profile_image_upload_id" in updates:
        validate_profile_image(db, payload.profile_image_upload_id, profile)
        profile.profile_image_upload_id = payload.profile_image_upload_id
    if "banner_image_upload_id" in updates:
        validate_profile_image(db, payload.banner_image_upload_id, profile)
        profile.banner_image_upload_id = payload.banner_image_upload_id

    db.commit()
    db.refresh(profile)
    response.headers["Cache-Control"] = "no-store"
    return current_profile_response(db, profile)


@router.get("/profiles", response_model=list[ProfileResponse], summary="List profiles")
def get_profiles(db: Session = Depends(get_db)) -> list[Profile]:
    """Return all stored profiles."""
    return list(db.scalars(select(Profile)).all())
