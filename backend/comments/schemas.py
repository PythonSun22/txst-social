"""FR-35/41/45/50: comment thread and like contracts; authorship is never client supplied."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    body: str = Field(min_length=1, max_length=10000)
    parent_id: UUID | None = None


class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    parent_id: UUID | None
    author: str
    can_delete: bool
    body: str | None
    depth: int
    status: Literal["pending", "approved", "blocked", "removed"]
    created_at: datetime
    like_count: int
    liked: bool


class CommentThreadResponse(BaseModel):
    items: list[CommentResponse]


class LikeResponse(BaseModel):
    liked: bool
    like_count: int
