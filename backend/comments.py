"""Threaded comments on posts: one indexed read per thread, no recursion ([D-3])."""
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from auth import get_optional_profile, require_verified_profile
from comment_schemas import CommentCreate, CommentResponse, CommentThreadResponse, LikeResponse
from database import get_db
from models import Comment, CommentLike, Post, Profile
from posts import check_ban, load_visible_post

router = APIRouter(tags=["comments"])

MAX_DEPTH = 12  # matches the comments_depth_limit CHECK constraint


def visible_comment(comment: Comment, viewer: Profile | None) -> bool:
    # Same rule posts.py's visible_to() uses: approved, or the caller's own —
    # 'pending' is not visible to anyone but its author (FR-90).
    if comment.deleted_at is not None:
        return False
    return comment.status == "approved" or (viewer is not None and comment.author_id == viewer.id)


def serialize_comments(db: Session, comments: list[Comment], viewer: Profile | None) -> list[CommentResponse]:
    if not comments:
        return []
    ids = [c.id for c in comments]
    authors = {p.id: p for p in db.scalars(select(Profile).where(Profile.id.in_(
        {c.author_id for c in comments if c.author_id}
    ))).all()}
    liked = set(db.scalars(select(CommentLike.comment_id).where(
        CommentLike.comment_id.in_(ids), CommentLike.user_id == viewer.id,
    )).all()) if viewer else set()
    result = []
    for comment in comments:
        author = authors.get(comment.author_id)
        name = (author.display_name or author.username) if author and author.deleted_at is None else "Former student"
        result.append(CommentResponse(
            id=comment.id, post_id=comment.post_id, parent_id=comment.parent_id,
            author=name, can_delete=bool(viewer and viewer.id == comment.author_id),
            body=comment.body, depth=comment.depth, status=comment.status,
            created_at=comment.created_at, like_count=comment.like_count,
            liked=comment.id in liked,
        ))
    return result


def next_label(db: Session, post_id: UUID, parent_path: str | None) -> str:
    """Zero-padded label one past the highest existing direct child of parent_path."""
    pattern = f"{parent_path}.*{{1}}" if parent_path else "*{1}"
    existing = db.execute(
        text("""
            select path::text from public.comments
            where post_id = :post_id and path ~ CAST(:pattern AS lquery)
            order by path desc
            limit 1
        """),
        {"post_id": str(post_id), "pattern": pattern},
    ).scalar()
    last = existing.rsplit(".", 1)[-1] if existing else "0000"
    return f"{int(last) + 1:04d}"


@router.get("/posts/{post_id}/comments", response_model=CommentThreadResponse)
def list_comments(
    post_id: UUID, response: Response,
    viewer: Profile | None = Depends(get_optional_profile), db: Session = Depends(get_db),
) -> CommentThreadResponse:
    """Whole thread, depth-first, in one indexed query (FR-35)."""
    load_visible_post(db, post_id, viewer)
    comments = [
        c for c in db.scalars(
            select(Comment).where(Comment.post_id == post_id).order_by(Comment.path)
        ).all()
        if visible_comment(c, viewer)
    ]
    response.headers["Cache-Control"] = "no-store"
    return CommentThreadResponse(items=serialize_comments(db, comments, viewer))


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=201)
def create_comment(
    post_id: UUID, payload: CommentCreate, response: Response,
    profile: Profile = Depends(require_verified_profile), db: Session = Depends(get_db),
) -> CommentResponse:
    post = load_visible_post(db, post_id, profile, lock=True)
    check_ban(db, profile, post.space_id)

    parent_path: str | None = None
    depth = 0
    if payload.parent_id is not None:
        parent = db.scalar(
            select(Comment).where(
                Comment.id == payload.parent_id, Comment.post_id == post_id, Comment.deleted_at.is_(None),
            ).with_for_update()
        )
        if parent is None:
            raise HTTPException(404, "Comment not found.")
        if parent.depth + 1 > MAX_DEPTH:
            raise HTTPException(422, "This thread is too deep to reply to.")
        parent_path, depth = parent.path, parent.depth + 1

    label = next_label(db, post_id, parent_path)
    path = f"{parent_path}.{label}" if parent_path else label

    comment = Comment(
        id=uuid4(), post_id=post_id, parent_id=payload.parent_id, author_id=profile.id,
        path=path, depth=depth, body=payload.body, like_count=0, status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(comment)
    db.execute(update(Post).where(Post.id == post_id).values(comment_count=Post.comment_count + 1))
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return serialize_comments(db, [comment], profile)[0]


def load_own_comment(db: Session, post_id: UUID, comment_id: UUID, profile: Profile, lock: bool = False) -> Comment:
    query = select(Comment).where(
        Comment.id == comment_id, Comment.post_id == post_id, Comment.deleted_at.is_(None),
    )
    comment = db.scalar(query.with_for_update() if lock else query)
    if comment is None:
        raise HTTPException(404, "Comment not found.")
    return comment


def set_comment_like(db: Session, post_id: UUID, comment_id: UUID, profile: Profile, liked: bool) -> LikeResponse:
    comment = load_own_comment(db, post_id, comment_id, profile, lock=True)
    if comment.status not in ("approved", "pending"):
        raise HTTPException(409, "This comment cannot receive likes.")
    previous = db.get(CommentLike, (profile.id, comment_id))
    delta = 0
    if liked and previous is None:
        db.add(CommentLike(user_id=profile.id, comment_id=comment_id))
        delta = 1
    elif not liked and previous is not None:
        db.delete(previous)
        delta = -1
    if delta:
        comment.like_count += delta
        if comment.author_id:
            db.execute(update(Profile).where(Profile.id == comment.author_id).values(comment_karma=Profile.comment_karma + delta))
    db.commit()
    return LikeResponse(liked=liked, like_count=comment.like_count)


@router.put("/posts/{post_id}/comments/{comment_id}/like", response_model=LikeResponse)
def like_comment(post_id: UUID, comment_id: UUID, response: Response, profile: Profile = Depends(require_verified_profile), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return set_comment_like(db, post_id, comment_id, profile, True)


@router.delete("/posts/{post_id}/comments/{comment_id}/like", response_model=LikeResponse)
def unlike_comment(post_id: UUID, comment_id: UUID, response: Response, profile: Profile = Depends(require_verified_profile), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return set_comment_like(db, post_id, comment_id, profile, False)


@router.delete("/posts/{post_id}/comments/{comment_id}", status_code=204, summary="Soft-delete your own comment")
def delete_own_comment(
    post_id: UUID, comment_id: UUID,
    profile: Profile = Depends(require_verified_profile), db: Session = Depends(get_db),
) -> Response:
    """Mark the caller's comment deleted while retaining its row for the thread (FR-43)."""
    comment = db.scalar(select(Comment).where(
        Comment.id == comment_id, Comment.post_id == post_id,
        Comment.author_id == profile.id, Comment.deleted_at.is_(None),
    ).with_for_update())
    if comment is None:
        # Do not disclose whether another user's comment exists.
        raise HTTPException(404, "Comment not found.")

    comment.deleted_at = datetime.now(timezone.utc)
    db.execute(update(Post).where(Post.id == post_id).values(comment_count=Post.comment_count - 1))
    db.commit()
    return Response(status_code=204)
