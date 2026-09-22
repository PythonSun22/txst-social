"""FastAPI application and API routes."""

import os

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from auth import get_current_profile
from database import engine, get_db
from models import Profile
from schemas import (
    CurrentProfileResponse,
    DatabaseHealthResponse,
    HealthResponse,
    ProfileResponse,
)


app = FastAPI()

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
    allow_methods=["GET"],
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