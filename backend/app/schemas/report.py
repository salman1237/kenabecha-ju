import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.report import ReportReason, ReportStatus, ReportTargetType
from app.schemas.listing import ListingSellerOut


class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_id: uuid.UUID
    reason_code: ReportReason
    note: str | None = Field(default=None, max_length=1000)


class ResolveReportRequest(BaseModel):
    action: str = Field(description="one of: dismiss, remove, warn, ban")
    resolution_note: str | None = Field(default=None, max_length=1000)


class ReportOut(BaseModel):
    id: uuid.UUID
    reporter: ListingSellerOut
    target_type: ReportTargetType
    target_id: uuid.UUID
    target_label: str
    reason_code: ReportReason
    note: str | None
    status: ReportStatus
    resolved_by: ListingSellerOut | None
    resolved_at: datetime | None
    resolution_note: str | None
    created_at: datetime
