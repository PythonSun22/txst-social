"""Backend-only bounded byte transfers for processing; never called by public routes."""
import base64
import os
from urllib.parse import quote

import httpx

from images.schemas import IMAGE_BUCKET, MAX_IMAGE_BYTES
from moderation.client import ModerationError


def settings():
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SECRET_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise ModerationError("Configure backend Storage access.", code="storage_configuration")
    headers = {"apikey": key}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    return f"{base}/storage/v1", headers


def read_image(key: str) -> bytes:
    base, headers = settings()
    try:
        with httpx.stream("GET", f"{base}/object/authenticated/{IMAGE_BUCKET}/{quote(key, safe='/')}", headers=headers, timeout=30) as response:
            if not response.is_success:
                raise ModerationError("Unable to read image.", code="storage_read")
            result = bytearray()
            for chunk in response.iter_bytes():
                result.extend(chunk)
                if len(result) > MAX_IMAGE_BYTES:
                    raise ModerationError("Image exceeds the byte limit.", code="storage_size")
            return bytes(result)
    except httpx.RequestError:
        raise ModerationError("Image storage is unavailable.", code="storage_unavailable") from None


def write_image(key: str, data: bytes):
    base, headers = settings()
    try:
        response = httpx.post(f"{base}/object/{IMAGE_BUCKET}/{quote(key, safe='/')}",
                              headers={**headers, "Content-Type": "image/webp", "x-upsert": "false"},
                              content=data, timeout=30)
        if not response.is_success:
            raise ModerationError("Unable to store image version.", code="storage_write")
    except httpx.RequestError:
        raise ModerationError("Image storage is unavailable.", code="storage_unavailable") from None


def remove_images(keys: list[str]):
    if not keys:
        return
    base, headers = settings()
    try:
        response = httpx.request("DELETE", f"{base}/object/{IMAGE_BUCKET}", headers=headers,
                                 json={"prefixes": keys}, timeout=30)
        if not response.is_success:
            raise ModerationError("Unable to delete temporary image.", code="storage_delete")
    except httpx.RequestError:
        raise ModerationError("Image storage is unavailable.", code="storage_unavailable") from None


def image_data_url(data: bytes, content_type: str = "image/webp") -> str:
    return f"data:{content_type};base64,{base64.b64encode(data).decode('ascii')}"
