import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

import redis.asyncio as redis
from fastapi import WebSocket

from app.core.config import get_settings

logger = logging.getLogger(__name__)

#: How often the server pings each open socket.
HEARTBEAT_INTERVAL_SECONDS = 30
#: A socket with no inbound traffic for this long is considered dead.
#: Comfortably more than two intervals so one missed pong on a briefly
#: flaky connection doesn't disconnect someone who's still there.
HEARTBEAT_TIMEOUT_SECONDS = 90

#: Every worker process subscribes to this one channel and filters by
#: user_id itself on receipt, rather than each process managing per-user
#: subscriptions. Simplest correct fan-out at this app's traffic — a
#: subscription-per-user scheme would need bookkeeping every connect/
#: disconnect just to avoid work a filter-on-receive already does for free.
BROADCAST_CHANNEL = "ws:broadcast"


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}
        #: Last time we heard anything from each socket. A client that never
        #: speaks unprompted still refreshes this via its pong replies.
        self._last_seen: dict[WebSocket, datetime] = {}
        self._reaper: asyncio.Task | None = None
        self._redis: "redis.Redis | None" = None
        self._pubsub: "redis.client.PubSub | None" = None
        self._listener: asyncio.Task | None = None

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)
        self.touch(websocket)

    def touch(self, websocket: WebSocket) -> None:
        """Record client liveness. Called on every inbound frame."""
        self._last_seen[websocket] = datetime.now(UTC)

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        self._last_seen.pop(websocket, None)
        connections = self._connections.get(user_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            del self._connections[user_id]

    async def _send_local(self, user_id: uuid.UUID, data: dict) -> None:
        """Delivers only to sockets this process itself currently holds."""
        for websocket in list(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(data)
            except Exception:
                self.disconnect(user_id, websocket)

    async def send_to_user(self, user_id: uuid.UUID, data: dict) -> None:
        """Publishes for every worker process to see, rather than delivering
        locally here directly.

        Production runs multiple Uvicorn worker *processes*, each with its
        own independent copy of `_connections` — a user's live socket is
        registered in whichever process happened to accept their WebSocket
        upgrade, which is effectively random from this process's point of
        view. A purely local send silently misses the recipient whenever
        their socket lives in a different process, which used to be exactly
        this bug: a message saved correctly but never pushed live.

        Every process (including this one) subscribes to the same Redis
        channel via `start_pubsub` and delivers locally to whatever sockets
        it actually holds, so publishing here is correct regardless of which
        process — or how many — end up holding the recipient's connection.
        """
        if self._redis is None:
            # Redis isn't configured/reachable — fall back to this process's
            # own registry. Exactly correct for a single-worker dev server,
            # and strictly better than dropping the push if Redis is briefly
            # unavailable in production.
            await self._send_local(user_id, data)
            return
        await self._redis.publish(
            BROADCAST_CHANNEL, json.dumps({"user_id": str(user_id), "data": data})
        )

    def is_online(self, user_id: uuid.UUID) -> bool:
        return bool(self._connections.get(user_id))

    def connection_count(self) -> int:
        return sum(len(s) for s in self._connections.values())

    # -- Redis fan-out -----------------------------------------------------

    async def start_pubsub(self) -> None:
        """Subscribes this process to the shared broadcast channel.

        Started inside the running event loop (see main.py's lifespan) for
        the same reason start_heartbeat is — a Redis connection has to be
        opened from inside the loop it'll be used on. A connection failure
        here is logged rather than raised: `send_to_user` already falls back
        to local-only delivery when `_redis` is unset, so a Redis outage at
        startup degrades chat to single-process delivery instead of crashing
        the app.
        """
        if self._listener is not None and not self._listener.done():
            return
        settings = get_settings()
        try:
            client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            await client.ping()
        except Exception:
            logger.exception("Could not connect to Redis at startup — WebSocket "
                              "delivery will be local-only for this process")
            return
        self._redis = client
        self._pubsub = self._redis.pubsub()
        await self._pubsub.subscribe(BROADCAST_CHANNEL)
        self._listener = asyncio.create_task(self._run_pubsub())

    async def _run_pubsub(self) -> None:
        assert self._pubsub is not None
        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    payload = json.loads(message["data"])
                    await self._send_local(uuid.UUID(payload["user_id"]), payload["data"])
                except Exception:
                    logger.exception("Malformed WebSocket fan-out message")
        except asyncio.CancelledError:
            raise
        except Exception:
            # A dead listener must not silently disable cross-process
            # delivery for the rest of the process's life without a trace.
            logger.exception("WebSocket pub/sub listener died")

    async def stop_pubsub(self) -> None:
        if self._listener is not None:
            self._listener.cancel()
            try:
                await self._listener
            except asyncio.CancelledError:
                pass
            self._listener = None
        if self._pubsub is not None:
            await self._pubsub.unsubscribe(BROADCAST_CHANNEL)
            await self._pubsub.aclose()
            self._pubsub = None
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    # -- heartbeat -------------------------------------------------------

    async def sweep(self) -> int:
        """Ping every socket and drop the ones that have gone quiet.

        Without this, a client that vanishes uncleanly (lid closed, network
        dropped) stays registered until the next send happens to fail. That
        leaks memory and — worse — keeps `is_online` returning True for
        someone who isn't there, which suppresses the offline-email path in
        notification_service so they never learn they got a message.

        Returns how many connections were reaped, for tests/observability.
        """
        now = datetime.now(UTC)
        reaped = 0

        for user_id, sockets in list(self._connections.items()):
            for websocket in list(sockets):
                last = self._last_seen.get(websocket)
                if last is not None and (now - last).total_seconds() > HEARTBEAT_TIMEOUT_SECONDS:
                    logger.info("Reaping stale WebSocket for user %s", user_id)
                    self.disconnect(user_id, websocket)
                    reaped += 1
                    try:
                        await websocket.close(code=1001)
                    except Exception:
                        pass  # already gone — removing it from the registry is the point
                    continue

                try:
                    # Application-level ping: Starlette doesn't surface
                    # protocol ping/pong, so the client replies with a
                    # `pong` frame that the /ws handler counts as liveness.
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    self.disconnect(user_id, websocket)
                    reaped += 1

        return reaped

    async def _run_heartbeat(self) -> None:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
            try:
                await self.sweep()
            except Exception:
                # A sweep failure must never kill the loop — that would
                # silently disable reaping for the process's lifetime.
                logger.exception("WebSocket heartbeat sweep failed")

    def start_heartbeat(self) -> None:
        if self._reaper is None or self._reaper.done():
            self._reaper = asyncio.create_task(self._run_heartbeat())

    async def stop_heartbeat(self) -> None:
        if self._reaper is not None:
            self._reaper.cancel()
            try:
                await self._reaper
            except asyncio.CancelledError:
                pass
            self._reaper = None


manager = ConnectionManager()
