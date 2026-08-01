import uuid

from pydantic import BaseModel, ConfigDict


class HallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    faculty: str


class SessionOption(BaseModel):
    session: str
    batch: int
