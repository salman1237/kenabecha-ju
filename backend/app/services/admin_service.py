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
from app.models.user import User, UserRole
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


async def _count_other_active_admins(db: AsyncSession, excluding: uuid.UUID) -> int:
    """Active admins other than this one."""
    result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(
            User.role == UserRole.admin,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            User.id != excluding,
        )
    )
    return result.scalar_one()


async def _guard_last_admin(db: AsyncSession, target: User) -> None:
    """Refuse a change that would leave no active admin.

    Losing the last admin is unrecoverable through the product: nobody can
    reach the panel to undo it, and the only way back is a shell on the
    database — the exact situation ADMIN_EMAILS exists to avoid. One
    mis-click should not cost that.
    """
    if target.role != UserRole.admin or not target.is_active:
        return
    if await _count_other_active_admins(db, target.id) == 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This is the last active admin. Promote another admin first.",
        )


async def set_user_active(
    db: AsyncSession, user_id: uuid.UUID, is_active: bool, *, actor: User
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if user.id == actor.id and not is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate your own account")
    if not is_active:
        await _guard_last_admin(db, user)

    user.is_active = is_active
    if not is_active:
        await auth_service.revoke_all_user_tokens(db, user.id)
    await db.commit()
    await db.refresh(user)
    return user


async def set_user_role(
    db: AsyncSession, user_id: uuid.UUID, role: UserRole, *, actor: User
) -> User:
    """Change a user's role.

    Two rails:

    * **Nobody changes their own role.** Without this, anyone who reaches the
      endpoint can escalate themselves, which would make the moderator/admin
      split meaningless — a moderator would simply grant themselves admin.
      The endpoint is admin-only today, but the guard belongs on the
      operation rather than on who happens to be allowed to call it.
    * **The last active admin cannot be demoted.** See _guard_last_admin.

    Demoting someone revokes their sessions, so a removed permission takes
    effect immediately rather than lasting until their access token expires.
    """
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if user.id == actor.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You cannot change your own role. Ask another admin.",
        )

    if role != UserRole.admin:
        await _guard_last_admin(db, user)

    was_privileged = user.role.is_staff
    user.role = role
    if was_privileged and not role.is_staff:
        # Drop existing sessions so the lost permissions apply now, not
        # whenever the current access token happens to expire.
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
