import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.follow import ShopFollow
from app.models.listing import Listing, ListingStatus
from app.models.rating import Rating
from app.models.shop import Shop
from app.models.user import User
from app.schemas.shop import ShopCreate, ShopUpdate
from app.services import media_service

SLUG_INVALID_CHARS = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    slug = SLUG_INVALID_CHARS.sub("-", name.lower()).strip("-")
    return slug or "shop"


async def _unique_slug(db: AsyncSession, base_slug: str) -> str:
    slug = base_slug
    suffix = 1
    while (await db.execute(select(Shop.id).where(Shop.slug == slug))).scalar_one_or_none() is not None:
        suffix += 1
        slug = f"{base_slug}-{suffix}"
    return slug


async def create_shop(db: AsyncSession, owner: User, payload: ShopCreate) -> Shop:
    slug = await _unique_slug(db, _slugify(payload.shop_name))
    shop = Shop(
        owner_id=owner.id,
        shop_name=payload.shop_name,
        slug=slug,
        description=payload.description,
        shop_type=payload.shop_type,
    )
    db.add(shop)
    await db.commit()
    await db.refresh(shop)
    return shop


async def _listing_counts(db: AsyncSession, shop_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not shop_ids:
        return {}
    result = await db.execute(
        select(Listing.shop_id, func.count(Listing.id))
        .where(Listing.shop_id.in_(shop_ids), Listing.status == ListingStatus.active)
        .group_by(Listing.shop_id)
    )
    return dict(result.all())


async def list_shops(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[tuple[Shop, int]]:
    result = await db.execute(
        select(Shop).where(Shop.is_active.is_(True)).order_by(Shop.created_at.desc()).offset(skip).limit(limit)
    )
    shops = list(result.scalars().all())
    counts = await _listing_counts(db, [s.id for s in shops])
    return [(shop, counts.get(shop.id, 0)) for shop in shops]


async def list_my_shops(db: AsyncSession, owner_id: uuid.UUID) -> list[tuple[Shop, int]]:
    result = await db.execute(
        select(Shop).where(Shop.owner_id == owner_id, Shop.is_active.is_(True)).order_by(Shop.created_at)
    )
    shops = list(result.scalars().all())
    counts = await _listing_counts(db, [s.id for s in shops])
    return [(shop, counts.get(shop.id, 0)) for shop in shops]


async def get_shop_by_slug(db: AsyncSession, slug: str) -> tuple[Shop, int]:
    result = await db.execute(select(Shop).where(Shop.slug == slug, Shop.is_active.is_(True)))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    counts = await _listing_counts(db, [shop.id])
    return shop, counts.get(shop.id, 0)


async def get_shop_stats(db: AsyncSession, shop: Shop) -> dict:
    """Public storefront figures. `sold_count` is a real trust signal
    (this shop completes trades), which a raw active-listing count isn't."""
    active = (
        await db.execute(
            select(func.count())
            .select_from(Listing)
            .where(
                Listing.shop_id == shop.id,
                Listing.status == ListingStatus.active,
                Listing.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    sold = (
        await db.execute(
            select(func.count())
            .select_from(Listing)
            .where(
                Listing.shop_id == shop.id,
                Listing.status.in_([ListingStatus.sold, ListingStatus.out_of_stock]),
                Listing.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    followers = (
        await db.execute(
            select(func.count()).select_from(ShopFollow).where(ShopFollow.shop_id == shop.id)
        )
    ).scalar_one()

    reviews = (
        await db.execute(select(func.count()).select_from(Rating).where(Rating.target_shop_id == shop.id))
    ).scalar_one()

    return {
        "active_listings": active,
        "sold_count": sold,
        "followers": followers,
        "review_count": reviews,
    }


async def toggle_follow(db: AsyncSession, user: User, shop: Shop) -> bool:
    """Follows/unfollows, returning the resulting state. A shop owner
    following their own shop is pointless, so it's rejected outright."""
    if shop.owner_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't follow your own shop")

    existing = (
        await db.execute(
            select(ShopFollow).where(ShopFollow.user_id == user.id, ShopFollow.shop_id == shop.id)
        )
    ).scalar_one_or_none()

    if existing is not None:
        await db.delete(existing)
        await db.commit()
        return False

    db.add(ShopFollow(user_id=user.id, shop_id=shop.id))
    await db.commit()
    return True


async def is_following(db: AsyncSession, user_id: uuid.UUID, shop_id: uuid.UUID) -> bool:
    row = await db.execute(
        select(ShopFollow.id).where(ShopFollow.user_id == user_id, ShopFollow.shop_id == shop_id)
    )
    return row.scalar_one_or_none() is not None


async def get_owned_shop(db: AsyncSession, shop_id: uuid.UUID, owner: User) -> Shop:
    shop = await db.get(Shop, shop_id)
    if shop is None or not shop.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    if shop.owner_id != owner.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't own this shop")
    return shop


async def update_shop(db: AsyncSession, shop: Shop, payload: ShopUpdate) -> Shop:
    data = payload.model_dump(exclude_unset=True)
    if "shop_name" in data and data["shop_name"] != shop.shop_name:
        shop.slug = await _unique_slug(db, _slugify(data["shop_name"]))
    for field, value in data.items():
        setattr(shop, field, value)
    await db.commit()
    await db.refresh(shop)
    return shop


async def set_logo(db: AsyncSession, shop: Shop, image_url: str) -> Shop:
    previous = shop.logo_url
    shop.logo_url = image_url
    await db.commit()
    await db.refresh(shop)
    # After commit: a failed commit must not leave the row pointing at a
    # file that's already been unlinked.
    media_service.delete_media(previous)
    return shop


async def set_cover(db: AsyncSession, shop: Shop, image_url: str) -> Shop:
    previous = shop.cover_url
    shop.cover_url = image_url
    await db.commit()
    await db.refresh(shop)
    media_service.delete_media(previous)
    return shop


async def delete_shop(db: AsyncSession, shop: Shop) -> None:
    shop.is_active = False
    shop.deleted_at = datetime.now(UTC)
    await db.commit()
