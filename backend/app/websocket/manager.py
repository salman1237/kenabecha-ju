import asyncio
import logging
import uuid
from datetime import UTC, datetime

from fastapi import WebSocket

logger = logging.getLogger(__name__)

#: How often the server pings each open socket.
HEARTBEAT_INTERVAL_SECONDS = 30
#: A socket with no inbound traffic for this long is considered dead.
#: Comfortably more than two intervals so one missed pong on a briefly
#: flaky connection doesn't disconnect someone who's still there.
HEARTBEAT_TIMEOUT_SECONDS = 90


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}
        #: Last time we heard anything from each socket. A client that never
        #: speaks unprompted still refreshes this via its pong replies.
        self._last_seen: dict[WebSocket, datetime] = {}
        self._reaper: asyncio.Task | None = None

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

    async def send_to_user(self, user_id: uuid.UUID, data: dict) -> None:
        for websocket in list(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(data)
            except Exception:
                self.disconnect(user_id, websocket)

    def is_online(self, user_id: uuid.UUID) -> bool:
        return bool(self._connections.get(user_id))

    def connection_count(self) -> int:
        return sum(len(s) for s in self._connections.values())

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
