"""Guards that protect the system rather than implement a feature: chat
eligibility, rate limiting, and upload validation."""

import io

import pytest
from fastapi import HTTPException, UploadFile

from app.core import rate_limit
from app.models.listing import ListingStatus
from app.services import media_service
from tests.conftest import login, make_listing, make_user

# --- chat -------------------------------------------------------------------


async def test_buyer_can_start_a_conversation(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    buyer = await make_user(db)
    await login(client, buyer)

    res = await client.post(f"/listings/{listing.id}/contact")
    assert res.status_code == 201
    assert res.json()["listing"]["id"] == str(listing.id)


async def test_contacting_twice_reuses_the_same_thread(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    buyer = await make_user(db)
    await login(client, buyer)

    first = await client.post(f"/listings/{listing.id}/contact")
    second = await client.post(f"/listings/{listing.id}/contact")
    assert first.json()["id"] == second.json()["id"]


async def test_sellers_cannot_message_themselves(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    await login(client, seller)

    assert (await client.post(f"/listings/{listing.id}/contact")).status_code == 400


async def test_cannot_start_a_chat_about_a_removed_listing(client, db):
    """Regression, Phase 29: a buyer could open a thread about stock that no
    longer existed, and the seller had no context for the message."""
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.removed)
    listing.is_active = False
    await db.flush()
    buyer = await make_user(db)
    await login(client, buyer)

    assert (await client.post(f"/listings/{listing.id}/contact")).status_code == 404


async def test_conversations_require_authentication(client):
    assert (await client.get("/conversations")).status_code == 401


async def test_outsiders_cannot_read_someone_elses_conversation(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    buyer = await make_user(db)
    await login(client, buyer)
    conversation_id = (await client.post(f"/listings/{listing.id}/contact")).json()["id"]

    outsider = await make_user(db)
    await login(client, outsider)
    res = await client.get(f"/conversations/{conversation_id}")
    assert res.status_code in (403, 404)


# --- rate limiting ----------------------------------------------------------


async def test_rate_limit_blocks_after_the_allowance(db):
    """Counters live in Postgres, not process memory: production runs four
    uvicorn workers, and an in-memory counter would allow four times the
    intended limit."""
    limit = rate_limit.RateLimit(scope="test-scope", times=3, seconds=3600)

    for _ in range(3):
        await rate_limit.enforce(db, limit, "1.2.3.4")

    with pytest.raises(HTTPException) as exc:
        await rate_limit.enforce(db, limit, "1.2.3.4")
    assert exc.value.status_code == 429


async def test_rate_limit_is_per_caller(db):
    limit = rate_limit.RateLimit(scope="test-scope-2", times=2, seconds=3600)

    for _ in range(2):
        await rate_limit.enforce(db, limit, "10.0.0.1")

    # A different caller must start with a full allowance.
    await rate_limit.enforce(db, limit, "10.0.0.2")


async def test_rate_limit_scopes_are_independent(db):
    a = rate_limit.RateLimit(scope="scope-a", times=1, seconds=3600)
    b = rate_limit.RateLimit(scope="scope-b", times=1, seconds=3600)

    await rate_limit.enforce(db, a, "5.5.5.5")
    await rate_limit.enforce(db, b, "5.5.5.5")

    with pytest.raises(HTTPException):
        await rate_limit.enforce(db, a, "5.5.5.5")


# --- upload validation ------------------------------------------------------

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 64


def _upload(data: bytes, filename: str, content_type: str) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(data),
        filename=filename,
        headers={"content-type": content_type},
    )


@pytest.mark.parametrize(
    ("data", "expected"),
    [(PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")],
)
def test_magic_bytes_identify_real_images(data, expected):
    assert media_service._sniff_image_type(data) == expected


def test_magic_bytes_reject_a_disguised_file():
    """A script named .png with an image content-type is still not an image;
    only the bytes decide."""
    assert media_service._sniff_image_type(b"#!/bin/sh\nrm -rf /") is None


async def test_upload_rejects_a_disguised_file(tmp_path, monkeypatch):
    monkeypatch.setattr(media_service.settings, "MEDIA_ROOT", str(tmp_path))
    with pytest.raises(HTTPException) as exc:
        await media_service.save_image(
            _upload(b"not really an image", "payload.png", "image/png"), "listings"
        )
    assert exc.value.status_code == 400


async def test_upload_rejects_an_unsupported_content_type(tmp_path, monkeypatch):
    monkeypatch.setattr(media_service.settings, "MEDIA_ROOT", str(tmp_path))
    with pytest.raises(HTTPException) as exc:
        await media_service.save_image(_upload(PNG, "a.gif", "image/gif"), "listings")
    assert exc.value.status_code == 400


async def test_upload_rejects_an_oversized_file(tmp_path, monkeypatch):
    monkeypatch.setattr(media_service.settings, "MEDIA_ROOT", str(tmp_path))
    oversized = PNG + b"\x00" * media_service.MAX_FILE_SIZE_BYTES
    with pytest.raises(HTTPException) as exc:
        await media_service.save_image(_upload(oversized, "big.png", "image/png"), "listings")
    assert exc.value.status_code == 400


async def test_upload_accepts_a_real_image(tmp_path, monkeypatch):
    monkeypatch.setattr(media_service.settings, "MEDIA_ROOT", str(tmp_path))
    url = await media_service.save_image(_upload(PNG, "photo.png", "image/png"), "listings")
    assert url.startswith("/media/listings/")
    assert url.endswith(".png")
