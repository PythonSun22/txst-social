"""FastAPI application assembly and health endpoints."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine
from images import router as images_router
from posts import router as posts_router
from profile_routes import router as profile_router
from schemas import DatabaseHealthResponse, HealthResponse


app = FastAPI()
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
