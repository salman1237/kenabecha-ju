import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.shop import Shop
    from app.models.user import User


class ReportTargetType(str, enum.Enum):
    listing = "listing"
    shop = "shop"
    user = "user"


class ReportReason(str, enum.Enum):
    spam = "spam"
    scam_fraud = "scam_fraud"
    inappropriate_content = "inappropriate_content"
    counterfeit = "counterfeit"
    harassment = "harassment"
    other = "other"


class ReportStatus(str, enum.Enum):
    pending = "pending"
    resolved_dismissed = "resolved_dismissed"
    resolved_removed = "resolved_removed"
    resolved_warned = "resolved_warned"
    resolved_banned = "resolved_banned"


class Report(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(
            "(target_type = 'listing' AND target_listing_id IS NOT NULL "
            "AND target_shop_id IS NULL AND target_user_id IS NULL) OR "
            "(target_type = 'shop' AND target_shop_id IS NOT NULL "
            "AND target_listing_id IS NULL AND target_user_id IS NULL) OR "
            "(target_type = 'user' AND target_user_id IS NOT NULL "
            "AND target_listing_id IS NULL AND target_shop_id IS NULL)",
            name="report_target_matches_type",
        ),
        Index("ix_reports_status_pending", "status", postgresql_where="status = 'pending'"),
    )

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_type: Mapped[ReportTargetType] = mapped_column(
        Enum(ReportTargetType, name="report_target_type"), nullable=False, index=True
    )
    target_listing_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE")
    )
    target_shop_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"))
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reason_code: Mapped[ReportReason] = mapped_column(
        Enum(ReportReason, name="report_reason"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, name="report_status"), default=ReportStatus.pending, nullable=False
    )
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[str | None] = mapped_column(Text)

    reporter: Mapped["User"] = relationship(foreign_keys=[reporter_id], lazy="selectin")
    resolver: Mapped["User | None"] = relationship(foreign_keys=[resolved_by], lazy="selectin")
    target_listing: Mapped["Listing | None"] = relationship(lazy="selectin")
    target_shop: Mapped["Shop | None"] = relationship(lazy="selectin")
    target_user: Mapped["User | None"] = relationship(foreign_keys=[target_user_id], lazy="selectin")
