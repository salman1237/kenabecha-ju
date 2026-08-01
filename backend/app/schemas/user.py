import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole
from app.schemas.reference import DepartmentOut, HallOut


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None
    phone: str
    bio: str | None
    student_id: str
    registration_no: str
    hall: HallOut
    department: DepartmentOut
    session: str
    batch: int
    role: UserRole
    is_verified: bool
    created_at: datetime
