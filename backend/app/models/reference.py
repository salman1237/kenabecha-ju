from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import UUIDPKMixin


class Hall(UUIDPKMixin, Base):
    __tablename__ = "halls"

    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)


class Department(UUIDPKMixin, Base):
    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    faculty: Mapped[str] = mapped_column(String(150), nullable=False)
