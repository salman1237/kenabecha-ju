"""Periodic sweep that retires listings past their expiry date.

Runs as an asyncio task off the app lifespan, the same shape as the
WebSocket heartbeat, rather than pulling in a scheduler dependency for a
single hourly job.

Correctness does not depend on this task: browse_listings also filters on
expires_at, so a lapsed listing stops appearing whether or not the sweep
has run. The sweep exists to move `status` to `expired`, which is what the
seller's dashboard reads to offer a Renew button.
"""

import asyncio
import logging

from app.db.session import async_session_maker
from app.services import listing_service

logger = logging.getLogger(__name__)

SWEEP_INTERVAL_SECONDS = 3600


class ExpirySweeper:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _run(self) -> None:
        while True:
            try:
                async with async_session_maker() as db:
                    count = await listing_service.expire_stale_listings(db)
                if count:
                    logger.info("Expired %d listing(s)", count)
            except asyncio.CancelledError:
                raise
            except Exception:
                # A failed sweep must not kill the loop — the next pass will
                # pick up whatever this one missed, and browse stays correct
                # in the meantime regardless.
                logger.exception("Listing expiry sweep failed")
            await asyncio.sleep(SWEEP_INTERVAL_SECONDS)


sweeper = ExpirySweeper()
