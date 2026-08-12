from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.navigation import SiteSetting
from app.models.user import User
from app.services import audit_service

ASSISTANT_KEY = "assistant"

#: `enabled: False` is the safe default — a fresh deployment, or one without
#: OPENAI_API_KEY set, never calls out to OpenAI until an admin opts in.
#: `system_prompt` ships with real instructions rather than empty text, so
#: flipping the toggle on works immediately without also requiring an admin
#: to write a prompt from scratch first.
DEFAULT: dict = {
    "enabled": False,
    "system_prompt": (
        "You are the KenaBecha JU shopping assistant, helping Jahangirnagar "
        "University students find listings on the marketplace. Only mention "
        "or recommend listings that come back from your search tool in this "
        "conversation — never invent a listing, price, or seller. Ask a "
        "clarifying question if the request is too vague to search well. "
        "Keep replies short and friendly. Never share a seller's phone "
        "number or WhatsApp directly — tell the buyer to use the Contact "
        "Seller button on the listing."
    ),
}


async def _row(db: AsyncSession) -> SiteSetting | None:
    return (
        await db.execute(select(SiteSetting).where(SiteSetting.key == ASSISTANT_KEY))
    ).scalar_one_or_none()


async def get_assistant_settings(db: AsyncSession) -> dict:
    row = await _row(db)
    return {**DEFAULT, **(row.value if row else {})}


async def set_assistant_settings(db: AsyncSession, payload: dict, *, actor: User) -> dict:
    row = await _row(db)
    if row is None:
        row = SiteSetting(key=ASSISTANT_KEY, value={})
        db.add(row)

    current = {**DEFAULT, **row.value}
    updated = {**current, **{k: v for k, v in payload.items() if k in DEFAULT}}

    if updated != current:
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.ASSISTANT_SETTINGS_CHANGED,
            target_type="site_setting",
            target_label=ASSISTANT_KEY,
            detail={"from": current, "to": updated},
        )
    row.value = updated
    await db.commit()
    return updated
