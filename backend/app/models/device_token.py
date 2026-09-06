import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import User


class DeviceToken(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "device_tokens"
    __table_args__ = (
        # A physical device's FCM token is unique across the whole system —
        # registering it again (re-login as a different account on the same
        # device) re-points the existing row rather than accumulating
        # duplicates that would double-push or notify the wrong owner.
        UniqueConstraint("fcm_token", name="uq_device_tokens_fcm_token"),
        Index("ix_device_tokens_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    fcm_token: Mapped[str] = mapped_column(String(300), nullable=False)
    platform: Mapped[str] = mapped_column(String(20), nullable=False, default="android")

    user: Mapped["User"] = relationship()
