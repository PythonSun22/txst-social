"""FastAPI application and API routes."""

import os

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session, load_only

from auth import get_current_profile
from database import engine, get_db
from models import Post, Profile
from images import router as images_router
from posts import router as posts_router
from models import Profile
from schemas import (
    CurrentProfileResponse,
    DatabaseHealthResponse,
    HealthResponse,
    PostResponse,
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
):
    response.headers["Cache-Control"] = "no-store"

    return CurrentProfileResponse(
        **ProfileResponse.model_validate(profile).model_dump(),
        email_verified=profile.email_verified_at is not None,
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
        .options(
            load_only(
                Post.id,
                Post.space_id,
                Post.author_id,
                Post.title,
                Post.body,
                Post.like_count,
                Post.comment_count,
                Post.created_at,
                Post.status,
            )
        )
        .where(
            Post.author_id == current_profile.id,
            Post.deleted_at.is_(None),
            Post.status.in_(["approved", "pending"]),
        )
        .order_by(Post.created_at.desc())
    )

    posts = db.scalars(statement).all()

    return list(posts)


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
