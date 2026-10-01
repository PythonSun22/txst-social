"""FastAPI application assembly and health endpoints."""

import os
import asyncio
from contextlib import asynccontextmanager
from threading import Event, Thread

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine
from images import router as images_router
from posts import router as posts_router
from profile_routes import router as profile_router
from moderation_worker import Settings, run_worker
from schemas import DatabaseHealthResponse, HealthResponse


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
app.include_router(profile_router)

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health", response_model=HealthResponse, summary="Check API health")
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
        profile_count = connection.execute(
            text("select count(*) from public.profiles")
        ).scalar_one()

    return DatabaseHealthResponse(
        database="connected",
        profile_count=profile_count,
    )
