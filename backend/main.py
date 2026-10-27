"""FastAPI application assembly and health endpoints."""

import os
import asyncio
from contextlib import asynccontextmanager
from threading import Event, Thread

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from comments.routes import router as comments_router
from database import engine
from images.routes import router as images_router
from posts.routes import router as posts_router
from profiles.routes import router as profile_router
from moderation.worker import Settings, run_worker
from images.worker import Settings as ImageSettings, run_worker as run_image_worker
from health_schemas import DatabaseHealthResponse, HealthResponse
from auth import get_current_profile
from worker_control import control
from search import router as search_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Screen committed ForAll posts while the API runs (FR-90–92)."""
    stop = Event()
    worker = None
    image_worker = None
    if os.getenv("IMAGE_PROCESSING_ENABLED", "false").lower() in {"true", "1", "yes"}:
        image_worker = Thread(target=run_image_worker, args=(stop, ImageSettings.from_env(), control), daemon=True,
                              name="image-processing")
        image_worker.start()
    if os.getenv("MODERATION_ENABLED", "false").lower() in {"true", "1", "yes"}:
        worker = Thread(target=run_worker, args=(stop, Settings.from_env(), control), daemon=True,
                        name="post-moderation")
        worker.start()
    try:
        yield
    finally:
        stop.set()
        if worker:
            # Interrupted work is recoverable through its persisted lease and attempt count.
            await asyncio.to_thread(worker.join, 5)
        if image_worker:
            await asyncio.to_thread(image_worker.join, 5)


app = FastAPI(lifespan=lifespan)


@app.get("/workers/status", dependencies=[Depends(get_current_profile)])
def worker_status(response: Response):
    """This API process only, not a claim about other hosts sharing the queue."""
    response.headers["Cache-Control"] = "no-store"
    return {"worker_id": control.worker_id, "paused": control.paused.is_set(),
            "reason": control.reason,
            "images_enabled": os.getenv("IMAGE_PROCESSING_ENABLED", "false").lower() in {"true", "1", "yes"},
            "moderation_enabled": os.getenv("MODERATION_ENABLED", "false").lower() in {"true", "1", "yes"}}


app.include_router(images_router)
app.include_router(posts_router)
app.include_router(profile_router)
app.include_router(comments_router)
app.include_router(search_router)

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
