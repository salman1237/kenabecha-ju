import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.follow import ShopFollow
from app.models.listing import Listing
from app.models.post import PostStatus, ShopPost, ShopPostImage
from app.models.shop import Shop
from app.models.user import User
from app.schemas.post import PostCreate, PostUpdate
from app.services.sanitize import sanitize_post_html

MAX_IMAGES_PER_POST = 6
SLUG_INVALID_CHARS = re.compile(r"[^a-z0-9]+")


def _slugify(title: str) -> str:
    slug = SLUG_INVALID_CHARS.sub("-", title.lower()).strip("-")
    return slug or "post"


async def _unique_slug(db: AsyncSession, base_slug: str) -> str:
    slug = base_slug
    suffix = 1
    while (await db.execute(select(ShopPost.id).where(ShopPost.slug == slug))).scalar_one_or_none() is not None:
        suffix += 1
        slug = f"{base_slug}-{suffix}"
    return slug


async def _validate_linked_listings(
    db: AsyncSession, shop_id: uuid.UUID, listing_ids: list[uuid.UUID]
) -> list[Listing]:
    """Every linked listing must be a real, non-deleted listing that belongs
    to *this* shop — a post's linked-listings boundary is shop identity, the
    same way `list_my_listings(shop_id=...)` scopes a shop's own inventory,
    not seller identity (a post belongs to a shop, not a personal seller)."""
    if not listing_ids:
        return []
    result = await db.execute(
        select(Listing).where(Listing.id.in_(listing_ids), Listing.deleted_at.is_(None))
    )
    found = {listing.id: listing for listing in result.scalars().all()}
    missing = [str(i) for i in listing_ids if i not in found]
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Listing(s) not found: {', '.join(missing)}")
    not_owned = [str(l.id) for l in found.values() if l.shop_id != shop_id]
    if not_owned:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, f"These listings don't belong to your shop: {', '.join(not_owned)}"
        )
    # Preserve the caller's own ordering rather than the id-set's arbitrary one.
    return [found[i] for i in listing_ids]


async def create_post(db: AsyncSession, shop: Shop, payload: PostCreate) -> ShopPost:
    listings = await _validate_linked_listings(db, shop.id, payload.listing_ids)
    slug = await _unique_slug(db, _slugify(payload.title))
    post = ShopPost(
        shop_id=shop.id,
        title=payload.title,
        description_html=sanitize_post_html(payload.description_html),
        slug=slug,
        status=PostStatus.pending,
        listings=listings,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def get_post(db: AsyncSession, post_id: uuid.UUID) -> ShopPost:
    post = await db.get(ShopPost, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return post


async def get_visible_post(db: AsyncSession, post_id: uuid.UUID, viewer: User | None) -> ShopPost:
    """A published post is visible to anyone. A pending/rejected one is only
    visible to the owning shop's owner or staff — a shareable link to an
    unmoderated post shouldn't leak its content to a random visitor."""
    post = await get_post(db, post_id)
    if post.status != PostStatus.published:
        is_owner = viewer is not None and post.shop.owner_id == viewer.id
        is_staff = viewer is not None and viewer.role in ("moderator", "admin")
        if not (is_owner or is_staff):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return post


async def get_owned_post(db: AsyncSession, post_id: uuid.UUID, owner: User) -> ShopPost:
    post = await get_post(db, post_id)
    if post.shop.owner_id != owner.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't own this post")
    return post


async def list_shop_posts(
    db: AsyncSession, shop_id: uuid.UUID, *, published_only: bool
) -> list[ShopPost]:
    query = select(ShopPost).where(ShopPost.shop_id == shop_id, ShopPost.deleted_at.is_(None))
    if published_only:
        query = query.where(ShopPost.status == PostStatus.published)
    query = query.order_by(ShopPost.created_at.desc())
    return list((await db.execute(query)).scalars().unique().all())


async def update_post(db: AsyncSession, post: ShopPost, payload: PostUpdate) -> ShopPost:
    if payload.title is not None:
        post.title = payload.title
    if payload.description_html is not None:
        post.description_html = sanitize_post_html(payload.description_html)
    if payload.listing_ids is not None:
        post.listings = await _validate_linked_listings(db, post.shop_id, payload.listing_ids)

    # The one rule kept verbatim from this project's own earlier design
    # notes: editing an already-moderated post resubmits it to pending. A
    # silently-changed live post under its old approval is exactly the gap
    # a moderation system exists to close. A still-pending post edited
    # again just stays pending — no redundant transition.
    if post.status in (PostStatus.published, PostStatus.rejected):
        post.status = PostStatus.pending
        post.rejection_reason = None

    await db.commit()
    await db.refresh(post)
    return post


async def delete_post(db: AsyncSession, post: ShopPost) -> None:
    post.deleted_at = datetime.now(UTC)
    post.is_active = False
    await db.commit()


async def add_image(db: AsyncSession, post: ShopPost, image_url: str) -> ShopPostImage:
    if len(post.images) >= MAX_IMAGES_PER_POST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"A post can have at most {MAX_IMAGES_PER_POST} images")
    image = ShopPostImage(post_id=post.id, image_url=image_url, sort_order=len(post.images))
    db.add(image)
    await db.commit()
    await db.refresh(post)
    return image


async def delete_image(db: AsyncSession, post: ShopPost, image_id: uuid.UUID) -> None:
    image = next((img for img in post.images if img.id == image_id), None)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
    await db.delete(image)

    remaining = sorted((img for img in post.images if img.id != image_id), key=lambda img: img.sort_order)
    for i, img in enumerate(remaining):
        img.sort_order = i
    await db.commit()


async def feed(
    db: AsyncSession, viewer: User | None, limit: int = 24, offset: int = 0
) -> tuple[list[ShopPost], int]:
    """Published posts, followed shops first, then everyone else, newest
    first within each tier. Anonymous viewers just get newest-first."""
    base_filter = (ShopPost.status == PostStatus.published, ShopPost.deleted_at.is_(None))

    total = (
        await db.execute(select(func.count()).where(*base_filter).select_from(ShopPost))
    ).scalar_one()

    if viewer is not None:
        followed = (
            select(ShopFollow.shop_id).where(ShopFollow.user_id == viewer.id).subquery()
        )
        query = (
            select(ShopPost)
            .outerjoin(followed, followed.c.shop_id == ShopPost.shop_id)
            .where(*base_filter)
            .order_by(followed.c.shop_id.is_(None), ShopPost.created_at.desc())
        )
    else:
        query = select(ShopPost).where(*base_filter).order_by(ShopPost.created_at.desc())

    query = query.limit(limit).offset(offset)
    posts = list((await db.execute(query)).scalars().unique().all())
    return posts, total
