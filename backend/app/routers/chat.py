import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.schemas.chat import ConversationOut, MessageOut, SendMessageRequest
from app.services import chat_service, listing_service
from app.websocket.manager import manager

router = APIRouter(tags=["chat"])


def _to_conversation_out(
    conversation: Conversation, user: User, last_message: Message | None, unread_count: int
) -> ConversationOut:
    is_seller = user.id == conversation.seller_id
    counterparty = conversation.buyer if is_seller else conversation.seller
    return ConversationOut(
        id=conversation.id,
        listing_id=conversation.listing_id,
        listing_title=conversation.listing.title,
        shop=conversation.shop,
        counterparty=counterparty,
        is_seller=is_seller,
        last_message_preview=last_message.content[:140] if last_message else None,
        last_message_at=conversation.last_message_at,
        unread_count=unread_count,
        created_at=conversation.created_at,
    )


@router.post(
    "/listings/{listing_id}/contact", response_model=ConversationOut, status_code=status.HTTP_201_CREATED
)
async def contact_seller(
    listing_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ConversationOut:
    listing = await listing_service.get_listing(db, listing_id)
    conversation = await chat_service.get_or_create_conversation(db, listing, user)
    return _to_conversation_out(conversation, user, last_message=None, unread_count=0)


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    shop_id: uuid.UUID | None = None,
    personal_only: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    rows = await chat_service.list_conversations(db, user, shop_id, personal_only)
    return [
        _to_conversation_out(row["conversation"], user, row["last_message"], row["unread_count"])
        for row in rows
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ConversationOut:
    conversation = await chat_service.get_conversation_for_user(db, conversation_id, user)
    last_message = await chat_service.get_last_message(db, conversation)
    unread = await chat_service.count_unread(db, conversation, user)
    return _to_conversation_out(conversation, user, last_message, unread)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conversation_id: uuid.UUID,
    before: datetime | None = Query(default=None),
    limit: int = Query(default=50, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Message]:
    conversation = await chat_service.get_conversation_for_user(db, conversation_id, user)
    return await chat_service.list_messages(db, conversation, before, limit)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_message(
    conversation_id: uuid.UUID,
    payload: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    conversation = await chat_service.get_conversation_for_user(db, conversation_id, user)
    message = await chat_service.send_message(db, conversation, user, payload.content)
    await manager.send_to_user(
        message.receiver_id,
        {"type": "message", "conversation_id": str(conversation.id), "message": MessageOut.model_validate(message).model_dump(mode="json")},
    )
    return message


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_conversation_read(
    conversation_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    conversation = await chat_service.get_conversation_for_user(db, conversation_id, user)
    await chat_service.mark_read(db, conversation, user)
