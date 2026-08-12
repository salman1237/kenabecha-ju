import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.assistant import AssistantChatIn
from app.services import assistant_service, assistant_settings_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat")
async def chat(
    payload: AssistantChatIn,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    settings = await assistant_settings_service.get_assistant_settings(db)
    if not settings["enabled"]:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="The assistant is currently unavailable")

    async def event_stream():
        async for event in assistant_service.run_assistant(
            db,
            message=payload.message,
            history=payload.history,
            locale=payload.locale,
            system_prompt=settings["system_prompt"],
        ):
            yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # Traefik (Dokploy's proxy in production) buffers proxied
            # responses by default, which would silently defeat streaming.
            "X-Accel-Buffering": "no",
        },
    )
