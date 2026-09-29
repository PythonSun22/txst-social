"""FastAPI application and API routes."""

import os

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from auth import get_current_profile
from database import engine, get_db
from models import College, Follow, Post, Profile, Space
from images import router as images_router
from posts import router as posts_router, serialize_posts
from post_schemas import PostResponse
from schemas import (
    CurrentProfileResponse,
    DatabaseHealthResponse,
    HealthResponse,
    HomeCollegeResponse,
    ProfileResponse,
)


app = FastAPI()
app.include_router(images_router)
app.include_router(posts_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/auth/me", response_model=CurrentProfileResponse)
def current_profile(
    response: Response,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"

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
            space, college = college_row
            home_college = HomeCollegeResponse(
                id=space.id,
                name=space.name,
                short_name=college.short_name,
                slug=space.slug,
                accent_hex=college.accent_hex,
                crest_key=college.crest_key,
            )

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


@app.get(
    "/posts/me",
    response_model=list[PostResponse],
    summary="Get the current user's posts",
)
def get_my_posts(
    response: Response,
    current_profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"

    statement = (
        select(Post)
        .where(
            Post.author_id == current_profile.id,
            Post.deleted_at.is_(None),
            Post.status.in_(["approved", "pending"]),
        )
        .order_by(Post.created_at.desc())
    )

    posts = db.scalars(statement).all()

    return serialize_posts(db, list(posts), current_profile)


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Check API health",
)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get(
    "/db-health",
    response_model=DatabaseHealthResponse,
    summary="Check database health",
)
def database_health_check() -> DatabaseHealthResponse:
    """Verify the database connection and return the profile count."""

    with engine.connect() as connection:
        result = connection.execute(
            text("select count(*) from public.profiles")
        )
        profile_count = result.scalar_one()

    return DatabaseHealthResponse(
        database="connected",
        profile_count=profile_count,
    )


@app.get(
    "/profiles",
    response_model=list[ProfileResponse],
    summary="List profiles",
)
def get_profiles(db: Session = Depends(get_db)) -> list[Profile]:
    """Return all stored profiles."""

    statement = select(Profile)
    profiles = db.scalars(statement).all()

    return list(profiles)
