"""FR-30/31/32/50: post and like contracts; authorship is never client supplied."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PostCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    submission_id: UUID
    title: str = Field(min_length=1, max_length=300)
    body: str | None = Field(default=None, max_length=20000)
    image_ids: list[UUID] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def content(self):
        self.body = self.body or None
        if not self.body and not self.image_ids:
            raise ValueError("Add text or at least one image.")
        if len(self.image_ids) != len(set(self.image_ids)):
            raise ValueError("An image cannot be attached twice to the same post.")
        return self


class PostMediaResponse(BaseModel):
    position: int
    width: int | None
    height: int | None


class PostResponse(BaseModel):
    id: UUID
    author: str
    title: str
    body: str | None
    url: str | None
    type: Literal["text", "image", "link"]
    status: Literal["pending", "approved", "blocked", "removed"]
    created_at: datetime
    like_count: int
    comment_count: int
    liked: bool
    media: list[PostMediaResponse]


class FeedResponse(BaseModel):
    items: list[PostResponse]
    next_cursor: str | None


class LikeResponse(BaseModel):
    liked: bool
    like_count: int
