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
    whatsapp_number: str | None
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
    """Public-facing profile. Contact/identity fields (email, phone, whatsapp_number,
    student_id, registration_no, hall, session) are shown to any viewer by product
    decision — this is a closed campus marketplace where full contact/verification
    transparency is the point, not a general-purpose public app."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    avatar_url: str | None
    email: str
    phone: str | None
    whatsapp_number: str | None
    student_id: str | None
    registration_no: str | None
    hall: HallOut | None
    session: str | None
    bio: str | None
    department: DepartmentOut | None
    batch: int | None
    profile_complete: bool
    created_at: datetime
    average_rating: float | None = None
    rating_count: int = 0
    recent_ratings: list[RatingOut] = []
    shops: list[ShopOut] = []
