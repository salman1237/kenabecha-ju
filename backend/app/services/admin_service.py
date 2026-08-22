import uuid
from datetime import UTC, datetime
from typing import TypedDict

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.conversation import Message
from app.core.search import LIKE_ESCAPE, like_contains
from app.models.follow import ShopFollow
from app.models.listing import Listing, ListingStatus
from app.models.notification import NotificationType
from app.models.post import PostStatus, ShopPost
from app.models.report import Report, ReportStatus
from app.models.shop import Shop
from app.models.user import User, UserRole
from app.schemas.admin import AdminStatsOut
from app.models.audit import AuditAction
from app.services import audit_service, auth_service, notification_service

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

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.USER_REACTIVATED if is_active else AuditAction.USER_DEACTIVATED,
        target_type="user",
        target_id=user.id,
        target_label=user.email,
    )
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
    previous = user.role.value
    user.role = role
    if was_privileged and not role.is_staff:
        # Drop existing sessions so the lost permissions apply now, not
        # whenever the current access token happens to expire.
        await auth_service.revoke_all_user_tokens(db, user.id)

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.USER_ROLE_CHANGED,
        target_type="user",
        target_id=user.id,
        target_label=user.email,
        detail={"from": previous, "to": role.value},
    )
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
    db: AsyncSession, listing_id: uuid.UUID, background_tasks: BackgroundTasks, *, actor: User
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
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.LISTING_REMOVED,
            target_type="listing",
            target_id=listing.id,
            target_label=listing.title,
            detail={"seller_id": str(listing.seller_id)},
        )
        await db.commit()
        await db.refresh(listing)
    return listing


async def toggle_listing_top(
    db: AsyncSession, listing_id: uuid.UUID, is_top: bool, *, actor: User
) -> Listing:
    listing = await db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    listing.is_top = is_top
    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.LISTING_TOP_CHANGED,
        target_type="listing",
        target_id=listing.id,
        target_label=listing.title,
        detail={"is_top": is_top},
    )
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


async def admin_remove_shop(
    db: AsyncSession, shop_id: uuid.UUID, background_tasks: BackgroundTasks, *, actor: User
) -> Shop:
    shop = await db.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    shop.is_active = False
    shop.deleted_at = datetime.now(UTC)
    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.SHOP_REMOVED,
        target_type="shop",
        target_id=shop.id,
        target_label=shop.shop_name,
        detail={"owner_id": str(shop.owner_id)},
    )
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


# --- bulk moderation ---------------------------------------------------------
#
# Each item is put through the same single-item function the one-at-a-time
# path uses, rather than a bulk UPDATE. A bulk statement would be faster and
# would also skip the audit entry, the seller's notification and the email —
# which is to say it would quietly turn "remove 20 listings" into a different
# operation from doing it 20 times. Moderation at speed is exactly when the
# record matters most.
#
# Items are therefore independent: one failure does not roll back the rest,
# and the caller is told precisely which ids failed and why. Reporting "12 of
# 20 done" is more useful to a moderator than an all-or-nothing error that
# leaves them guessing what landed.

#: A ceiling per request. Each item is a real transaction with a notification
#: and possibly an email, so an unbounded list is a slow request and a lot of
#: mail sent from one click.
MAX_BULK = 100


class BulkResult(TypedDict):
    succeeded: list[str]
    failed: list[dict]


def _check_size(ids: list[uuid.UUID]) -> None:
    if not ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No items selected")
    if len(ids) > MAX_BULK:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Select at most {MAX_BULK} items at a time"
        )


async def _run_each(ids: list[uuid.UUID], action) -> BulkResult:
    succeeded: list[str] = []
    failed: list[dict] = []
    # Deduplicated, order preserved: a repeated id would otherwise be acted on
    # twice and counted twice in the summary.
    for item_id in dict.fromkeys(ids):
        try:
            await action(item_id)
            succeeded.append(str(item_id))
        except HTTPException as exc:
            failed.append({"id": str(item_id), "reason": exc.detail})
    return {"succeeded": succeeded, "failed": failed}


async def bulk_remove_listings(
    db: AsyncSession,
    ids: list[uuid.UUID],
    background_tasks: BackgroundTasks,
    *,
    actor: User,
) -> BulkResult:
    _check_size(ids)
    return await _run_each(
        ids,
        lambda listing_id: admin_remove_listing(db, listing_id, background_tasks, actor=actor),
    )


async def bulk_set_listing_top(
    db: AsyncSession, ids: list[uuid.UUID], is_top: bool, *, actor: User
) -> BulkResult:
    _check_size(ids)
    return await _run_each(ids, lambda listing_id: toggle_listing_top(db, listing_id, is_top, actor=actor))


async def bulk_remove_shops(
    db: AsyncSession,
    ids: list[uuid.UUID],
    background_tasks: BackgroundTasks,
    *,
    actor: User,
) -> BulkResult:
    _check_size(ids)
    return await _run_each(
        ids, lambda shop_id: admin_remove_shop(db, shop_id, background_tasks, actor=actor)
    )


# --- post moderation ----------------------------------------------------------


async def list_all_posts(
    db: AsyncSession, status_filter: PostStatus | None = None, limit: int = 50, offset: int = 0
) -> tuple[list[ShopPost], int]:
    query = select(ShopPost).where(ShopPost.deleted_at.is_(None))
    if status_filter is not None:
        query = query.where(ShopPost.status == status_filter)
    count = (
        await db.execute(select(func.count()).select_from(query.with_only_columns(ShopPost.id).subquery()))
    ).scalar_one()
    query = query.order_by(ShopPost.created_at.desc()).limit(limit).offset(offset)
    posts = list((await db.execute(query)).scalars().unique().all())
    return posts, count


async def admin_approve_post(
    db: AsyncSession, post_id: uuid.UUID, background_tasks: BackgroundTasks, *, actor: User
) -> ShopPost:
    post = await db.get(ShopPost, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    if post.status != PostStatus.published:
        post.status = PostStatus.published
        post.published_at = datetime.now(UTC)
        post.rejection_reason = None

        followers = (
            await db.execute(select(ShopFollow.user_id).where(ShopFollow.shop_id == post.shop_id))
        ).scalars().all()
        for follower_id in followers:
            await notification_service.notify(
                db,
                background_tasks,
                follower_id,
                NotificationType.shop_new_post,
                title=f"{post.shop.shop_name} posted something new",
                body=post.title,
                link_url=f"/posts/{post.slug}",
                email_subject=f'{post.shop.shop_name} just posted: "{post.title}"',
                email_body=(
                    f'{post.shop.shop_name}, a shop you follow, just posted "{post.title}".\n\n'
                    f"View it: {settings.FRONTEND_URL}/posts/{post.slug}"
                ),
                related_post_id=post.id,
                related_shop_id=post.shop_id,
            )

        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.POST_APPROVED,
            target_type="post",
            target_id=post.id,
            target_label=post.title,
            detail={"shop_id": str(post.shop_id), "notified_followers": len(followers)},
        )
        await db.commit()
        await db.refresh(post)
    return post


async def admin_reject_post(
    db: AsyncSession, post_id: uuid.UUID, reason: str, background_tasks: BackgroundTasks, *, actor: User
) -> ShopPost:
    post = await db.get(ShopPost, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    post.status = PostStatus.rejected
    post.rejection_reason = reason
    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.POST_REJECTED,
        target_type="post",
        target_id=post.id,
        target_label=post.title,
        detail={"reason": reason},
    )
    await db.commit()
    await db.refresh(post)

    await notification_service.notify(
        db,
        background_tasks,
        post.shop.owner_id,
        NotificationType.post_rejected,
        title="Your post needs changes",
        body=f'"{post.title}" was not approved: {reason}',
        link_url="/shops/dashboard",
        email_subject="Your post on KenaBecha JU wasn't approved",
        email_body=f'Your post "{post.title}" was not approved by a moderator.\n\nReason: {reason}',
        related_post_id=post.id,
        related_shop_id=post.shop_id,
    )
    return post


async def admin_unpublish_post(db: AsyncSession, post_id: uuid.UUID, *, actor: User) -> ShopPost:
    post = await db.get(ShopPost, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    post.status = PostStatus.pending
    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.POST_UNPUBLISHED,
        target_type="post",
        target_id=post.id,
        target_label=post.title,
    )
    await db.commit()
    await db.refresh(post)
    return post


async def admin_delete_post(db: AsyncSession, post_id: uuid.UUID, *, actor: User) -> ShopPost:
    post = await db.get(ShopPost, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    if post.deleted_at is None:
        post.deleted_at = datetime.now(UTC)
        post.is_active = False
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.POST_DELETED,
            target_type="post",
            target_id=post.id,
            target_label=post.title,
        )
        await db.commit()
        await db.refresh(post)
    return post


async def bulk_approve_posts(
    db: AsyncSession, ids: list[uuid.UUID], background_tasks: BackgroundTasks, *, actor: User
) -> BulkResult:
    _check_size(ids)
    return await _run_each(
        ids, lambda post_id: admin_approve_post(db, post_id, background_tasks, actor=actor)
    )


async def bulk_reject_posts(
    db: AsyncSession, ids: list[uuid.UUID], reason: str, background_tasks: BackgroundTasks, *, actor: User
) -> BulkResult:
    _check_size(ids)
    return await _run_each(
        ids, lambda post_id: admin_reject_post(db, post_id, reason, background_tasks, actor=actor)
    )


async def bulk_unpublish_posts(db: AsyncSession, ids: list[uuid.UUID], *, actor: User) -> BulkResult:
    _check_size(ids)
    return await _run_each(ids, lambda post_id: admin_unpublish_post(db, post_id, actor=actor))


async def bulk_delete_posts(db: AsyncSession, ids: list[uuid.UUID], *, actor: User) -> BulkResult:
    _check_size(ids)
    return await _run_each(ids, lambda post_id: admin_delete_post(db, post_id, actor=actor))
