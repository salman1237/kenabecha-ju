import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.services.reference_service import parse_session_start_year

PHONE_PATTERN = r"^(?:\+?880|0)1[3-9]\d{8}$"


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    phone: str = Field(pattern=PHONE_PATTERN)
    student_id: str = Field(min_length=1, max_length=30)
    registration_no: str = Field(min_length=1, max_length=30)
    hall_id: uuid.UUID
    department_id: uuid.UUID
    session: str

    @field_validator("session")
    @classmethod
    def validate_session(cls, value: str) -> str:
        parse_session_start_year(value)  # raises ValueError on bad format
        return value


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")


class ResendOtpRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
