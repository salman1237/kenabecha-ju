from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.listing import Listing, ListingStatus
from app.models.newsletter import NewsletterSubscriber
from app.models.rating import Rating, RatingTargetType
from app.models.shop import Shop
from app.models.user import User
from app.schemas.public import NewsletterSubscribeRequest, PublicReviewOut, PublicStatsOut
from app.services import rating_service

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/stats", response_model=PublicStatsOut)
async def get_public_stats(db: AsyncSession = Depends(get_db)) -> PublicStatsOut:
    total_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_active.is_(True)))
    ).scalar_one()
    total_shops = (
        await db.execute(select(func.count()).select_from(Shop).where(Shop.deleted_at.is_(None)))
    ).scalar_one()
    total_active_listings = (
        await db.execute(
            select(func.count())
            .select_from(Listing)
            .where(Listing.status == ListingStatus.active, Listing.deleted_at.is_(None))
        )
    ).scalar_one()
    total_ratings = (await db.execute(select(func.count()).select_from(Rating))).scalar_one()

    return PublicStatsOut(
        total_users=total_users,
        total_shops=total_shops,
        total_active_listings=total_active_listings,
        total_ratings=total_ratings,
    )


@router.post("/newsletter", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe_newsletter(
    payload: NewsletterSubscribeRequest, db: AsyncSession = Depends(get_db)
) -> None:
    """Idempotent by design: re-submitting an already-subscribed address is a
    no-op success rather than a 409. There's nothing sensitive to protect
    here, and telling a stranger "that email is already subscribed" would
    leak membership for no benefit."""
    existing = await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == payload.email)
    )
    if existing.scalar_one_or_none() is not None:
        return

    db.add(NewsletterSubscriber(email=payload.email))
    await db.commit()


@router.get("/reviews", response_model=list[PublicReviewOut])
async def list_recent_reviews(
    limit: int = Query(default=6, le=24), db: AsyncSession = Depends(get_db)
) -> list[PublicReviewOut]:
    ratings = await rating_service.list_recent_reviews(db, limit)

    out: list[PublicReviewOut] = []
    for r in ratings:
        if r.target_type == RatingTargetType.shop:
            shop = await db.get(Shop, r.target_shop_id)
            if shop is None or shop.deleted_at is not None:
                continue
            target_name, target_url = shop.shop_name, f"/shops/{shop.slug}"
        else:
            target = await db.get(User, r.target_user_id)
            if target is None or not target.is_active:
                continue
            target_name, target_url = target.full_name, f"/profile/{target.id}"

        listing = await db.get(Listing, r.listing_id)

        out.append(
            PublicReviewOut(
                id=r.id,
                stars=r.stars,
                review_text=r.review_text or "",
                created_at=r.created_at,
                rater=r.rater,
                target_name=target_name,
                target_url=target_url,
                listing_title=listing.title if listing else "",
            )
        )

    return out
