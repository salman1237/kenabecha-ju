import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.page_section import PageSection, SectionType
from app.models.user import User
from app.services import audit_service


async def list_sections(db: AsyncSession, *, active_only: bool) -> list[PageSection]:
    query = select(PageSection).order_by(PageSection.sort_order, PageSection.key)
    if active_only:
        query = query.where(PageSection.is_active.is_(True))
    return list((await db.execute(query)).scalars().all())


async def _get(db: AsyncSession, section_id: uuid.UUID) -> PageSection:
    section = await db.get(PageSection, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Section not found")
    return section


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "section"


async def _unique_key(db: AsyncSession, base: str) -> str:
    """A key nobody is using yet.

    Adding a second section of the same type is legitimate — two listing rails
    with different titles, say — so a collision must not be an error the admin
    has to resolve by inventing a name.
    """
    key = _slugify(base)
    existing = set(
        (await db.execute(select(PageSection.key).where(PageSection.key.like(f"{key}%")))).scalars().all()
    )
    if key not in existing:
        return key
    for n in range(2, 100):
        candidate = f"{key}-{n}"
        if candidate not in existing:
            return candidate
    return f"{key}-{uuid.uuid4().hex[:6]}"


async def create_section(
    db: AsyncSession, section_type: SectionType, *, actor: User
) -> PageSection:
    """Add a section to the end of the page, hidden by default.

    Hidden so that adding one is not immediately visible to every visitor
    before the admin has set its copy — the reverse would make the homepage
    change under people mid-edit.
    """
    max_order = (
        await db.execute(select(func.coalesce(func.max(PageSection.sort_order), -1)))
    ).scalar_one()

    section = PageSection(
        key=await _unique_key(db, section_type.value),
        section_type=section_type,
        sort_order=max_order + 1,
        is_active=False,
        settings={},
    )
    db.add(section)
    await db.flush()

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.SECTION_CREATED,
        target_type="page_section",
        target_id=section.id,
        target_label=section.key,
        detail={"type": section_type.value},
    )
    await db.commit()
    await db.refresh(section)
    return section


async def update_section(
    db: AsyncSession,
    section_id: uuid.UUID,
    *,
    is_active: bool | None = None,
    settings: dict | None = None,
    actor: User,
) -> PageSection:
    section = await _get(db, section_id)
    changed: dict = {}

    if is_active is not None and is_active != section.is_active:
        changed["is_active"] = {"from": section.is_active, "to": is_active}
        section.is_active = is_active

    if settings is not None:
        # Replace rather than merge: the editor always submits the whole
        # object, and merging would make clearing a field impossible.
        changed["settings"] = True
        section.settings = settings

    if changed:
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.SECTION_UPDATED,
            target_type="page_section",
            target_id=section.id,
            target_label=section.key,
            detail=changed,
        )
    await db.commit()
    await db.refresh(section)
    return section


async def reorder_sections(
    db: AsyncSession, section_ids: list[uuid.UUID], *, actor: User
) -> list[PageSection]:
    """Apply an explicit order.

    Requires every section exactly once, for the same reason image reordering
    does: a partial list leaves the omitted rows at stale positions and
    produces duplicate sort_orders, which then renders in an arbitrary order.
    """
    current = {s.id: s for s in await list_sections(db, active_only=False)}
    if set(section_ids) != set(current) or len(section_ids) != len(current):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The order must list every section exactly once",
        )

    for index, section_id in enumerate(section_ids):
        current[section_id].sort_order = index

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.SECTIONS_REORDERED,
        target_type="page_section",
        detail={"order": [current[i].key for i in section_ids]},
    )
    await db.commit()
    return await list_sections(db, active_only=False)


async def delete_section(db: AsyncSession, section_id: uuid.UUID, *, actor: User) -> None:
    """Remove a section outright.

    A hard delete, unlike listings and shops: there is nothing here worth
    keeping — the section's content is generated by its component, and the
    same type can be added back at any time. What is worth keeping is the
    record that it happened, which the audit entry provides.
    """
    section = await _get(db, section_id)
    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.SECTION_DELETED,
        target_type="page_section",
        target_id=section.id,
        target_label=section.key,
        detail={"type": section.section_type.value, "settings": section.settings},
    )
    await db.delete(section)
    await db.commit()
