import uuid

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_token import DeviceToken
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services import push_service
from app.services.email_service import send_email
from app.websocket.manager import manager


async def _create(
    db: AsyncSession,
    user_id: uuid.UUID,
    ntype: NotificationType,
    title: str,
    body: str | None,
    link_url: str | None,
    related_listing_id: uuid.UUID | None = None,
    related_shop_id: uuid.UUID | None = None,
    related_conversation_id: uuid.UUID | None = None,
    related_post_id: uuid.UUID | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        body=body,
        link_url=link_url,
        related_listing_id=related_listing_id,
        related_shop_id=related_shop_id,
        related_conversation_id=related_conversation_id,
        related_post_id=related_post_id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def notify(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    user_id: uuid.UUID,
    ntype: NotificationType,
    title: str,
    body: str | None,
    link_url: str | None,
    email_subject: str,
    email_body: str,
    *,
    email_if_offline_only: bool = False,
    related_listing_id: uuid.UUID | None = None,
    related_shop_id: uuid.UUID | None = None,
    related_conversation_id: uuid.UUID | None = None,
    related_post_id: uuid.UUID | None = None,
) -> Notification:
    """Creates the in-app notification row, pushes it live over the recipient's
    WebSocket connection if they have one open, and queues an email unless this is
    a message notification and the recipient is currently online (the spec only
    asks for message emails "if user is offline" — other notification types always
    email regardless of online status)."""
    notification = await _create(
        db,
        user_id,
        ntype,
        title,
        body,
        link_url,
        related_listing_id,
        related_shop_id,
        related_conversation_id,
        related_post_id,
    )

    is_online = manager.is_online(user_id)
    await manager.send_to_user(
        user_id,
        {"type": "notification", "notification": NotificationOut.model_validate(notification).model_dump(mode="json")},
    )

    if not (email_if_offline_only and is_online):
        recipient = await db.get(User, user_id)
        if recipient is not None:
            background_tasks.add_task(send_email, recipient.email, email_subject, email_body)

    device_tokens = (
        await db.execute(select(DeviceToken.fcm_token).where(DeviceToken.user_id == user_id))
    ).scalars().all()
    if device_tokens:
        background_tasks.add_task(push_service.send_push_to_tokens, list(device_tokens), title, body, link_url)

    return notification


async def register_device_token(db: AsyncSession, user: User, fcm_token: str, platform: str) -> None:
    # Upsert by token, not by (user, token): the same physical device can be
    # re-registered under a different account after a logout/login, and the
    # old row must move to the new owner rather than sit around double-
    # pushing to both accounts.
    existing = (
        await db.execute(select(DeviceToken).where(DeviceToken.fcm_token == fcm_token))
    ).scalar_one_or_none()
    if existing is not None:
        existing.user_id = user.id
        existing.platform = platform
    else:
        db.add(DeviceToken(user_id=user.id, fcm_token=fcm_token, platform=platform))
    await db.commit()


async def unregister_device_token(db: AsyncSession, user: User, fcm_token: str) -> None:
    await db.execute(delete(DeviceToken).where(DeviceToken.fcm_token == fcm_token, DeviceToken.user_id == user.id))
    await db.commit()


async def list_notifications(db: AsyncSession, user: User, limit: int = 30) -> tuple[list[Notification], int]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    items = list(result.scalars().all())
    unread_count = (
        await db.execute(
            select(func.count()).where(Notification.user_id == user.id, Notification.is_read.is_(False))
        )
    ).scalar_one()
    return items, unread_count


async def mark_read(db: AsyncSession, notification_id: uuid.UUID, user: User) -> Notification:
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification


async def mark_all_read(db: AsyncSession, user: User) -> None:
    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()
