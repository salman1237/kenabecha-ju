import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.search import LIKE_ESCAPE, like_contains
from app.models.follow import ShopFollow
from app.models.listing import Listing, ListingStatus
from app.models.rating import Rating
from app.models.shop import Shop
from app.models.shop_collaborator import ShopCollaborator, ShopCollaboratorStatus
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


async def list_shops(
    db: AsyncSession, skip: int = 0, limit: int = 50, q: str | None = None
) -> list[tuple[Shop, int]]:
    query = select(Shop).where(Shop.is_active.is_(True))
    if q:
        like = like_contains(q)
        query = query.where(
            Shop.shop_name.ilike(like, escape=LIKE_ESCAPE) | Shop.description.ilike(like, escape=LIKE_ESCAPE)
        )
    result = await db.execute(query.order_by(Shop.created_at.desc()).offset(skip).limit(limit))
    shops = list(result.scalars().all())
    counts = await _listing_counts(db, [s.id for s in shops])
    return [(shop, counts.get(shop.id, 0)) for shop in shops]


async def list_my_shops(db: AsyncSession, user_id: uuid.UUID) -> list[tuple[Shop, int]]:
    """A user's own dashboard: shops they own, plus shops they've been
    accepted onto as a collaborator -- both belong on "my shops", just
    with different actions available once there (enforced by
    get_owned_shop/get_shop_with_access, not by this listing)."""
    collaborator_shop_ids = select(ShopCollaborator.shop_id).where(
        ShopCollaborator.user_id == user_id, ShopCollaborator.status == ShopCollaboratorStatus.accepted
    )
    result = await db.execute(
        select(Shop)
        .where(
            Shop.is_active.is_(True),
            (Shop.owner_id == user_id) | (Shop.id.in_(collaborator_shop_ids)),
        )
        .order_by(Shop.created_at)
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


async def get_shops_follower_counts(
    db: AsyncSession, shop_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """Follower count per shop, in one grouped query.

    A card that shows followers must not cost one query per card — that's the
    N+1 pattern already removed from the per-shop rating lookups.
    """
    if not shop_ids:
        return {}
    result = await db.execute(
        select(ShopFollow.shop_id, func.count())
        .where(ShopFollow.shop_id.in_(shop_ids))
        .group_by(ShopFollow.shop_id)
    )
    return {row[0]: row[1] for row in result.all()}


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
    """Strictly the owner -- deleting the shop and managing its
    collaborators stay owner-only, unlike day-to-day operation."""
    shop = await db.get(Shop, shop_id)
    if shop is None or not shop.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    if shop.owner_id != owner.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't own this shop")
    return shop


async def has_shop_access(db: AsyncSession, shop_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Owner or accepted collaborator. Pending/declined invites grant nothing.
    Checks ownership too (not just the collaborator table) so callers like
    get_owned_listing can use this as the one true "can this person operate
    on this shop" check -- including for content a *different* collaborator
    created, which is the whole point of sharing shop management."""
    result = await db.execute(select(Shop.owner_id).where(Shop.id == shop_id))
    owner_id = result.scalar_one_or_none()
    if owner_id is None:
        return False
    if owner_id == user_id:
        return True
    result = await db.execute(
        select(ShopCollaborator.id).where(
            ShopCollaborator.shop_id == shop_id,
            ShopCollaborator.user_id == user_id,
            ShopCollaborator.status == ShopCollaboratorStatus.accepted,
        )
    )
    return result.scalar_one_or_none() is not None


async def get_shop_with_access(db: AsyncSession, shop_id: uuid.UUID, user: User) -> Shop:
    """Owner or accepted collaborator -- day-to-day shop operation (editing
    the shop, its listings, its posts). Everything a collaborator does
    routes through this instead of get_owned_shop."""
    shop = await db.get(Shop, shop_id)
    if shop is None or not shop.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    if shop.owner_id == user.id or await has_shop_access(db, shop_id, user.id):
        return shop
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this shop")


async def invite_collaborator(db: AsyncSession, shop: Shop, inviter: User, email: str) -> tuple[ShopCollaborator, User]:
    """Invite by exact email match only -- see ShopCollaboratorInviteIn for
    why this isn't a fuzzy search. Re-inviting someone who previously
    declined resets their row to pending rather than creating a second one,
    since (shop_id, user_id) is unique."""
    result = await db.execute(select(User).where(User.email == email))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No user found with that email")
    if target.id == shop.owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That's already the shop owner")

    existing = (
        await db.execute(
            select(ShopCollaborator).where(
                ShopCollaborator.shop_id == shop.id, ShopCollaborator.user_id == target.id
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        if existing.status == ShopCollaboratorStatus.accepted:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This person already manages the shop")
        if existing.status == ShopCollaboratorStatus.pending:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "An invite is already pending for this person")
        existing.status = ShopCollaboratorStatus.pending
        existing.invited_by = inviter.id
        existing.responded_at = None
        collaborator = existing
    else:
        collaborator = ShopCollaborator(shop_id=shop.id, user_id=target.id, invited_by=inviter.id)
        db.add(collaborator)

    await db.commit()
    await db.refresh(collaborator)
    return collaborator, target


async def list_collaborators(db: AsyncSession, shop_id: uuid.UUID) -> list[ShopCollaborator]:
    result = await db.execute(
        select(ShopCollaborator)
        .where(ShopCollaborator.shop_id == shop_id, ShopCollaborator.status != ShopCollaboratorStatus.declined)
        .order_by(ShopCollaborator.created_at)
    )
    return list(result.scalars().all())


async def list_pending_invites_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[ShopCollaborator]:
    # ShopCollaborator.shop is selectin-eager by default, but that doesn't
    # cascade to shop.owner -- the router needs the inviting shop's owner
    # name, so that hop is loaded explicitly here rather than lazily
    # (which would raise outside an active sync context under asyncpg).
    result = await db.execute(
        select(ShopCollaborator)
        .where(ShopCollaborator.user_id == user_id, ShopCollaborator.status == ShopCollaboratorStatus.pending)
        .options(selectinload(ShopCollaborator.shop).selectinload(Shop.owner))
        .order_by(ShopCollaborator.created_at.desc())
    )
    return list(result.scalars().all())


async def get_own_invite(db: AsyncSession, invite_id: uuid.UUID, user: User) -> ShopCollaborator:
    invite = await db.get(ShopCollaborator, invite_id)
    if invite is None or invite.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    if invite.status != ShopCollaboratorStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This invite has already been responded to")
    return invite


async def respond_to_invite(db: AsyncSession, invite: ShopCollaborator, accept: bool) -> ShopCollaborator:
    invite.status = ShopCollaboratorStatus.accepted if accept else ShopCollaboratorStatus.declined
    invite.responded_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(invite)
    return invite


async def get_shop_collaborator(db: AsyncSession, shop_id: uuid.UUID, collaborator_id: uuid.UUID) -> ShopCollaborator:
    collaborator = await db.get(ShopCollaborator, collaborator_id)
    if collaborator is None or collaborator.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collaborator not found")
    return collaborator


async def remove_collaborator(db: AsyncSession, collaborator: ShopCollaborator) -> None:
    await db.delete(collaborator)
    await db.commit()


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
