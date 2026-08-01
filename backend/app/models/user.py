import enum

from sqlalchemy import Enum, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin


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
    phone: Mapped[str | None] = mapped_column(String(30))
    bio: Mapped[str | None] = mapped_column(Text)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider"), default=AuthProvider.local, nullable=False
    )
    google_id: Mapped[str | None] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
