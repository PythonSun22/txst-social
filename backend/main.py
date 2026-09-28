"""FastAPI application and API routes."""

import os
import asyncio
from contextlib import asynccontextmanager
from threading import Event, Thread

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from auth import get_current_profile
from database import engine, get_db
from models import Profile
from images import router as images_router
from posts import router as posts_router
from moderation_worker import Settings, run_worker
from schemas import (
    CurrentProfileResponse,
    DatabaseHealthResponse,
    HealthResponse,
    ProfileResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Screen committed ForAll posts while the API runs (FR-90–92)."""
    stop = Event()
    worker = None
    if os.getenv("MODERATION_ENABLED", "false").lower() in {"true", "1", "yes"}:
        worker = Thread(target=run_worker, args=(stop, Settings.from_env()), daemon=True,
                        name="post-moderation")
        worker.start()
    try:
        yield
    finally:
        stop.set()
        if worker:
            # Interrupted work is recoverable through its persisted lease and attempt count.
            await asyncio.to_thread(worker.join, 5)


app = FastAPI(lifespan=lifespan)
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
