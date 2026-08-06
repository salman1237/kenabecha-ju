import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import User


class AuditAction:
    """Action names, as constants rather than a database enum.

    An enum would mean a migration every time an action is added, and unlike
    `user_role` or `listing_status` nothing branches on these values — they
    are recorded and displayed. The cost of a typo is a mislabelled row, not
    broken behaviour, so the flexibility is worth more than the constraint.
    """

    USER_ROLE_CHANGED = "user.role_changed"
    USER_DEACTIVATED = "user.deactivated"
    USER_REACTIVATED = "user.reactivated"
    LISTING_REMOVED = "listing.removed"
    LISTING_TOP_CHANGED = "listing.top_changed"
    LISTING_FEATURED = "listing.featured"
    SHOP_REMOVED = "shop.removed"
    REPORT_RESOLVED = "report.resolved"
    SECTION_CREATED = "section.created"
    SECTION_UPDATED = "section.updated"
    SECTION_DELETED = "section.deleted"
    SECTIONS_REORDERED = "section.reordered"
    CATEGORY_CREATED = "category.created"
    CATEGORY_UPDATED = "category.updated"
    CATEGORY_DELETED = "category.deleted"
    CATEGORIES_REORDERED = "category.reordered"
    NAV_MENU_CREATED = "nav_menu.created"
    NAV_MENU_UPDATED = "nav_menu.updated"
    NAV_MENU_DELETED = "nav_menu.deleted"
    NAV_MENUS_REORDERED = "nav_menu.reordered"
    NAV_LINK_CREATED = "nav_link.created"
    NAV_LINK_UPDATED = "nav_link.updated"
    NAV_LINK_DELETED = "nav_link.deleted"
    NAV_LINKS_REORDERED = "nav_link.reordered"
    NAVBAR_CONTROLS_CHANGED = "navbar_controls.changed"


class AuditLog(UUIDPKMixin, CreatedAtMixin, Base):
    """An append-only record of privileged actions.

    Exists because moderation powers now belong to more than one person, and
    "who removed this shop?" has to be answerable. There is deliberately no
    update or delete path anywhere in the application: a trail an admin can
    quietly edit is not a trail.
    """

    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_created_at", "created_at"),
        Index("ix_audit_log_actor_id_created_at", "actor_id", "created_at"),
        Index("ix_audit_log_action_created_at", "action", "created_at"),
    )

    # SET NULL rather than CASCADE: deleting a user must not erase the record
    # of what they did. The snapshot below keeps the entry readable afterwards.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    # Denormalised on purpose. Without it, a deleted or renamed actor turns
    # every one of their entries into an anonymous row, which defeats the
    # point — an audit trail has to describe the past, not the present.
    actor_email: Mapped[str] = mapped_column(String(320), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(20), nullable=False)

    action: Mapped[str] = mapped_column(String(64), nullable=False)

    # No foreign key: targets get removed, and the entry describing the
    # removal must outlive them.
    target_type: Mapped[str | None] = mapped_column(String(32))
    target_id: Mapped[uuid.UUID | None] = mapped_column()
    # A human label captured at the time — a listing title, a shop name — so
    # the log reads as something meaningful rather than a bare UUID.
    target_label: Mapped[str | None] = mapped_column(Text)

    # Free-form context: old and new values, a resolution note, and so on.
    detail: Mapped[dict | None] = mapped_column(JSONB)

    # clock_timestamp(), not the inherited now(). now() returns the
    # *transaction* start time, so two entries written in one transaction —
    # resolving a report that also removes a listing, say — would carry
    # identical timestamps and their order would be undefined. An audit log
    # that cannot say which of two actions came first is a poor one.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )

    actor: Mapped["User | None"] = relationship(lazy="selectin")
