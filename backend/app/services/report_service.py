import uuid
from datetime import UTC, datetime

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.listing import Listing
from app.models.notification import NotificationType
from app.models.report import Report, ReportStatus, ReportTargetType
from app.models.shop import Shop
from app.models.user import User
from app.schemas.report import ReportCreate, ResolveReportRequest
from app.services import admin_service, auth_service, notification_service

VALID_ACTIONS = {"dismiss", "remove", "warn", "ban"}
settings = get_settings()


async def create_report(
    db: AsyncSession, reporter: User, payload: ReportCreate, background_tasks: BackgroundTasks
) -> Report:
    kwargs: dict = {
        "reporter_id": reporter.id,
        "target_type": payload.target_type,
        "reason_code": payload.reason_code,
        "note": payload.note,
    }

    if payload.target_type == ReportTargetType.listing:
        target = await db.get(Listing, payload.target_id)
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
        kwargs["target_listing_id"] = payload.target_id
    elif payload.target_type == ReportTargetType.shop:
        target = await db.get(Shop, payload.target_id)
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
        kwargs["target_shop_id"] = payload.target_id
    else:
        if payload.target_id == reporter.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't report yourself")
        target = await db.get(User, payload.target_id)
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        kwargs["target_user_id"] = payload.target_id

    report = Report(**kwargs)
    db.add(report)
    await db.commit()
    await db.refresh(report)

    if payload.target_type == ReportTargetType.listing:
        listing: Listing = target
        await notification_service.notify(
            db,
            background_tasks,
            listing.seller_id,
            NotificationType.listing_reported,
            title="Your listing was reported",
            body=f'"{listing.title}" was reported for {payload.reason_code.value.replace("_", " ")}.',
            link_url=f"/listings/{listing.id}",
            email_subject="Your listing was reported on KenaBecha JU",
            email_body=(
                f'Your listing "{listing.title}" was reported by another user for '
                f'{payload.reason_code.value.replace("_", " ")}. It\'s under review by a moderator.\n\n'
                f"View it at: {settings.FRONTEND_URL}/listings/{listing.id}"
            ),
            related_listing_id=listing.id,
        )
    elif payload.target_type == ReportTargetType.shop:
        shop: Shop = target
        await notification_service.notify(
            db,
            background_tasks,
            shop.owner_id,
            NotificationType.shop_reported,
            title="Your shop was reported",
            body=f'"{shop.shop_name}" was reported for {payload.reason_code.value.replace("_", " ")}.',
            link_url=f"/shops/{shop.slug}",
            email_subject="Your shop was reported on KenaBecha JU",
            email_body=(
                f'Your shop "{shop.shop_name}" was reported by another user for '
                f'{payload.reason_code.value.replace("_", " ")}. It\'s under review by a moderator.\n\n'
                f"View it at: {settings.FRONTEND_URL}/shops/{shop.slug}"
            ),
            related_shop_id=shop.id,
        )

    return report


async def list_reports(db: AsyncSession, status_filter: ReportStatus | None = None, limit: int = 50) -> list[Report]:
    query = select(Report)
    if status_filter is not None:
        query = query.where(Report.status == status_filter)
    query = query.order_by(Report.created_at.desc()).limit(limit)
    return list((await db.execute(query)).scalars().unique().all())


async def get_report(db: AsyncSession, report_id: uuid.UUID) -> Report:
    report = await db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return report


def target_id_and_label(report: Report) -> tuple[uuid.UUID, str]:
    if report.target_type == ReportTargetType.listing:
        return report.target_listing_id, report.target_listing.title
    if report.target_type == ReportTargetType.shop:
        return report.target_shop_id, report.target_shop.shop_name
    return report.target_user_id, report.target_user.full_name


async def resolve_report(
    db: AsyncSession,
    report: Report,
    admin: User,
    payload: ResolveReportRequest,
    background_tasks: BackgroundTasks,
) -> Report:
    if report.status != ReportStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This report has already been resolved")
    if payload.action not in VALID_ACTIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"action must be one of {sorted(VALID_ACTIONS)}")

    if payload.action == "dismiss":
        report.status = ReportStatus.resolved_dismissed

    elif payload.action == "remove":
        # Delegate to admin_service rather than duplicating the soft-delete logic here,
        # so the listing_removed/shop_removed notification fires from one place
        # regardless of whether removal happened via a report or the direct admin UI.
        if report.target_type == ReportTargetType.listing:
            await admin_service.admin_remove_listing(db, report.target_listing_id, background_tasks)
        elif report.target_type == ReportTargetType.shop:
            await admin_service.admin_remove_shop(db, report.target_shop_id, background_tasks)
        else:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "'remove' only applies to listing or shop reports"
            )
        report.status = ReportStatus.resolved_removed

    elif payload.action == "warn":
        report.status = ReportStatus.resolved_warned

    else:  # ban
        if report.target_type == ReportTargetType.user:
            target_user_id = report.target_user_id
        elif report.target_type == ReportTargetType.listing:
            target_user_id = report.target_listing.seller_id
        else:
            target_user_id = report.target_shop.owner_id
        target_user = await db.get(User, target_user_id)
        target_user.is_active = False
        await auth_service.revoke_all_user_tokens(db, target_user.id)
        report.status = ReportStatus.resolved_banned

    report.resolved_by = admin.id
    report.resolved_at = datetime.now(UTC)
    report.resolution_note = payload.resolution_note

    await db.commit()
    await db.refresh(report)
    return report
