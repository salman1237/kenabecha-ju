from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.reference import Department, Hall
from app.schemas.reference import DepartmentOut, HallOut, SessionOption
from app.services.reference_service import list_session_options

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("/halls", response_model=list[HallOut])
async def list_halls(db: AsyncSession = Depends(get_db)) -> list[Hall]:
    result = await db.execute(select(Hall).order_by(Hall.name))
    return list(result.scalars().all())


@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db)) -> list[Department]:
    result = await db.execute(select(Department).order_by(Department.faculty, Department.name))
    return list(result.scalars().all())


@router.get("/sessions", response_model=list[SessionOption])
async def list_sessions() -> list[dict]:
    return list_session_options()
