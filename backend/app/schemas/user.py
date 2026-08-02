import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import AuthProvider, UserRole
from app.schemas.rating import RatingOut
from app.schemas.reference import DepartmentOut, HallOut
from app.schemas.shop import ShopOut


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None
    phone: str | None
    bio: str | None
    student_id: str | None
    registration_no: str | None
    hall: HallOut | None
    department: DepartmentOut | None
    session: str | None
    batch: int | None
    role: UserRole
    auth_provider: AuthProvider
    is_verified: bool
    profile_complete: bool
    created_at: datetime


class UserProfileOut(BaseModel):
    """Public-facing profile — deliberately excludes PII (email, phone, student_id,
    registration_no, hall) that UserPublic includes for the self-view."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    avatar_url: str | None
    bio: str | None
    department: DepartmentOut | None
    batch: int | None
    created_at: datetime
    average_rating: float | None = None
    rating_count: int = 0
    recent_ratings: list[RatingOut] = []
    shops: list[ShopOut] = []
