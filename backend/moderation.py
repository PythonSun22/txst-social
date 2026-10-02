"""OpenAI text/image screening for FR-90–92; database decisions live in the worker."""

import argparse
import math
import os
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from json import JSONDecodeError
from pathlib import Path
from time import perf_counter
from typing import Annotated

from dotenv import load_dotenv
from openai import APIConnectionError, APIError, APIStatusError, OpenAI
from pydantic import BaseModel, Field, StrictBool, ValidationError, model_validator


MODERATION_MODEL = "omni-moderation-latest"
# This bounds a network operation; durable job retries are owned by the worker.
REQUEST_TIMEOUT_SECONDS = 10


class ModerationError(RuntimeError):
    """Screening did not complete; callers must not treat this as approval."""

    def __init__(self, message: str, *, code: str = "screening_failed", retry_after: float = 0):
        super().__init__(message)
        self.code = code
        self.retry_after = retry_after


class ModerationCategories(BaseModel):
    """Provider signals, not Boko Lynx allow/block decisions (FR-91)."""

    flagged: StrictBool
    categories: dict[str, StrictBool] = Field(min_length=1)
    category_scores: dict[str, Annotated[float, Field(ge=0, le=1)]] = Field(
        min_length=1
    )

    @model_validator(mode="after")
    def matching_categories(self):
        if self.categories.keys() != self.category_scores.keys():
            raise ValueError("Category flags and scores must match.")
        return self

    @property
    def blocked(self) -> bool:
        """FR-91: any flag blocks, even if the overall flag is inconsistent."""
        return self.flagged or any(self.categories.values())


class _ProviderResponse(BaseModel):
    model: str = Field(min_length=1)
    results: list[ModerationCategories] = Field(min_length=1, max_length=1)


class TextModerationResult(ModerationCategories):
    """Screening signals and metadata for future FR-92 audit integration."""

    model: str
    latency_ms: int


def moderate_text(text: str) -> TextModerationResult:
    """Screen one text, such as a post's combined title and body or a comment.

    Loads backend/.env independently of the working directory. No database or
    FastAPI server is needed. Network/provider failures raise ModerationError;
    ValueError indicates blank input. This function never changes post status.
    """
    if not text.strip():
        raise ValueError("Text to screen must not be blank.")

    return moderate_content(text)


def moderate_content(text: str, image_urls: tuple[str, ...] = ()) -> TextModerationResult:
    """Screen a complete post in one request; private URLs are never returned or logged."""
    if not text.strip():
        raise ValueError("Text to screen must not be blank.")
    if len(image_urls) > 10:
        raise ValueError("At most ten images can be screened per post.")
    payload = text if not image_urls else [
        {"type": "text", "text": text},
        *({"type": "image_url", "image_url": {"url": url}} for url in image_urls),
    ]

    load_dotenv(Path(__file__).resolve().with_name(".env"))
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ModerationError("Set OPENAI_API_KEY in backend/.env before screening.", code="configuration")

    started = perf_counter()
    try:
        with OpenAI(
            api_key=api_key,
            timeout=REQUEST_TIMEOUT_SECONDS,
            max_retries=0,
        ) as client:
            response = client.moderations.create(model=MODERATION_MODEL, input=payload)
            result = _ProviderResponse.model_validate(
                response.model_dump(by_alias=True, exclude_unset=True)
            )
    except APIStatusError as error:
        # Provider bodies may contain submitted text; don't echo them to logs.
        status = error.status_code
        hint = error.response.headers.get("retry-after", "0")
        try:
            retry_after = max(0, float(hint))
        except ValueError:
            try:
                retry_after = max(0, (parsedate_to_datetime(hint) - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                retry_after = 0
        if not math.isfinite(retry_after):
            retry_after = 0
        raise ModerationError(
            f"OpenAI moderation returned HTTP {status}. No screening result is available.",
            code=f"provider_http_{status}", retry_after=retry_after,
        ) from None
    except APIConnectionError:
        raise ModerationError(
            "Could not reach OpenAI moderation or the request timed out. "
            "No screening result is available.", code="provider_connection",
        ) from None
    except (ValidationError, AttributeError, JSONDecodeError):
        raise ModerationError("OpenAI returned an invalid moderation response.", code="provider_response") from None
    except APIError:
        raise ModerationError("OpenAI moderation failed. No screening result is available.") from None

    return TextModerationResult(
        **result.results[0].model_dump(),
        model=result.model,
        latency_ms=round((perf_counter() - started) * 1000),
    )


def main() -> int:
    """Run a manual screening check and print provider signals as JSON."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("text", help="Text to send to OpenAI for screening")
    args = parser.parse_args()
    try:
        result = moderate_text(args.text)
    except (ModerationError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(result.model_dump_json(indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
