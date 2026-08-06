import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import User


def record(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    target_label: str | None = None,
    detail: dict | None = None,
) -> AuditLog:
    """Add an audit entry to the caller's transaction.

    Deliberately not `async` and deliberately without a commit: the entry is
    added to the same transaction as the action it describes, so the two
    succeed or fail together. Logging separately would allow either a
    recorded action that never happened, or an action with no record.

    The actor's email and role are snapshotted rather than left to the
    relationship, so the entry still says who did it after the account is
    renamed or removed.
    """
    entry = AuditLog(
        actor_id=actor.id,
        actor_email=actor.email,
        actor_role=actor.role.value if hasattr(actor.role, "value") else str(actor.role),
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_label=target_label,
        detail=detail,
    )
    db.add(entry)
    return entry


async def list_entries(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuditLog], int]:
    query = select(AuditLog)
    if actor_id is not None:
        query = query.where(AuditLog.actor_id == actor_id)
    if action:
        query = query.where(AuditLog.action == action)

    total = (
        await db.execute(select(func.count()).select_from(query.with_only_columns(AuditLog.id).subquery()))
    ).scalar_one()

    # Newest first: an audit log is read to answer "what just happened".
    query = query.order_by(AuditLog.created_at.desc()).limit(min(limit, 200)).offset(offset)
    entries = list((await db.execute(query)).scalars().unique().all())
    return entries, total


async def list_actions(db: AsyncSession) -> list[str]:
    """Action names actually present, for the filter dropdown.

    Read from the data rather than from the AuditAction constants so the
    filter only offers values that would return something.
    """
    rows = await db.execute(select(AuditLog.action).distinct().order_by(AuditLog.action))
    return list(rows.scalars().all())
