"""General posts, chronological reads and transactional likes (FR-30/50/60/90)."""
import base64
import binascii
import math
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session

from auth import bearer, get_optional_profile, require_verified_profile
from database import get_db
from image_schemas import ImagePreviewResponse
import image_storage
from models import Ban, ImageUpload, Post, PostLike, PostMedia, Profile, Space
from post_schemas import FeedResponse, LikeResponse, PostCreate, PostMediaResponse, PostResponse

router = APIRouter(prefix="/posts", tags=["posts"])


def visible_to(viewer: Profile | None):
    return and_(Post.deleted_at.is_(None), or_(
        Post.status == "approved", Post.author_id == viewer.id if viewer else False,
    ))


def check_ban(db: Session, profile: Profile, space_id: UUID):
    ban = db.get(Ban, (space_id, profile.id))
    if ban and (ban.expires_at is None or ban.expires_at > datetime.now(timezone.utc)):
        raise HTTPException(403, "You cannot write in this space while banned.")


def serialize_posts(db: Session, posts: list[Post], viewer: Profile | None) -> list[PostResponse]:
    """Batch related records; feed length does not multiply database queries."""
    if not posts:
        return []
    ids = [p.id for p in posts]
    authors = {p.id: p for p in db.scalars(select(Profile).where(Profile.id.in_(
        {p.author_id for p in posts if p.author_id}
    ))).all()}
    attachments: dict[UUID, list[PostMediaResponse]] = {pid: [] for pid in ids}
    for media in db.scalars(select(PostMedia).where(PostMedia.post_id.in_(ids)).order_by(PostMedia.position)).all():
        attachments[media.post_id].append(PostMediaResponse(position=media.position, width=media.width, height=media.height))
    liked = set(db.scalars(select(PostLike.post_id).where(
        PostLike.post_id.in_(ids), PostLike.user_id == viewer.id,
    )).all()) if viewer else set()
    result = []
    for post in posts:
        author = authors.get(post.author_id)
        name = (author.display_name or author.username) if author and author.deleted_at is None else "Former student"
        result.append(PostResponse(
            id=post.id, author=name, title=post.title, body=post.body, url=post.url,
            can_delete=bool(viewer and viewer.id == post.author_id and viewer.email_verified_at),
            type=post.type, status=post.status, created_at=post.created_at,
            like_count=post.like_count, comment_count=post.comment_count,
            liked=post.id in liked, media=attachments[post.id],
        ))
    return result


def encode_cursor(post: Post) -> str:
    return base64.urlsafe_b64encode(f"{post.created_at.isoformat()}|{post.id}".encode()).decode()


def decode_cursor(cursor: str):
    try:
        stamp, identity = base64.b64decode(cursor, altchars=b'-_', validate=True).decode().split('|')
        created = datetime.fromisoformat(stamp)
        if created.tzinfo is None:
            raise ValueError()
        return created, UUID(identity)
    except (ValueError, UnicodeError, binascii.Error):
        raise HTTPException(422, "Invalid feed cursor.") from None


@router.get("", response_model=FeedResponse)
def list_posts(
    response: Response, cursor: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    viewer: Profile | None = Depends(get_optional_profile), db: Session = Depends(get_db),
) -> FeedResponse:
    """Read General newest first; include pending content only for its author."""
    query = select(Post).join(Space, Post.space_id == Space.id).where(
        Space.kind == "campus", Space.slug == "general", Space.deleted_at.is_(None), visible_to(viewer),
    )
    if cursor:
        created, identity = decode_cursor(cursor)
        query = query.where(or_(Post.created_at < created, and_(Post.created_at == created, Post.id < identity)))
    rows = list(db.scalars(query.order_by(Post.created_at.desc(), Post.id.desc()).limit(limit + 1)).all())
    response.headers["Cache-Control"] = "no-store"
    return FeedResponse(items=serialize_posts(db, rows[:limit], viewer),
                        next_cursor=encode_cursor(rows[limit - 1]) if len(rows) > limit else None)


@router.post("", response_model=PostResponse, status_code=201)
def create_post(
    payload: PostCreate, response: Response, profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db),
) -> PostResponse:
    """Atomically save a pending post and ordered, owned attachments; retries are idempotent."""
    # Serialize submissions per author, including retries with the same key.
    db.execute(select(Profile.id).where(Profile.id == profile.id).with_for_update())
    existing = db.scalar(select(Post).where(Post.author_id == profile.id, Post.submission_id == payload.submission_id))
    if existing:
        ids = list(db.scalars(select(PostMedia.image_upload_id).where(PostMedia.post_id == existing.id).order_by(PostMedia.position)).all())
        if existing.title != payload.title or existing.body != payload.body or ids != payload.image_ids or existing.deleted_at:
            raise HTTPException(409, "This submission was already saved with different content. Reload before creating another post.")
        response.headers["Cache-Control"] = "no-store"
        return serialize_posts(db, [existing], profile)[0]
    space = db.scalar(select(Space).where(Space.kind == "campus", Space.slug == "general", Space.deleted_at.is_(None)))
    if space is None:
        raise HTTPException(503, "The General space is unavailable.")
    check_ban(db, profile, space.id)
    uploads = list(db.scalars(select(ImageUpload).where(
        ImageUpload.id.in_(payload.image_ids), ImageUpload.owner_id == profile.id,
        ImageUpload.uploaded_at.is_not(None), ImageUpload.deleted_at.is_(None),
    ).order_by(ImageUpload.id).with_for_update()).all()) if payload.image_ids else []
    if len(uploads) != len(payload.image_ids):
        raise HTTPException(422, "Every image must be your own completed upload.")
    by_id = {u.id: u for u in uploads}
    now = datetime.now(timezone.utc)
    post = Post(id=uuid4(), author_id=profile.id, space_id=space.id,
                submission_id=payload.submission_id, title=payload.title, body=payload.body,
                type="image" if uploads else "text", status="pending", created_at=now,
                like_count=0, comment_count=0, hot_rank=now.timestamp() / 45000)
    db.add(post)
    db.flush()
    for position, image_id in enumerate(payload.image_ids):
        upload = by_id[image_id]
        db.add(PostMedia(post_id=post.id, position=position, image_upload_id=image_id,
                         object_key=upload.object_key, width=upload.width, height=upload.height))
    db.execute(update(Space).where(Space.id == space.id).values(post_count=Space.post_count + 1))
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return serialize_posts(db, [post], profile)[0]


def load_visible_post(db: Session, post_id: UUID, viewer: Profile | None, lock: bool = False) -> Post:
    query = select(Post).join(Space, Post.space_id == Space.id).where(
        Post.id == post_id, Space.deleted_at.is_(None), visible_to(viewer),
    )
    post = db.scalar(query.with_for_update(of=Post) if lock else query)
    if post is None:
        raise HTTPException(404, "Post not found.")
    return post


@router.get("/{post_id}/media/{position}/preview", response_model=ImagePreviewResponse)
def preview_post_image(
    post_id: UUID, position: int, response: Response,
    viewer: Profile | None = Depends(get_optional_profile),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db),
) -> ImagePreviewResponse:
    """Issue a short-lived private image URL only after checking post visibility."""
    load_visible_post(db, post_id, viewer)
    media = db.get(PostMedia, (post_id, position))
    if media is None:
        raise HTTPException(404, "Image not found.")
    response.headers["Cache-Control"] = "no-store"
    return ImagePreviewResponse(url=image_storage.sign_preview(media.object_key, credentials.credentials if credentials else None))


def set_like(db: Session, post_id: UUID, profile: Profile, liked: bool) -> LikeResponse:
    post = load_visible_post(db, post_id, profile, lock=True)
    if post.status not in ("approved", "pending"):
        raise HTTPException(409, "This post cannot receive likes.")
    check_ban(db, profile, post.space_id)
    previous = db.get(PostLike, (profile.id, post_id))
    delta = 0
    if liked and previous is None:
        db.add(PostLike(user_id=profile.id, post_id=post_id))
        delta = 1
    elif not liked and previous is not None:
        db.delete(previous)
        delta = -1
    if delta:
        post.like_count += delta
        post.hot_rank = math.log10(max(post.like_count, 1)) + post.created_at.timestamp() / 45000
        if post.author_id:
            db.execute(update(Profile).where(Profile.id == post.author_id).values(post_karma=Profile.post_karma + delta))
    db.commit()
    return LikeResponse(liked=liked, like_count=post.like_count)


@router.put("/{post_id}/like", response_model=LikeResponse)
def like_post(post_id: UUID, response: Response, profile: Profile = Depends(require_verified_profile), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return set_like(db, post_id, profile, True)


@router.delete("/{post_id}/like", response_model=LikeResponse)
def unlike_post(post_id: UUID, response: Response, profile: Profile = Depends(require_verified_profile), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return set_like(db, post_id, profile, False)


@router.delete("/{post_id}", status_code=204, summary="Soft-delete your own post")
def delete_own_post(
    post_id: UUID,
    profile: Profile = Depends(require_verified_profile),
    db: Session = Depends(get_db),
) -> Response:
    """Mark the caller's post deleted while retaining its database row (FR-34)."""
    post = db.scalar(select(Post).where(
        Post.id == post_id,
        Post.author_id == profile.id,
        Post.deleted_at.is_(None),
    ).with_for_update())
    if post is None:
        # Do not disclose whether another user's post exists.
        raise HTTPException(404, "Post not found.")

    post.deleted_at = datetime.now(timezone.utc)
    db.execute(update(Space).where(Space.id == post.space_id).values(post_count=Space.post_count - 1))
    db.commit()
    return Response(status_code=204)
