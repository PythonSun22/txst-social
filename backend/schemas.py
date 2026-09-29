"""Small application-level response contracts."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


class DatabaseHealthResponse(BaseModel):
    database: str
    profile_count: int
