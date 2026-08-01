import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


async def save_image(file: UploadFile, subdir: str) -> str:
    extension = ALLOWED_CONTENT_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only JPEG, PNG, or WEBP images are allowed"
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image must be under 5MB")

    target_dir = Path(settings.MEDIA_ROOT) / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}{extension}"
    (target_dir / filename).write_bytes(contents)

    return f"/media/{subdir}/{filename}"
