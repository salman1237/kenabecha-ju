import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, Message
from app.models.listing import Listing
from app.models.user import User
from app.services import shop_service


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

    # For a shop listing, route to the shop's owner rather than whichever
    # collaborator happened to create this particular listing -- a stable,
    # centralized seller_id (see also the notification fan-out in
    # routers/chat.py, which reaches the rest of the team from there).
    seller_id = listing.shop.owner_id if listing.shop is not None else listing.seller_id

    conversation = Conversation(
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=seller_id,
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
    if user.id in (conversation.buyer_id, conversation.seller_id):
        return conversation
    # Any other collaborator on the shop this conversation belongs to can
    # also read and reply -- not just whoever is literally stamped as
    # seller_id, the same "shop team is one unit" reasoning already used for
    # listing management (shop_service.has_shop_access).
    if conversation.shop_id is not None and await shop_service.has_shop_access(db, conversation.shop_id, user.id):
        return conversation
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You're not part of this conversation")


async def list_conversations(
    db: AsyncSession, user: User, shop_id: uuid.UUID | None = None, personal_only: bool = False
) -> list[dict]:
    query = select(Conversation).where(
        or_(
            Conversation.buyer_id == user.id,
            Conversation.seller_id == user.id,
            # A collaborator whose shop owns this conversation but who isn't
            # the literal seller_id must still see it in their own inbox.
            Conversation.shop_id.in_(shop_service.managed_shop_ids_select(user.id)),
        )
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

    # A message sent to "the shop side" is always stamped receiver_id ==
    # Conversation.seller_id (see send_message below), not any one specific
    # team member's id -- so a collaborator's unread count has to match on
    # that shared marker too, not just messages addressed to their own id.
    unread_query = (
        select(Message.conversation_id, func.count())
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Message.conversation_id.in_(conv_ids),
            Message.read_at.is_(None),
            or_(
                Message.receiver_id == user.id,
                and_(
                    Conversation.shop_id.in_(shop_service.managed_shop_ids_select(user.id)),
                    Message.receiver_id == Conversation.seller_id,
                ),
            ),
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


async def _receiver_conditions(db: AsyncSession, conversation: Conversation, user: User):
    """Which Message.receiver_id values count as "addressed to this viewer"
    for a given conversation. Always their own id; also the conversation's
    shared seller-side marker when they manage its shop, since a message
    sent to the shop is stamped with that one seller_id regardless of which
    team member actually reads/replies to it (see send_message)."""
    conditions = [Message.receiver_id == user.id]
    if conversation.shop_id is not None and await shop_service.has_shop_access(db, conversation.shop_id, user.id):
        conditions.append(Message.receiver_id == conversation.seller_id)
    return conditions


async def count_unread(db: AsyncSession, conversation: Conversation, user: User) -> int:
    conditions = await _receiver_conditions(db, conversation, user)
    result = await db.execute(
        select(func.count()).where(
            Message.conversation_id == conversation.id,
            Message.read_at.is_(None),
            or_(*conditions),
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
    was nothing unread — callers use that to skip a pointless WS frame.

    For a shop conversation this is shared team state, not per-user: any
    collaborator opening the thread marks it read for the whole team, same
    as the unread count they just saw was itself a team total."""
    conditions = await _receiver_conditions(db, conversation, user)
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conversation.id,
            Message.read_at.is_(None),
            or_(*conditions),
        )
    )
    now = datetime.now(UTC)
    marked: list[uuid.UUID] = []
    for message in result.scalars().all():
        message.read_at = now
        marked.append(message.id)
    await db.commit()
    return marked
