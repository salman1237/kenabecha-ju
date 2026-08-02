from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect

from app.core.dependencies import ACCESS_TOKEN_COOKIE, get_current_user_ws
from app.db.session import async_session_maker
from app.websocket.manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
) -> None:
    async with async_session_maker() as db:
        user = await get_current_user_ws(access_token, db)

    if user is None:
        await websocket.close(code=4401)
        return

    await manager.connect(user.id, websocket)
    try:
        while True:
            # Connection is server-push only for now; drain any client frames
            # (e.g. ping keepalives) without acting on them.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user.id, websocket)
