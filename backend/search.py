"""Basic post search over titles (FR-80), newest first with the feed's cursor (FR-66)."""
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, func, literal_column, or_, select
from sqlalchemy.orm import Session

from auth import get_optional_profile
from database import get_db
from models import Post, Profile, Space
from posts.schemas import FeedResponse
from posts.routes import decode_cursor, encode_cursor, serialize_posts, visible_to

router = APIRouter(prefix="/search", tags=["search"])


def title_matches(terms: str):
    """Word-start matches via the title index, plus a substring fallback for mid-word text."""
    # Keep letters and digits only: to_tsquery raises on stray operators (& | ! : ( )),
    # and underscores are separators to its parser.
    words = re.findall(r"[^\W_]+", terms)
    # Escape LIKE wildcards so a typed % or _ is matched literally.
    pattern = "%" + terms.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_") + "%"
    substring = Post.title.ilike(pattern, escape="\\")
    if not words:
        return substring
    # "calc tut" -> calc:* & tut:*  — every word must start a word in the title.
    # The 'english' config must match the one search_vector was generated with,
    # or stemming will not line up.
    prefix = func.to_tsquery(literal_column("'english'"), " & ".join(f"{word}:*" for word in words))
    # ILIKE cannot use the GIN index, so this scans titles; fine at class scale.
    # A pg_trgm index (a migration) is the upgrade path if search gets slow.
    return or_(Post.search_vector.bool_op("@@")(prefix), substring)


@router.get("/posts", response_model=FeedResponse, summary="Search post titles")
def search_posts(
    response: Response, q: str = Query(min_length=1, max_length=100),
    cursor: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    viewer: Profile | None = Depends(get_optional_profile), db: Session = Depends(get_db),
) -> FeedResponse:
    """Match partial words in post titles across every space, using the feed's visibility rule."""
    terms = q.strip()
    if not terms:
        raise HTTPException(422, "Enter something to search for.")
    matches = title_matches(terms)
    query = select(Post).join(Space, Post.space_id == Space.id).where(
        matches, Space.deleted_at.is_(None), visible_to(viewer),
    )
    if cursor:
        created, identity = decode_cursor(cursor)
        query = query.where(or_(Post.created_at < created, and_(Post.created_at == created, Post.id < identity)))
    rows = list(db.scalars(query.order_by(Post.created_at.desc(), Post.id.desc()).limit(limit + 1)).all())
    response.headers["Cache-Control"] = "no-store"
    return FeedResponse(items=serialize_posts(db, rows[:limit], viewer),
                        next_cursor=encode_cursor(rows[limit - 1]) if len(rows) > limit else None)
