import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.report import ReportStatus
from app.models.user import User
from app.schemas.admin import AdminStatsOut, AdminUserOut
from app.schemas.common import Page
from app.schemas.listing import ListingOut
from app.schemas.report import ReportOut, ResolveReportRequest
from app.schemas.shop import ShopOut
from app.services import admin_service, report_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


@router.get("/stats", response_model=AdminStatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)) -> AdminStatsOut:
    return await admin_service.get_stats(db)


@router.get("/users", response_model=Page[AdminUserOut])
async def list_users(
    q: str | None = None, limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)
) -> Page[AdminUserOut]:
    users, total = await admin_service.list_users(db, q, limit, offset)
    return Page(items=[AdminUserOut.model_validate(u) for u in users], total=total, limit=limit, offset=offset)


@router.patch("/users/{user_id}/active", response_model=AdminUserOut)
async def set_user_active(
    user_id: uuid.UUID, is_active: bool, db: AsyncSession = Depends(get_db)
) -> AdminUserOut:
    user = await admin_service.set_user_active(db, user_id, is_active)
    return AdminUserOut.model_validate(user)


@router.get("/listings", response_model=Page[ListingOut])
async def list_listings(
    limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)
) -> Page[ListingOut]:
    listings, total = await admin_service.list_all_listings(db, limit, offset)
    return Page(items=[ListingOut.model_validate(l) for l in listings], total=total, limit=limit, offset=offset)


@router.delete("/listings/{listing_id}", response_model=ListingOut)
async def remove_listing(listing_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ListingOut:
    listing = await admin_service.admin_remove_listing(db, listing_id)
    return ListingOut.model_validate(listing)


@router.get("/shops", response_model=Page[ShopOut])
async def list_shops(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)) -> Page[ShopOut]:
    shops, total = await admin_service.list_all_shops(db, limit, offset)
    return Page(
        items=[ShopOut.model_validate(s, from_attributes=True) for s in shops],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete("/shops/{shop_id}", response_model=ShopOut)
async def remove_shop(shop_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ShopOut:
    shop = await admin_service.admin_remove_shop(db, shop_id)
    return ShopOut.model_validate(shop, from_attributes=True)


def _report_to_out(report) -> ReportOut:
    target_id, target_label = report_service.target_id_and_label(report)
    return ReportOut(
        id=report.id,
        reporter=report.reporter,
        target_type=report.target_type,
        target_id=target_id,
        target_label=target_label,
        reason_code=report.reason_code,
        note=report.note,
        status=report.status,
        resolved_by=report.resolver,
        resolved_at=report.resolved_at,
        resolution_note=report.resolution_note,
        created_at=report.created_at,
    )


@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    status_filter: ReportStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> list[ReportOut]:
    reports = await report_service.list_reports(db, status_filter)
    return [_report_to_out(r) for r in reports]


@router.post("/reports/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: uuid.UUID,
    payload: ResolveReportRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    report = await report_service.get_report(db, report_id)
    report = await report_service.resolve_report(db, report, admin, payload)
    return _report_to_out(report)
