import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, Message
from app.models.listing import Listing
from app.models.user import User


async def get_or_create_conversation(db: AsyncSession, listing: Listing, buyer: User) -> Conversation:
    if listing.seller_id == buyer.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't message yourself about your own listing")
    if not listing.is_active or listing.deleted_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This listing is no longer available")

    result = await db.execute(
        select(Conversation).where(
            Conversation.listing_id == listing.id, Conversation.buyer_id == buyer.id
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is not None:
        return conversation

    conversation = Conversation(
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=listing.seller_id,
        shop_id=listing.shop_id,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def get_conversation_for_user(db: AsyncSession, conversation_id: uuid.UUID, user: User) -> Conversation:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    if user.id not in (conversation.buyer_id, conversation.seller_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You're not part of this conversation")
    return conversation


async def list_conversations(
    db: AsyncSession, user: User, shop_id: uuid.UUID | None = None, personal_only: bool = False
) -> list[dict]:
    query = select(Conversation).where(
        or_(Conversation.buyer_id == user.id, Conversation.seller_id == user.id)
    )
    if shop_id is not None:
        query = query.where(Conversation.shop_id == shop_id)
    if personal_only:
        query = query.where(Conversation.shop_id.is_(None))
    query = query.order_by(Conversation.last_message_at.desc().nulls_last(), Conversation.created_at.desc())

    conversations = list((await db.execute(query)).scalars().unique().all())
    if not conversations:
        return []
    conv_ids = [c.id for c in conversations]

    last_messages_query = (
        select(Message)
        .where(Message.conversation_id.in_(conv_ids))
        .order_by(Message.conversation_id, Message.created_at.desc())
        .distinct(Message.conversation_id)
    )
    last_messages = {m.conversation_id: m for m in (await db.execute(last_messages_query)).scalars().all()}

    unread_query = (
        select(Message.conversation_id, func.count())
        .where(
            Message.conversation_id.in_(conv_ids),
            Message.receiver_id == user.id,
            Message.read_at.is_(None),
        )
        .group_by(Message.conversation_id)
    )
    unread_counts = dict((await db.execute(unread_query)).all())

    return [
        {
            "conversation": c,
            "last_message": last_messages.get(c.id),
            "unread_count": unread_counts.get(c.id, 0),
        }
        for c in conversations
    ]


async def get_last_message(db: AsyncSession, conversation: Conversation) -> Message | None:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def count_unread(db: AsyncSession, conversation: Conversation, user: User) -> int:
    result = await db.execute(
        select(func.count()).where(
            Message.conversation_id == conversation.id,
            Message.receiver_id == user.id,
            Message.read_at.is_(None),
        )
    )
    return result.scalar_one()


async def list_messages(
    db: AsyncSession, conversation: Conversation, before: datetime | None = None, limit: int = 50
) -> list[Message]:
    query = select(Message).where(Message.conversation_id == conversation.id)
    if before is not None:
        query = query.where(Message.created_at < before)
    query = query.order_by(Message.created_at.desc()).limit(limit)
    messages = list((await db.execute(query)).scalars().all())
    return list(reversed(messages))


async def send_message(
    db: AsyncSession,
    conversation: Conversation,
    sender: User,
    content: str,
    image_url: str | None = None,
) -> Message:
    receiver_id = conversation.seller_id if sender.id == conversation.buyer_id else conversation.buyer_id
    message = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        receiver_id=receiver_id,
        content=content,
        image_url=image_url,
    )
    db.add(message)
    conversation.last_message_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(message)
    return message


async def mark_read(db: AsyncSession, conversation: Conversation, user: User) -> list[uuid.UUID]:
    """Marks the caller's unread messages read and returns their ids, so the
    router can push a read receipt to the sender. Returns empty when there
    was nothing unread — callers use that to skip a pointless WS frame."""
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conversation.id,
            Message.receiver_id == user.id,
            Message.read_at.is_(None),
        )
    )
    now = datetime.now(UTC)
    marked: list[uuid.UUID] = []
    for message in result.scalars().all():
        message.read_at = now
        marked.append(message.id)
    await db.commit()
    return marked
