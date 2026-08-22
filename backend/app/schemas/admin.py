import uuid
from datetime import date as datetime_date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class SetUserRoleIn(BaseModel):
    role: UserRole


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    student_id: str | None
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime


class AdminStatsOut(BaseModel):
    total_users: int
    total_shops: int
    total_active_listings: int
    total_messages: int
    pending_reports: int


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Snapshotted at write time, so the entry stays readable after the actor
    # is renamed or removed.
    actor_email: str
    actor_role: str
    action: str
    target_type: str | None
    target_id: uuid.UUID | None
    target_label: str | None
    detail: dict | None
    created_at: datetime


class DailyPoint(BaseModel):
    """One day's activity. Days with nothing are present with zeroes rather
    than omitted, so a chart cannot skip a quiet day and imply activity."""

    date: datetime_date
    signups: int
    listings: int
    messages: int


class TopListingOut(BaseModel):
    id: uuid.UUID
    title: str
    view_count: int


class DashboardTotals(BaseModel):
    """Each headline count paired with how many arrived inside the window —
    a bare total says how big the site is, not whether anything is happening."""

    total_users: int
    new_users: int
    total_shops: int
    new_shops: int
    total_active_listings: int
    new_listings: int
    total_messages: int
    new_messages: int
    pending_reports: int


class DashboardOut(BaseModel):
    days: int
    totals: DashboardTotals
    series: list[DailyPoint]
    top_listings: list[TopListingOut]


class BulkIdsIn(BaseModel):
    ids: list[uuid.UUID]


class BulkTopIn(BulkIdsIn):
    is_top: bool


class BulkRejectIn(BulkIdsIn):
    reason: str


class BulkResultOut(BaseModel):
    """Per-item outcome rather than all-or-nothing.

    Items are independent, so a moderator is told exactly which ids failed
    and why — more useful than an error that leaves them guessing what landed.
    """

    succeeded: list[str]
    failed: list[dict]


class AnnouncementOut(BaseModel):
    """The public shape: only what the banner needs to render."""

    message: dict
    variant: str
    dismissible: bool
    #: Bumped when the wording changes, so a dismissal applies to one
    #: announcement rather than silencing every future one.
    version: int


class AnnouncementAdminOut(AnnouncementOut):
    is_active: bool
    starts_at: str | None
    ends_at: str | None


class AnnouncementIn(BaseModel):
    message: dict | None = None
    variant: str | None = None
    is_active: bool | None = None
    starts_at: str | None = None
    ends_at: str | None = None
    dismissible: bool | None = None


class AssistantSettingsOut(BaseModel):
    enabled: bool
    system_prompt: str


class AssistantSettingsIn(BaseModel):
    enabled: bool | None = None
    system_prompt: str | None = Field(default=None, max_length=4000)
