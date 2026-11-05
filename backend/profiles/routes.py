"""Profile reads, selectable metadata, and current-user edits (FR-05/06/11)."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from auth import get_current_profile, require_verified_profile
from database import get_db
from models import College, Follow, ImageUpload, Major, Profile, Space, UserFollow
from profiles.schemas import (
    STUDENT_LEVELS,
    CurrentProfileResponse,
    HomeCollegeResponse,
    MajorOptionResponse,
    ProfileOptionsResponse,
    ProfileResponse,
    ProfileUpdate,
    UsernameChoice,
    AcademicSetup,
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
    db: Session, upload_id: UUID | None, profile: Profile, purpose: str
) -> ImageUpload | None:
    upload = db.get(ImageUpload, upload_id) if upload_id else None
    if upload_id and (
        upload is None
        or upload.owner_id != profile.id
        or upload.uploaded_at is None
        or upload.deleted_at is not None
        or upload.purpose != purpose
    ):
        raise HTTPException(422, "Choose one of your completed uploads for this image type.")
    if upload and upload.processing_status in {"blocked", "failed"}:
        raise HTTPException(422, "This image was rejected or could not be processed. Choose another image.")
    return upload


def get_home_college(db: Session, profile: Profile) -> HomeCollegeResponse | None:
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
            return college_response(college_row)
    return None


def profile_space_counts(db: Session, profile_id: UUID) -> tuple[int, int]:
    """One shared count definition for own and public profiles (FR-05/70–73)."""
    followed, communities = db.execute(
        select(
            func.count(Follow.space_id),
            func.count(Follow.space_id).filter(Space.kind == "community"),
        )
        .select_from(Follow)
        .join(Space, Space.id == Follow.space_id)
        .where(
            Follow.user_id == profile_id,
            Space.kind.in_(["college", "community"]),
            Space.deleted_at.is_(None),
        )
    ).one()
    return followed, communities


def current_profile_response(db: Session, profile: Profile) -> CurrentProfileResponse:
    pending_avatar = db.get(ImageUpload, profile.pending_profile_image_upload_id) if profile.pending_profile_image_upload_id else None
    pending_banner = db.get(ImageUpload, profile.pending_banner_image_upload_id) if profile.pending_banner_image_upload_id else None
    home_college = get_home_college(db, profile)
    followed_space_count, joined_community_count = profile_space_counts(db, profile.id)

    user_follows_ready = db.scalar(text("select to_regclass('public.user_follows') is not null")) is True
    follower_count = 0
    following_count = 0
    if user_follows_ready:
        follower_count = db.scalar(
            select(func.count()).select_from(UserFollow).where(UserFollow.followed_id == profile.id)
        ) or 0
        following_count = db.scalar(
            select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == profile.id)
        ) or 0

    return CurrentProfileResponse(
        **ProfileResponse.model_validate(profile).model_dump(),
        email_verified=profile.email_verified_at is not None,
        username_chosen=profile.username_chosen_at is not None,
        academic_setup_completed=profile.academic_setup_completed_at is not None,
        home_college=home_college,
        followed_space_count=followed_space_count,
        joined_community_count=joined_community_count,
        follower_count=follower_count,
        following_count=following_count,
        pending_profile_image_upload_id=profile.pending_profile_image_upload_id,
        pending_banner_image_upload_id=profile.pending_banner_image_upload_id,
        profile_image_status=pending_avatar.processing_status if pending_avatar else None,
        banner_image_status=pending_banner.processing_status if pending_banner else None,
    )


@router.get("/auth/me", response_model=CurrentProfileResponse)
def current_profile(
    response: Response,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> CurrentProfileResponse:
    response.headers["Cache-Control"] = "no-store"
    return current_profile_response(db, profile)


@router.post("/auth/me/username", response_model=CurrentProfileResponse)
def choose_username(
    payload: UsernameChoice,
    response: Response,
    profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db),
) -> CurrentProfileResponse:
    """Choose one public username after verification (FR-02, FR-06)."""
    db.execute(select(Profile.id).where(Profile.id == profile.id).with_for_update())
    db.refresh(profile)
    if profile.username_chosen_at is not None:
        raise HTTPException(409, "Your username is already set and cannot be changed.")

    profile.username = payload.username
    profile.username_chosen_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as cause:
        db.rollback()
        if getattr(getattr(cause.orig, "diag", None), "constraint_name", None) == "profiles_username_key":
            raise HTTPException(409, "That username is already taken. Choose another.") from None
        raise
    db.refresh(profile)
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


def validate_college(db: Session, college_id: UUID) -> None:
    college_exists = db.execute(
        select(College.space_id).join(Space, Space.id == College.space_id).where(
            College.space_id == college_id, Space.kind == "college", Space.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if college_exists is None:
        raise HTTPException(422, "Choose a valid college.")


def validate_major(db: Session, major_id: UUID, college_id: UUID | None) -> Major:
    major = db.get(Major, major_id)
    if major is None or not major.active:
        raise HTTPException(422, "Choose a valid major.")
    if major.college_id != college_id:
        raise HTTPException(422, "Choose a major offered by your selected college.")
    return major


@router.post("/auth/me/academics", response_model=CurrentProfileResponse)
def complete_academic_setup(
    payload: AcademicSetup,
    response: Response,
    profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db),
) -> CurrentProfileResponse:
    """Save first-time academic selections and join the college atomically."""
    db.execute(select(Profile.id).where(Profile.id == profile.id).with_for_update())
    db.refresh(profile)
    response.headers["Cache-Control"] = "no-store"
    if profile.username_chosen_at is None:
        raise HTTPException(409, "Choose your username before selecting your college and major.")
    if profile.academic_setup_completed_at is not None:
        if (profile.home_college_id != payload.home_college_id or profile.major_id != payload.major_id
                or profile.student_level != payload.student_level):
            raise HTTPException(409, "Setup is already complete. Change your academic details from your profile.")
        return current_profile_response(db, profile)
    validate_college(db, payload.home_college_id)
    major = validate_major(db, payload.major_id, payload.home_college_id)
    profile.home_college_id = payload.home_college_id
    profile.major_id = major.id
    profile.major = major.name
    profile.student_level = payload.student_level
    profile.academic_setup_completed_at = datetime.now(timezone.utc)
    db.execute(insert(Follow).values(user_id=profile.id, space_id=payload.home_college_id).on_conflict_do_nothing())
    db.commit()
    db.refresh(profile)
    return current_profile_response(db, profile)


@router.patch("/auth/me", response_model=CurrentProfileResponse)
def update_current_profile(
    payload: ProfileUpdate,
    response: Response,
    profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db),
) -> CurrentProfileResponse:
    # Serialize profile selections with worker activation; refresh before editing
    # so a stale request cannot overwrite a newly activated image.
    db.execute(select(Profile.id).where(Profile.id == profile.id).with_for_update())
    db.refresh(profile)
    updates = payload.model_fields_set

    if "display_name" in updates:
        profile.display_name = payload.display_name
    if "bio" in updates:
        profile.bio = payload.bio
    if "student_level" in updates:
        profile.student_level = payload.student_level

    if "home_college_id" in updates and payload.home_college_id is not None:
        validate_college(db, payload.home_college_id)

    selected_college_id = (
        payload.home_college_id
        if "home_college_id" in updates
        else profile.home_college_id
    )
    selected_major_id = payload.major_id if "major_id" in updates else profile.major_id
    selected_major = None
    if {"home_college_id", "major_id"} & updates and selected_major_id:
        selected_major = validate_major(db, selected_major_id, selected_college_id)

    if "home_college_id" in updates:
        profile.home_college_id = payload.home_college_id
    if "major_id" in updates:
        profile.major_id = payload.major_id
        profile.major = selected_major.name if selected_major else None
    for field, pending, purpose in (
        ("profile_image_upload_id", "pending_profile_image_upload_id", "avatar"),
        ("banner_image_upload_id", "pending_banner_image_upload_id", "banner"),
    ):
        if field not in updates:
            continue
        selected = getattr(payload, field)
        # Unchanged current selections do not cancel a pending replacement.
        if selected is not None and selected in {getattr(profile, field), getattr(profile, pending)}:
            continue
        upload = validate_profile_image(db, selected, profile, purpose)
        if upload is None:
            setattr(profile, field, None)
            setattr(profile, pending, None)
        elif upload.processing_status == "ready":
            setattr(profile, field, upload.id)
            setattr(profile, pending, None)
        else:
            setattr(profile, pending, upload.id)

    db.commit()
    db.refresh(profile)
    response.headers["Cache-Control"] = "no-store"
    return current_profile_response(db, profile)


@router.get("/profiles", response_model=list[ProfileResponse], summary="List profiles")
def get_profiles(db: Session = Depends(get_db)) -> list[Profile]:
    """Return all stored profiles."""
    return list(db.scalars(select(Profile)).all())
