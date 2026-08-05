import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.models.rate_limit import RateLimitHit

logger = logging.getLogger(__name__)
settings = get_settings()


def client_identifier(request: Request) -> str:
    """Best-available caller identity for rate-limit bucketing.

    `X-Forwarded-For` is attacker-controlled unless a trusted proxy
    overwrites it, so it's only honoured when TRUST_PROXY_HEADERS is set.
    Trusting it by default would let anyone bypass every limit here just by
    sending a random header value.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Left-most entry is the original client; the proxy appends its own.
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@dataclass(frozen=True)
class RateLimit:
    """A limit of `times` requests per `seconds`, bucketed by `scope`."""

    scope: str
    times: int
    seconds: int


async def enforce(db: AsyncSession, limit: RateLimit, identifier: str) -> None:
    """Record an attempt and raise 429 once the window is exhausted.

    Sliding window: the count only covers attempts inside the trailing
    `seconds`, so a caller recovers gradually rather than waiting for a
    fixed window boundary to flip.
    """
    key = f"{limit.scope}:{identifier}"
    now = datetime.now(UTC)
    cutoff = now - timedelta(seconds=limit.seconds)

    # Purge this bucket's expired rows first — keeps the table bounded
    # without needing a separate sweeper job, and it's index-scoped so it
    # never touches other callers' rows.
    await db.execute(
        delete(RateLimitHit).where(
            RateLimitHit.bucket_key == key, RateLimitHit.created_at < cutoff
        )
    )

    used = (
        await db.execute(
            select(func.count()).select_from(RateLimitHit).where(RateLimitHit.bucket_key == key)
        )
    ).scalar_one()

    if used >= limit.times:
        oldest = (
            await db.execute(
                select(func.min(RateLimitHit.created_at)).where(RateLimitHit.bucket_key == key)
            )
        ).scalar_one()
        retry_after = max(1, int((oldest + timedelta(seconds=limit.seconds) - now).total_seconds()))
        logger.warning("Rate limit hit for %s (%s/%ss)", key, limit.times, limit.seconds)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )

    db.add(RateLimitHit(bucket_key=key))
    # Committed immediately so the attempt counts even if the request it
    # guards goes on to fail and roll back — otherwise a failing login
    # (exactly the case being defended against) would leave no trace.
    await db.commit()


def rate_limit(scope: str, times: int, seconds: int):
    """FastAPI dependency factory. Buckets by caller identity."""
    limit = RateLimit(scope=scope, times=times, seconds=seconds)

    async def dependency(request: Request, db: AsyncSession = Depends(get_db)) -> None:
        await enforce(db, limit, client_identifier(request))

    return dependency
