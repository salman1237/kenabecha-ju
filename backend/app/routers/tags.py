from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.tag import TagOut
from app.services import tag_service

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/autocomplete", response_model=list[TagOut])
async def autocomplete_tags(q: str = Query(min_length=1), db: AsyncSession = Depends(get_db)) -> list[TagOut]:
    return await tag_service.autocomplete(db, q)


@router.get("/trending", response_model=list[TagOut])
async def trending_tags(db: AsyncSession = Depends(get_db)) -> list[TagOut]:
    return await tag_service.trending(db)
