from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.navigation import SiteSetting
from app.models.user import User
from app.services import audit_service

ANNOUNCEMENT_KEY = "announcement"

#: What an unset announcement looks like. Every field has a default, so a
#: missing or empty row is "no banner" rather than a crash or a blank bar.
DEFAULT: dict = {
    "message": {},
    "variant": "info",
    "is_active": False,
    "starts_at": None,
    "ends_at": None,
    "dismissible": True,
    "version": 0,
}

VARIANTS = {"info", "warning", "critical"}


async def _row(db: AsyncSession) -> SiteSetting | None:
    return (
        await db.execute(select(SiteSetting).where(SiteSetting.key == ANNOUNCEMENT_KEY))
    ).scalar_one_or_none()


async def get_announcement(db: AsyncSession) -> dict:
    """The stored announcement, with every default filled in."""
    row = await _row(db)
    return {**DEFAULT, **(row.value if row else {})}


def _is_live(announcement: dict, now: datetime) -> bool:
    """Whether the banner should be on screen right now.

    Scheduling is checked on the server rather than in the browser: a device
    with a wrong clock would otherwise show a maintenance notice a day early,
    or keep one up after it should have gone.
    """
    if not announcement.get("is_active"):
        return False
    if not any(str(v).strip() for v in (announcement.get("message") or {}).values()):
        return False

    for field, compare in (("starts_at", "after"), ("ends_at", "before")):
        raw = announcement.get(field)
        if not raw:
            continue
        try:
            moment = datetime.fromisoformat(str(raw))
        except ValueError:
            # A malformed date must not hide a live announcement, nor show a
            # scheduled one early. Treating it as absent keeps the other bound
            # working.
            continue
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=UTC)
        if compare == "after" and now < moment:
            return False
        if compare == "before" and now > moment:
            return False
    return True


async def get_live_announcement(db: AsyncSession) -> dict | None:
    """What the public site should render, or None."""
    announcement = await get_announcement(db)
    if not _is_live(announcement, datetime.now(UTC)):
        return None
    return {
        "message": announcement["message"],
        "variant": announcement["variant"]
        if announcement["variant"] in VARIANTS
        else DEFAULT["variant"],
        "dismissible": bool(announcement["dismissible"]),
        # Sent so a dismissal can be remembered per announcement. Without it,
        # anyone who dismissed the last banner would never see the next one —
        # which for a maintenance notice is the one that mattered.
        "version": announcement["version"],
    }


async def set_announcement(db: AsyncSession, payload: dict, *, actor: User) -> dict:
    row = await _row(db)
    if row is None:
        row = SiteSetting(key=ANNOUNCEMENT_KEY, value={})
        db.add(row)

    current = {**DEFAULT, **row.value}
    updated = {**current, **{k: v for k, v in payload.items() if k in DEFAULT}}

    if updated["variant"] not in VARIANTS:
        updated["variant"] = DEFAULT["variant"]

    # Bumped whenever the wording changes, so a reader who dismissed the
    # previous notice is shown the new one. Not bumped for a schedule tweak
    # or a variant change, which would re-nag people over nothing.
    if updated["message"] != current["message"]:
        updated["version"] = int(current["version"]) + 1

    if updated != current:
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.ANNOUNCEMENT_CHANGED,
            target_type="site_setting",
            target_label=ANNOUNCEMENT_KEY,
            detail={"from": current, "to": updated},
        )
    row.value = updated
    await db.commit()
    return updated
