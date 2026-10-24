"""Shared image states for processing, cleanup and owner recovery (FR-32/90)."""

PROCESSING_STATUSES = ("pending", "processing")
TERMINAL_STATUSES = ("ready", "blocked", "failed")
DISCARDABLE_ERRORS = ("invalid_image", "upload_expired", "unused_image")


def has_saved_input(upload):
    return (upload.uploaded_at is not None and upload.original_deleted_at is None
            and upload.deleted_at is None)


def can_retry_image(upload):
    return bool(upload.processing_status == "failed" and upload.recovery_required
                and has_saved_input(upload))


def image_processing_state(upload):
    if upload.processing_status == "blocked":
        return "image_rejected", "This image was rejected by automatic screening."
    if upload.processing_status == "ready":
        return "ready", "Image processing and screening are complete."
    if upload.processing_status == "failed":
        if not has_saved_input(upload):
            return "failed", "The saved image input is unavailable. Select another image."
        if not can_retry_image(upload):
            return "failed", "This image could not be processed. Select another image."
    if upload.processing_error or can_retry_image(upload):
        return "service_unavailable", "Image processing is unavailable. Your saved input is preserved for retry."
    return "waiting", "Waiting for image processing and moderation."
