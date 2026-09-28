"""Worker-only access to pending private images (FR-32/90). Never used by public routes."""
import os
from urllib.parse import quote

import httpx

from image_schemas import IMAGE_BUCKET
from moderation import ModerationError


def sign_moderation_image(object_key: str) -> str:
    """Sign a stored attachment key without retaining an author's expiring session."""
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SECRET_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise ModerationError("Configure a backend Storage secret for image moderation.", code="storage_configuration")
    # The new opaque secret is an apikey, not a JWT. Legacy service_role keys need both.
    headers = {"apikey": key}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    try:
        response = httpx.post(
            f"{base}/storage/v1/object/sign/{IMAGE_BUCKET}/{quote(object_key, safe='/')}",
            headers=headers, json={"expiresIn": 300}, timeout=10,
        )
        if not response.is_success:
            raise ModerationError("Unable to access a pending image.", code="storage_response")
        path = response.json().get("signedURL")
        if not isinstance(path, str) or not path.startswith(f"/object/sign/{IMAGE_BUCKET}/"):
            raise ValueError()
        return f"{base}/storage/v1{path}"
    except (httpx.RequestError, ValueError, AttributeError):
        raise ModerationError("Image screening could not access Storage.", code="storage_unavailable") from None
