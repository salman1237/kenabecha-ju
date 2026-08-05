import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import ActivityPoint, DashboardStatsOut, SavedToggleOut
from app.schemas.listing import ListingOut
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStatsOut)
async def get_stats(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> DashboardStatsOut:
    stats = await dashboard_service.get_dashboard_stats(db, user)
    return DashboardStatsOut(**stats)


@router.get("/activity", response_model=list[ActivityPoint])
async def get_activity(
    days: int = Query(default=30, ge=7, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityPoint]:
    points = await dashboard_service.get_listing_activity(db, user, days)
    return [ActivityPoint(**p) for p in points]


@router.get("/saved", response_model=list[ListingOut])
async def get_saved(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ListingOut]:
    listings = await dashboard_service.list_saved(db, user)
    return [ListingOut.model_validate(i) for i in listings]


@router.get("/saved/ids", response_model=list[uuid.UUID])
async def get_saved_ids(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[uuid.UUID]:
    """Just the ids, so listing grids can render save-state without
    fetching every saved listing in full."""
    return await dashboard_service.list_saved_ids(db, user)


@router.post("/saved/{listing_id}", response_model=SavedToggleOut)
async def toggle_saved(
    listing_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SavedToggleOut:
    saved = await dashboard_service.toggle_saved(db, user, listing_id)
    return SavedToggleOut(saved=saved)
