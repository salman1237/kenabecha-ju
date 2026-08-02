import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import Listing, ListingStatus
from app.models.order import CartItem
from app.models.user import User
from app.schemas.order import CartItemCreate, CartItemUpdate


async def _get_active_listing(db: AsyncSession, listing_id: uuid.UUID) -> Listing:
    listing = await db.get(Listing, listing_id)
    if listing is None or listing.deleted_at is not None or listing.status != ListingStatus.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found or no longer available")
    return listing


async def add_to_cart(db: AsyncSession, buyer: User, payload: CartItemCreate) -> CartItem:
    listing = await _get_active_listing(db, payload.listing_id)
    if listing.seller_id == buyer.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't buy your own listing")

    result = await db.execute(
        select(CartItem).where(CartItem.buyer_id == buyer.id, CartItem.listing_id == payload.listing_id)
    )
    item = result.scalar_one_or_none()

    new_quantity = (item.quantity if item else 0) + payload.quantity
    if new_quantity > listing.quantity:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f'Only {listing.quantity} available of "{listing.title}"'
        )

    if item is None:
        item = CartItem(buyer_id=buyer.id, listing_id=payload.listing_id, quantity=new_quantity)
        db.add(item)
    else:
        item.quantity = new_quantity

    await db.commit()
    await db.refresh(item)
    return item


async def list_cart(db: AsyncSession, buyer: User) -> list[CartItem]:
    result = await db.execute(
        select(CartItem).where(CartItem.buyer_id == buyer.id).order_by(CartItem.created_at)
    )
    return list(result.scalars().unique().all())


async def _get_owned_item(db: AsyncSession, item_id: uuid.UUID, buyer: User) -> CartItem:
    item = await db.get(CartItem, item_id)
    if item is None or item.buyer_id != buyer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found")
    return item


async def update_cart_item(
    db: AsyncSession, buyer: User, item_id: uuid.UUID, payload: CartItemUpdate
) -> CartItem:
    item = await _get_owned_item(db, item_id, buyer)
    listing = await _get_active_listing(db, item.listing_id)
    if payload.quantity > listing.quantity:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f'Only {listing.quantity} available of "{listing.title}"'
        )
    item.quantity = payload.quantity
    await db.commit()
    await db.refresh(item)
    return item


async def remove_cart_item(db: AsyncSession, buyer: User, item_id: uuid.UUID) -> None:
    item = await _get_owned_item(db, item_id, buyer)
    await db.delete(item)
    await db.commit()
