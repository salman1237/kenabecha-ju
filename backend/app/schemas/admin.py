import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    student_id: str
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
