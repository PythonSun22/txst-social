"""FR-24/70–73: public space metadata and viewer-specific follow state."""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class SpaceResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    rules: str
    kind: Literal["college", "community"]
    follower_count: int
    is_following: bool


class SpaceFollowResponse(BaseModel):
    following: bool
    follower_count: int
