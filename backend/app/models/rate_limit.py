from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin


class RateLimitHit(UUIDPKMixin, CreatedAtMixin, Base):
    """One row per rate-limited request attempt.

    Stored in Postgres rather than process memory on purpose: production
    runs `uvicorn --workers 4`, so an in-memory counter would live per
    worker and an attacker would effectively get 4x the intended limit
    (and more again behind multiple replicas). These endpoints are
    inherently low-frequency, so the extra indexed round-trip is cheap
    next to actually enforcing the limit we claim to enforce.
    """

    __tablename__ = "rate_limit_hits"
    __table_args__ = (
        # Every query filters on bucket_key and a created_at cutoff.
        Index("ix_rate_limit_hits_bucket_created", "bucket_key", "created_at"),
    )

    #: "<scope>:<identifier>", e.g. "login:203.0.113.4" or "login:a@b.com".
    bucket_key: Mapped[str] = mapped_column(String(255), nullable=False)
