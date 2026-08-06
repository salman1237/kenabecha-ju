import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.page_section import SectionType


class PageSectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    section_type: SectionType
    sort_order: int
    is_active: bool
    settings: dict
    updated_at: datetime


class PageSectionCreate(BaseModel):
    section_type: SectionType


class PageSectionUpdate(BaseModel):
    is_active: bool | None = None
    # Replaces the whole object rather than merging, so a field can be cleared.
    settings: dict | None = None


class PageSectionOrderIn(BaseModel):
    """Every section id, in the order they should appear."""

    section_ids: list[uuid.UUID] = Field(min_length=1)
