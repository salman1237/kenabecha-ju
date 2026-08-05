import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, Message
from app.models.listing import Listing, ListingStatus
from app.models.rating import Rating
from app.models.saved import SavedListing
from app.models.shop import Shop
from app.models.user import User


async def get_dashboard_stats(db: AsyncSession, user: User) -> dict:
    active_listings = (
        await db.execute(
            select(func.count())
            .select_from(Listing)
            .where(
                Listing.seller_id == user.id,
                Listing.status == ListingStatus.active,
                Listing.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    sold_listings = (
        await db.execute(
            select(func.count())
            .select_from(Listing)
            .where(
                Listing.seller_id == user.id,
                Listing.status == ListingStatus.sold,
                Listing.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    shops = (
        await db.execute(
            select(func.count()).select_from(Shop).where(Shop.owner_id == user.id, Shop.deleted_at.is_(None))
        )
    ).scalar_one()

    unread_messages = (
        await db.execute(
            select(func.count())
            .select_from(Message)
            .where(Message.receiver_id == user.id, Message.read_at.is_(None))
        )
    ).scalar_one()

    conversations = (
        await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where((Conversation.buyer_id == user.id) | (Conversation.seller_id == user.id))
        )
    ).scalar_one()

    saved_count = (
        await db.execute(
            select(func.count()).select_from(SavedListing).where(SavedListing.user_id == user.id)
        )
    ).scalar_one()

    avg_row = await db.execute(
        select(func.avg(Rating.stars), func.count()).where(Rating.target_user_id == user.id)
    )
    avg, rating_count = avg_row.one()

    return {
        "active_listings": active_listings,
        "sold_listings": sold_listings,
        "shops": shops,
        "unread_messages": unread_messages,
        "conversations": conversations,
        "saved_count": saved_count,
        "average_rating": float(avg) if avg is not None else None,
        "rating_count": rating_count,
    }


async def get_listing_activity(db: AsyncSession, user: User, days: int = 30) -> list[dict]:
    """Listings created per day over the trailing `days` window, zero-filled
    so the chart has a continuous x-axis instead of collapsing gaps."""
    since = datetime.now(UTC) - timedelta(days=days - 1)

    rows = await db.execute(
        select(func.date(Listing.created_at).label("day"), func.count())
        .where(
            Listing.seller_id == user.id,
            Listing.created_at >= since,
            Listing.deleted_at.is_(None),
        )
        .group_by("day")
    )
    counts = {str(day): count for day, count in rows.all()}

    out = []
    for i in range(days):
        day = (since + timedelta(days=i)).date()
        out.append({"date": day.isoformat(), "count": counts.get(day.isoformat(), 0)})
    return out


async def toggle_saved(db: AsyncSession, user: User, listing_id: uuid.UUID) -> bool:
    """Saves or unsaves, returning the resulting saved state. Idempotent per
    call direction, so a double-tap can't create duplicate rows."""
    listing = await db.get(Listing, listing_id)
    if listing is None or listing.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")

    existing = (
        await db.execute(
            select(SavedListing).where(
                SavedListing.user_id == user.id, SavedListing.listing_id == listing_id
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        await db.delete(existing)
        await db.commit()
        return False

    db.add(SavedListing(user_id=user.id, listing_id=listing_id))
    await db.commit()
    return True


async def list_saved(db: AsyncSession, user: User) -> list[Listing]:
    rows = await db.execute(
        select(SavedListing).where(SavedListing.user_id == user.id).order_by(SavedListing.created_at.desc())
    )
    # Skip anything soft-deleted since the bookmark was made, rather than
    # rendering a dead card the user can't act on.
    return [s.listing for s in rows.scalars().unique().all() if s.listing.deleted_at is None]


async def list_saved_ids(db: AsyncSession, user: User) -> list[uuid.UUID]:
    rows = await db.execute(select(SavedListing.listing_id).where(SavedListing.user_id == user.id))
    return list(rows.scalars().all())
