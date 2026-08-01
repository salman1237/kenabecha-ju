import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.reference import Department, Hall


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class AuthProvider(str, enum.Enum):
    local = "local"
    google = "google"


class User(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_users_google_id",
            "google_id",
            unique=True,
            postgresql_where="google_id IS NOT NULL",
        ),
    )

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text)

    # JU student identity — collected at signup, verified via email OTP.
    student_id: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    registration_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    hall_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("halls.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    session: Mapped[str] = mapped_column(String(7), nullable=False)
    batch: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider"), default=AuthProvider.local, nullable=False
    )
    google_id: Mapped[str | None] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)

    hall: Mapped["Hall"] = relationship(lazy="selectin")
    department: Mapped["Department"] = relationship(lazy="selectin")
