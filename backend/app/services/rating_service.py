import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.listing import Listing, ListingStatus
from app.models.rating import Rating, RatingTargetType
from app.models.user import User
from app.schemas.rating import RatingCreate


async def check_eligibility(db: AsyncSession, listing: Listing, user: User) -> tuple[bool, str | None]:
    if listing.status not in (ListingStatus.sold, ListingStatus.out_of_stock):
        return False, "This listing hasn't been marked sold yet"
    if listing.seller_id == user.id:
        return False, "You can't rate your own listing"

    result = await db.execute(
        select(Conversation.id).where(
            Conversation.listing_id == listing.id, Conversation.buyer_id == user.id
        )
    )
    if result.scalar_one_or_none() is None:
        return False, "You need to have messaged the seller about this listing first"

    result = await db.execute(
        select(Rating.id).where(Rating.listing_id == listing.id, Rating.rater_id == user.id)
    )
    if result.scalar_one_or_none() is not None:
        return False, "You've already rated this transaction"

    return True, None


async def create_rating(db: AsyncSession, listing: Listing, user: User, payload: RatingCreate) -> Rating:
    can_rate, reason = await check_eligibility(db, listing, user)
    if not can_rate:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, reason)

    if listing.shop_id is not None:
        rating = Rating(
            listing_id=listing.id,
            rater_id=user.id,
            target_type=RatingTargetType.shop,
            target_shop_id=listing.shop_id,
            stars=payload.stars,
            review_text=payload.review_text,
        )
    else:
        rating = Rating(
            listing_id=listing.id,
            rater_id=user.id,
            target_type=RatingTargetType.user,
            target_user_id=listing.seller_id,
            stars=payload.stars,
            review_text=payload.review_text,
        )

    db.add(rating)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You've already rated this transaction") from exc
    await db.refresh(rating)
    return rating


async def get_shop_rating_summary(db: AsyncSession, shop_id: uuid.UUID) -> tuple[float | None, int]:
    result = await db.execute(
        select(func.avg(Rating.stars), func.count(Rating.id)).where(Rating.target_shop_id == shop_id)
    )
    avg, count = result.one()
    return (float(avg) if avg is not None else None), count


async def get_user_rating_summary(db: AsyncSession, user_id: uuid.UUID) -> tuple[float | None, int]:
    result = await db.execute(
        select(func.avg(Rating.stars), func.count(Rating.id)).where(Rating.target_user_id == user_id)
    )
    avg, count = result.one()
    return (float(avg) if avg is not None else None), count


async def list_shop_ratings(db: AsyncSession, shop_id: uuid.UUID, limit: int = 20) -> list[Rating]:
    result = await db.execute(
        select(Rating)
        .where(Rating.target_shop_id == shop_id)
        .order_by(Rating.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_user_ratings(db: AsyncSession, user_id: uuid.UUID, limit: int = 20) -> list[Rating]:
    result = await db.execute(
        select(Rating)
        .where(Rating.target_user_id == user_id)
        .order_by(Rating.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_star_breakdown(
    db: AsyncSession, *, shop_id: uuid.UUID | None = None, user_id: uuid.UUID | None = None
) -> dict[int, int]:
    """Counts per star value, always with all five keys present (zero-filled)
    so callers can render a full 5→1 bar chart without patching gaps."""
    column = Rating.target_shop_id if shop_id is not None else Rating.target_user_id
    target = shop_id if shop_id is not None else user_id

    rows = await db.execute(
        select(Rating.stars, func.count()).where(column == target).group_by(Rating.stars)
    )
    counts = {star: 0 for star in range(1, 6)}
    for star, count in rows.all():
        counts[star] = count
    return counts


async def list_recent_reviews(db: AsyncSession, limit: int = 6) -> list[Rating]:
    """Newest ratings across the whole platform, for the public landing page.
    Only those with written text — a bare star score makes a poor testimonial."""
    result = await db.execute(
        select(Rating)
        .where(Rating.review_text.is_not(None), Rating.review_text != "")
        .order_by(Rating.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
