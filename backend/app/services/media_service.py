import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


def _sniff_image_type(data: bytes) -> str | None:
    """Identify an image by its magic bytes, or None if it isn't one we allow.

    `file.content_type` is supplied by the client and trivially spoofed, so
    on its own it would let someone upload an executable labelled
    `image/jpeg`. Reading the actual header is what makes the check mean
    something.

    This proves the file *starts* like a real image rather than fully
    validating it — proportionate here because uploads are only ever served
    back as static files, never executed or parsed server-side.
    """
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    # RIFF container: "RIFF" <4-byte little-endian size> "WEBP"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def save_image(file: UploadFile, subdir: str) -> str:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only JPEG, PNG, or WEBP images are allowed"
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image must be under 5MB")
    if not contents:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty")

    sniffed = _sniff_image_type(contents)
    if sniffed is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "That file isn't a valid JPEG, PNG, or WEBP image",
        )

    # Trust the sniffed type over the declared one for the stored extension,
    # so a mislabelled-but-genuine image is saved with the right suffix
    # instead of inheriting the client's claim.
    extension = ALLOWED_CONTENT_TYPES[sniffed]

    target_dir = Path(settings.MEDIA_ROOT) / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}{extension}"
    (target_dir / filename).write_bytes(contents)

    return f"/media/{subdir}/{filename}"


def delete_media(url: str | None) -> None:
    """Best-effort removal of a previously stored upload.

    Called when an avatar/logo/cover is replaced, so superseded files don't
    accumulate on the volume forever. Never raises: losing the old file is
    not a reason to fail the user's update, and the path may legitimately be
    absent (already deleted, or an external URL such as a Google avatar).
    """
    if not url or not url.startswith("/media/"):
        return

    relative = url.removeprefix("/media/")
    media_root = Path(settings.MEDIA_ROOT).resolve()
    target = (media_root / relative).resolve()

    # Refuse anything that escapes MEDIA_ROOT — the value ultimately traces
    # back to a DB column, so a traversal payload written there must not be
    # able to delete arbitrary files.
    if not target.is_relative_to(media_root):
        logger.warning("Refusing to delete media outside MEDIA_ROOT: %s", url)
        return

    try:
        target.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete superseded media file: %s", target, exc_info=True)
