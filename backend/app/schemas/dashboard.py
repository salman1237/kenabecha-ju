from pydantic import BaseModel


class DashboardStatsOut(BaseModel):
    active_listings: int
    sold_listings: int
    shops: int
    unread_messages: int
    conversations: int
    saved_count: int
    average_rating: float | None
    rating_count: int


class ActivityPoint(BaseModel):
    date: str
    count: int


class SavedToggleOut(BaseModel):
    """Returns the resulting state so the client can trust the server rather
    than assuming its optimistic flip was correct."""

    saved: bool
