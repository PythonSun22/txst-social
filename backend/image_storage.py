"""Small Storage adapter. Only metadata/signatures transit FastAPI (FR-32)."""

import os
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import HTTPException

from image_schemas import IMAGE_BUCKET


def storage_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    """Use the caller's JWT so Storage RLS remains effective; never return upstream details."""
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not url or not key:
        raise HTTPException(503, "Image storage is not configured.")
    try:
        response = httpx.request(
            method, f"{url}/storage/v1/{path}",
            headers={"apikey": key, "Authorization": f"Bearer {token}"},
            json=body, timeout=15.0,
        )
    except httpx.RequestError:
        raise HTTPException(503, "Image storage is unavailable. Try again.") from None
    if response.status_code == 404:
        raise HTTPException(409, "The image is not in storage yet. Retry the upload.")
    if not response.is_success:
        raise HTTPException(503, "Image storage rejected the request. Check the storage migration and sign-in session.")
    try:
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError()
        return data
    except ValueError:
        raise HTTPException(503, "Image storage returned an invalid response.") from None


def sign_upload(object_key: str, token: str) -> str:
    """Return a token for a server-generated object key, without allowing overwrite."""
    data = storage_request("POST", f"object/upload/sign/{IMAGE_BUCKET}/{object_key}", token, {})
    signed_url = data.get("url")
    if isinstance(signed_url, str):
        tokens = parse_qs(urlparse(signed_url).query).get("token")
        if tokens:
            return tokens[0]
    raise HTTPException(503, "Image storage did not return an upload token.")


def object_info(object_key: str, token: str) -> dict:
    return storage_request("GET", f"object/info/{IMAGE_BUCKET}/{object_key}", token)


def sign_preview(object_key: str, token: str) -> str:
    data = storage_request("POST", f"object/sign/{IMAGE_BUCKET}/{object_key}", token, {"expiresIn": 300})
    path = data.get("signedURL")
    if not isinstance(path, str) or not path.startswith("/object/sign/"):
        raise HTTPException(503, "Image storage did not return a preview URL.")
    return f"{os.environ['SUPABASE_URL'].rstrip('/')}/storage/v1{path}"
