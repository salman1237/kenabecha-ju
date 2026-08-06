import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Message
from app.models.listing import Listing, ListingStatus
from app.models.report import Report, ReportStatus
from app.models.shop import Shop
from app.models.user import User

#: Buckets are days in Dhaka time, not UTC. Everyone using this site is on
#: campus; bucketing in UTC would file every evening's activity under the
#: following day and make the chart disagree with what an admin remembers.
CAMPUS_TZ = "Asia/Dhaka"

#: A ceiling on the window. Not a guard against abuse — this is admin-only —
#: but against someone typing 100000 and waiting on a scan of every row.
MAX_DAYS = 365


def _local_date(column):
    return func.date(func.timezone(CAMPUS_TZ, column))


async def _daily_counts(db: AsyncSession, column, since: date, *, where=None) -> dict[date, int]:
    query = (
        select(_local_date(column).label("day"), func.count())
        .where(_local_date(column) >= since)
        .group_by("day")
    )
    if where is not None:
        query = query.where(where)
    return {row.day: row.count for row in (await db.execute(query)).all()}


async def activity_series(db: AsyncSession, days: int) -> list[dict]:
    """Signups, new listings and messages per day.

    Gaps are filled with zeroes rather than omitted. A quiet Friday that
    simply vanishes from the series makes the line jump straight from
    Thursday to Saturday, which reads as steady activity across a day when
    there was none — the chart would be quietly lying.
    """
    days = max(1, min(days, MAX_DAYS))
    today = (
        await db.execute(select(func.date(func.timezone(CAMPUS_TZ, func.now()))))
    ).scalar_one()
    since = today - timedelta(days=days - 1)

    signups = await _daily_counts(db, User.created_at, since)
    listings = await _daily_counts(
        db, Listing.created_at, since, where=Listing.deleted_at.is_(None)
    )
    messages = await _daily_counts(db, Message.created_at, since)

    return [
        {
            "date": since + timedelta(days=offset),
            "signups": signups.get(since + timedelta(days=offset), 0),
            "listings": listings.get(since + timedelta(days=offset), 0),
            "messages": messages.get(since + timedelta(days=offset), 0),
        }
        for offset in range(days)
    ]


async def top_listings(db: AsyncSession, limit: int = 5) -> list[dict]:
    """The most-viewed listings currently on sale.

    Restricted to active ones on purpose: this is here to answer "what should
    we put in front of people?", and a sold-out listing is not an answer.
    """
    rows = (
        await db.execute(
            select(Listing.id, Listing.title, Listing.view_count)
            .where(Listing.status == ListingStatus.active, Listing.deleted_at.is_(None))
            .order_by(Listing.view_count.desc(), Listing.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [{"id": r.id, "title": r.title, "view_count": r.view_count} for r in rows]


async def _count_since(db: AsyncSession, column, since: date, *, where=None) -> int:
    query = select(func.count()).where(_local_date(column) >= since)
    if where is not None:
        query = query.where(where)
    return (await db.execute(query)).scalar_one()


async def totals(db: AsyncSession, days: int) -> dict:
    """Headline counts, each paired with how many arrived inside the window.

    A bare total tells an admin how big the site is; it does not tell them
    whether anything is happening. The pair does.
    """
    days = max(1, min(days, MAX_DAYS))
    today = (
        await db.execute(select(func.date(func.timezone(CAMPUS_TZ, func.now()))))
    ).scalar_one()
    since = today - timedelta(days=days - 1)

    async def count(model, where=None) -> int:
        query = select(func.count()).select_from(model)
        if where is not None:
            query = query.where(where)
        return (await db.execute(query)).scalar_one()

    return {
        "total_users": await count(User),
        "new_users": await _count_since(db, User.created_at, since),
        "total_shops": await count(Shop, Shop.deleted_at.is_(None)),
        "new_shops": await _count_since(
            db, Shop.created_at, since, where=Shop.deleted_at.is_(None)
        ),
        "total_active_listings": await count(Listing, Listing.status == ListingStatus.active),
        "new_listings": await _count_since(
            db, Listing.created_at, since, where=Listing.deleted_at.is_(None)
        ),
        "total_messages": await count(Message),
        "new_messages": await _count_since(db, Message.created_at, since),
        "pending_reports": await count(Report, Report.status == ReportStatus.pending),
    }


async def dashboard(db: AsyncSession, days: int) -> dict:
    return {
        "days": max(1, min(days, MAX_DAYS)),
        "totals": await totals(db, days),
        "series": await activity_series(db, days),
        "top_listings": await top_listings(db),
    }


async def listing_ids_exist(db: AsyncSession, ids: list[uuid.UUID]) -> set[uuid.UUID]:
    rows = await db.execute(select(Listing.id).where(Listing.id.in_(ids)))
    return set(rows.scalars().all())
