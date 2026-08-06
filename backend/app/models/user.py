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
    # Can act on reports and remove listings and shops, but cannot manage
    # users, grant roles, or edit site content. Moderating and administering
    # are different jobs, and conflating them means every volunteer helper
    # also gets the ability to lock the owner out.
    moderator = "moderator"
    admin = "admin"

    @property
    def is_staff(self) -> bool:
        """Whether this role may use the moderation surface."""
        return self in (UserRole.moderator, UserRole.admin)


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
    whatsapp_number: Mapped[str | None] = mapped_column(String(30))
    bio: Mapped[str | None] = mapped_column(Text)

    # JU student identity — required to sell (create a shop/listing), optional at
    # signup for Google-lite buyers. See User.profile_complete.
    student_id: Mapped[str | None] = mapped_column(String(30), unique=True)
    registration_no: Mapped[str | None] = mapped_column(String(30), unique=True)
    hall_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("halls.id", ondelete="RESTRICT"), index=True
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="RESTRICT"), index=True
    )
    session: Mapped[str | None] = mapped_column(String(7))
    batch: Mapped[int | None] = mapped_column(SmallInteger)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider"), default=AuthProvider.local, nullable=False
    )
    google_id: Mapped[str | None] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)

    hall: Mapped["Hall | None"] = relationship(lazy="selectin")
    department: Mapped["Department | None"] = relationship(lazy="selectin")

    @property
    def profile_complete(self) -> bool:
        """Whether the full JU-verification fields are filled in — required before
        creating a shop or listing. Google-lite buyers start out False."""
        return all(
            [
                self.phone,
                self.student_id,
                self.registration_no,
                self.hall_id,
                self.department_id,
                self.session,
                self.batch,
            ]
        )
