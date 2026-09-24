"""Supabase identity and application-account gates (FR-01, FR-02, FR-96)."""

import os
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import Profile

bearer = HTTPBearer(auto_error=False)


def get_authenticated_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    """Trust only the user returned by this project's Auth server, never JWT decoding."""
    unauthorized = HTTPException(
        status_code=401,
        detail="A valid sign-in session is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not url or not key:
        raise HTTPException(503, "Authentication is not configured.")

    try:
        response = httpx.get(
            f"{url}/auth/v1/user",
            headers={"apikey": key, "Authorization": f"Bearer {credentials.credentials}"},
            timeout=10.0,
        )
    except httpx.RequestError:
        raise HTTPException(503, "Authentication service is unavailable.") from None

    if response.status_code in (401, 403):
        raise unauthorized
    if response.status_code != 200:
        raise HTTPException(503, "Authentication service is unavailable.")
    try:
        user = response.json()
        user_id = UUID(user["id"])
        email = user.get("email") or ""
        if not isinstance(email, str):
            raise ValueError("Invalid email")
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(503, "Authentication service returned an invalid response.") from None
    if user.get("is_anonymous") or email.rsplit("@", 1)[-1].lower() != "txstate.edu":
        raise HTTPException(403, "A Texas State account is required.")
    return user_id


def get_current_profile(
    user_id: UUID = Depends(get_authenticated_user_id),
    db: Session = Depends(get_db),
) -> Profile:
    profile = db.get(Profile, user_id)
    if profile is None:
        raise HTTPException(403, "Your account profile is unavailable.")
    if profile.deleted_at is not None or profile.suspended_at is not None:
        raise HTTPException(403, "Your account is not active.")
    if not profile.email or profile.email.rsplit("@", 1)[-1].lower() != "txstate.edu":
        raise HTTPException(403, "A Texas State account is required.")
    return profile


def require_verified_profile(profile: Profile = Depends(get_current_profile)) -> Profile:
    """Future writes derive author_id from this profile; space bans are checked per space."""
    if profile.email_verified_at is None:
        raise HTTPException(403, "Verify your Texas State email before posting.")
    return profile


def get_optional_profile(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Profile | None:
    """Public reads allow no token; an invalid supplied bearer token still fails."""
    if credentials is None:
        return None
    return get_current_profile(get_authenticated_user_id(credentials), db)
