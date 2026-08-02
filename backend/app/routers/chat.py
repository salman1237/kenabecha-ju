import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation, Message
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.chat import ConversationListingOut, ConversationOut, MessageOut, SendMessageRequest
from app.services import chat_service, listing_service, notification_service
from app.websocket.manager import manager

settings = get_settings()

router = APIRouter(tags=["chat"])


def _to_conversation_out(
    conversation: Conversation, user: User, last_message: Message | None, unread_count: int
) -> ConversationOut:
    is_seller = user.id == conversation.seller_id
    counterparty = conversation.buyer if is_seller else conversation.seller
    listing = conversation.listing
    return ConversationOut(
        id=conversation.id,
        listing=ConversationListingOut(
            id=listing.id,
            title=listing.title,
            price=listing.price,
            price_type=listing.price_type,
            status=listing.status,
            image_url=listing.images[0].image_url if listing.images else None,
        ),
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


def _sender_display_name(conversation: Conversation, sender_id: uuid.UUID) -> str:
    if sender_id == conversation.buyer_id:
        return conversation.buyer.full_name
    if conversation.shop is not None:
        return conversation.shop.shop_name
    return conversation.seller.full_name


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_message(
    conversation_id: uuid.UUID,
    payload: SendMessageRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    conversation = await chat_service.get_conversation_for_user(db, conversation_id, user)
    message = await chat_service.send_message(db, conversation, user, payload.content)
    await manager.send_to_user(
        message.receiver_id,
        {"type": "message", "conversation_id": str(conversation.id), "message": MessageOut.model_validate(message).model_dump(mode="json")},
    )

    sender_name = _sender_display_name(conversation, user.id)
    await notification_service.notify(
        db,
        background_tasks,
        message.receiver_id,
        NotificationType.new_message,
        title=f"New message from {sender_name}",
        body=message.content[:200],
        link_url=f"/inbox/{conversation.id}",
        email_subject=f"New message from {sender_name} on KenaBecha JU",
        email_body=(
            f"{sender_name} sent you a message about \"{conversation.listing.title}\":\n\n"
            f"{message.content}\n\n"
            f"Reply at: {settings.FRONTEND_URL}/inbox/{conversation.id}"
        ),
        email_if_offline_only=True,
        related_conversation_id=conversation.id,
    )

    return message


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_conversation_read(
    conversation_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    conversation = await chat_service.get_conversation_for_user(db, conversation_id, user)
    await chat_service.mark_read(db, conversation, user)
