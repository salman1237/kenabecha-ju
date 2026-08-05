from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.category import CategoryOut, CategoryRef
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)) -> list[CategoryOut]:
    """Full two-level tree with active-listing counts. Public — the sidebar
    and homepage cards render for signed-out visitors too."""
    return [CategoryOut(**c) for c in await category_service.list_tree(db)]


@router.get("/{slug}", response_model=CategoryRef)
async def get_category(slug: str, db: AsyncSession = Depends(get_db)) -> CategoryRef:
    category = await category_service.get_by_slug(db, slug)
    return CategoryRef.model_validate(category)
