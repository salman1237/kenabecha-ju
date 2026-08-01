import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import Listing, ListingStatus
from app.models.shop import Shop
from app.models.user import User
from app.schemas.shop import ShopCreate, ShopUpdate

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


async def delete_shop(db: AsyncSession, shop: Shop) -> None:
    shop.is_active = False
    shop.deleted_at = datetime.now(UTC)
    await db.commit()
