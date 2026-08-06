import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

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
