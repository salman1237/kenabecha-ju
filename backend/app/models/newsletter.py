from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin


class NewsletterSubscriber(UUIDPKMixin, CreatedAtMixin, Base):
    """Landing-page newsletter signups. Intentionally standalone from
    `users` — a subscriber doesn't need an account, and an account holder
    isn't automatically subscribed."""

    __tablename__ = "newsletter_subscribers"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
