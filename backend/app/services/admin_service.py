import uuid
from datetime import UTC, datetime

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.conversation import Message
from app.core.search import LIKE_ESCAPE, like_contains
from app.models.listing import Listing, ListingStatus
from app.models.notification import NotificationType
from app.models.report import Report, ReportStatus
from app.models.shop import Shop
from app.models.user import User
from app.schemas.admin import AdminStatsOut
from app.services import auth_service, notification_service

settings = get_settings()


async def list_users(
    db: AsyncSession, q: str | None = None, limit: int = 50, offset: int = 0
) -> tuple[list[User], int]:
    query = select(User)
    if q:
        like = like_contains(q)
        query = query.where(
            User.full_name.ilike(like, escape=LIKE_ESCAPE)
            | User.email.ilike(like, escape=LIKE_ESCAPE)
            | User.student_id.ilike(like, escape=LIKE_ESCAPE)
        )
    count = (await db.execute(select(func.count()).select_from(query.with_only_columns(User.id).subquery()))).scalar_one()
    query = query.order_by(User.created_at.desc()).limit(limit).offset(offset)
    users = list((await db.execute(query)).scalars().all())
    return users, count


async def set_user_active(db: AsyncSession, user_id: uuid.UUID, is_active: bool) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_active = is_active
    if not is_active:
        await auth_service.revoke_all_user_tokens(db, user.id)
    await db.commit()
    await db.refresh(user)
    return user


async def list_all_listings(db: AsyncSession, limit: int = 50, offset: int = 0) -> tuple[list[Listing], int]:
    # Deliberately unfiltered (includes removed/soft-deleted) — this is a moderation
    # view, not the public browse endpoint, so admins need to see everything.
    query = select(Listing)
    count = (await db.execute(select(func.count()).select_from(query.with_only_columns(Listing.id).subquery()))).scalar_one()
    query = query.order_by(Listing.created_at.desc()).limit(limit).offset(offset)
    listings = list((await db.execute(query)).scalars().unique().all())
    return listings, count


async def admin_remove_listing(
    db: AsyncSession, listing_id: uuid.UUID, background_tasks: BackgroundTasks
) -> Listing:
    listing = await db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    if listing.deleted_at is None:
        listing.deleted_at = datetime.now(UTC)
        listing.is_active = False
        listing.status = ListingStatus.removed
        # Positional db/background_tasks/user_id/ntype to match notify()'s
        # signature — this previously passed `type=` and `user_id=` as
        # keywords and omitted the required email_subject/email_body, so
        # every admin removal raised TypeError before the commit landed.
        await notification_service.notify(
            db,
            background_tasks,
            listing.seller_id,
            NotificationType.listing_removed,
            title="Your listing was removed",
            body=f'"{listing.title}" was removed by a moderator for violating campus guidelines.',
            link_url="/listings",
            email_subject="Your listing was removed from KenaBecha JU",
            email_body=(
                f'Your listing "{listing.title}" was removed by a moderator for violating '
                "campus guidelines.\n\n"
                "If you believe this was a mistake, reply to this email."
            ),
            related_listing_id=listing.id,
        )
        await db.commit()
        await db.refresh(listing)
    return listing


async def toggle_listing_top(db: AsyncSession, listing_id: uuid.UUID, is_top: bool) -> Listing:
    listing = await db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    listing.is_top = is_top
    await db.commit()
    await db.refresh(listing)
    return listing


async def list_all_shops(db: AsyncSession, limit: int = 50, offset: int = 0) -> tuple[list[Shop], int]:
    # Same reasoning as list_all_listings — unfiltered for moderation visibility.
    query = select(Shop)
    count = (await db.execute(select(func.count()).select_from(query.with_only_columns(Shop.id).subquery()))).scalar_one()
    query = query.order_by(Shop.created_at.desc()).limit(limit).offset(offset)
    shops = list((await db.execute(query)).scalars().unique().all())
    return shops, count


async def admin_remove_shop(db: AsyncSession, shop_id: uuid.UUID, background_tasks: BackgroundTasks) -> Shop:
    shop = await db.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    shop.is_active = False
    shop.deleted_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(shop)

    link_url = f"/shops/{shop.slug}"
    await notification_service.notify(
        db,
        background_tasks,
        shop.owner_id,
        NotificationType.shop_removed,
        title="Your shop was removed",
        body=f'"{shop.shop_name}" was removed by a moderator.',
        link_url=link_url,
        email_subject="Your shop was removed from KenaBecha JU",
        email_body=(
            f'Your shop "{shop.shop_name}" was removed by a moderator for violating platform policy.\n\n'
            f"If you believe this was a mistake, reply to this email."
        ),
        related_shop_id=shop.id,
    )
    return shop


async def get_stats(db: AsyncSession) -> AdminStatsOut:
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_shops = (
        await db.execute(select(func.count()).where(Shop.deleted_at.is_(None)).select_from(Shop))
    ).scalar_one()
    total_active_listings = (
        await db.execute(select(func.count()).where(Listing.status == ListingStatus.active).select_from(Listing))
    ).scalar_one()
    total_messages = (await db.execute(select(func.count()).select_from(Message))).scalar_one()
    pending_reports = (
        await db.execute(select(func.count()).where(Report.status == ReportStatus.pending).select_from(Report))
    ).scalar_one()

    return AdminStatsOut(
        total_users=total_users,
        total_shops=total_shops,
        total_active_listings=total_active_listings,
        total_messages=total_messages,
        pending_reports=pending_reports,
    )
