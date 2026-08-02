import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Message
from app.models.listing import Listing, ListingStatus
from app.models.report import Report, ReportStatus
from app.models.shop import Shop
from app.models.user import User
from app.schemas.admin import AdminStatsOut
from app.services import auth_service


async def list_users(
    db: AsyncSession, q: str | None = None, limit: int = 50, offset: int = 0
) -> tuple[list[User], int]:
    query = select(User)
    if q:
        like = f"%{q}%"
        query = query.where((User.full_name.ilike(like)) | (User.email.ilike(like)) | (User.student_id.ilike(like)))
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


async def admin_remove_listing(db: AsyncSession, listing_id: uuid.UUID) -> Listing:
    listing = await db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    listing.status = ListingStatus.removed
    listing.is_active = False
    listing.deleted_at = datetime.now(UTC)
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


async def admin_remove_shop(db: AsyncSession, shop_id: uuid.UUID) -> Shop:
    shop = await db.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    shop.is_active = False
    shop.deleted_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(shop)
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
