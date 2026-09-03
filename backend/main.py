"""FastAPI application and API routes."""

from fastapi import Depends, FastAPI
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Profile
from schemas import (
    DatabaseHealthResponse,
    HealthResponse,
    ProfileResponse,
)

app = FastAPI()


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Check API health",
)
def health_check() -> HealthResponse:
    """Return the current API health status."""
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
    return list(db.scalars(statement).all())