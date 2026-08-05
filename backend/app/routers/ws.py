import uuid

from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect

from app.core.dependencies import ACCESS_TOKEN_COOKIE, get_current_user_ws
from app.db.session import async_session_maker
from app.models.conversation import Conversation
from app.websocket.manager import manager

router = APIRouter()


async def _relay_typing(user_id: uuid.UUID, payload: dict) -> None:
    """Forwards a typing signal to the other participant.

    Membership is re-checked server-side on every frame — the client asserts
    a conversation_id, and without this check anyone holding a socket could
    spray typing events into conversations they aren't part of.
    """
    raw_id = payload.get("conversation_id")
    if not isinstance(raw_id, str):
        return
    try:
        conversation_id = uuid.UUID(raw_id)
    except ValueError:
        return

    async with async_session_maker() as db:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None:
            return
        if user_id not in (conversation.buyer_id, conversation.seller_id):
            return
        recipient_id = (
            conversation.seller_id if user_id == conversation.buyer_id else conversation.buyer_id
        )

    await manager.send_to_user(
        recipient_id,
        {
            "type": "typing",
            "conversation_id": str(conversation_id),
            "is_typing": bool(payload.get("is_typing", True)),
        },
    )


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
) -> None:
    async with async_session_maker() as db:
        user = await get_current_user_ws(access_token, db)
        # Copy the id out while the session is still open. The ORM object is
        # detached once this block exits, so touching any lazy attribute on
        # it later would raise DetachedInstanceError — holding a plain UUID
        # makes that impossible rather than merely unlikely.
        user_id = user.id if user is not None else None

    if user_id is None:
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            payload = await websocket.receive_json()
            # Any inbound frame proves the client is alive.
            manager.touch(websocket)

            if not isinstance(payload, dict):
                continue
            message_type = payload.get("type")
            if message_type == "typing":
                await _relay_typing(user_id, payload)
            # "pong" needs no handling beyond the touch() above; anything
            # else is drained harmlessly.
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        # Malformed JSON or a mid-frame error shouldn't leave a dead socket
        # in the manager's registry.
        manager.disconnect(user_id, websocket)
