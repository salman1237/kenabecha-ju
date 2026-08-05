from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.search import LIKE_ESCAPE, like_contains
from app.models.listing import Tag

MAX_TAGS_PER_LISTING = 10


def _normalize(name: str) -> str:
    return name.strip().lower()


async def autocomplete(db: AsyncSession, query: str, limit: int = 10) -> list[Tag]:
    normalized = _normalize(query)
    if not normalized:
        return []
    result = await db.execute(
        select(Tag)
        .where(Tag.normalized_name.ilike(like_contains(normalized), escape=LIKE_ESCAPE))
        .order_by(Tag.usage_count.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def trending(db: AsyncSession, limit: int = 15) -> list[Tag]:
    result = await db.execute(select(Tag).order_by(Tag.usage_count.desc()).limit(limit))
    return list(result.scalars().all())


async def get_or_create_tags(db: AsyncSession, names: list[str]) -> list[Tag]:
    seen: dict[str, str] = {}
    for raw in names[:MAX_TAGS_PER_LISTING]:
        normalized = _normalize(raw)
        if normalized and normalized not in seen:
            seen[normalized] = raw.strip()

    if not seen:
        return []

    result = await db.execute(select(Tag).where(Tag.normalized_name.in_(seen.keys())))
    existing = {tag.normalized_name: tag for tag in result.scalars().all()}

    tags: list[Tag] = []
    for normalized, display_name in seen.items():
        tag = existing.get(normalized)
        if tag is None:
            tag = Tag(name=display_name, normalized_name=normalized, usage_count=0)
            db.add(tag)
        tags.append(tag)
    return tags
