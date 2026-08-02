import uuid
from datetime import UTC, datetime, timedelta

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    generate_otp,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.reference import Department, Hall
from app.models.token import AuthToken, AuthTokenPurpose, RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest
from app.services.email_service import send_otp_email
from app.services.reference_service import compute_batch

settings = get_settings()

OTP_EXPIRE_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def _create_otp(db: AsyncSession, user: User, background_tasks: BackgroundTasks) -> None:
    otp = generate_otp()
    auth_token = AuthToken(
        user_id=user.id,
        token_hash=hash_token(otp),
        purpose=AuthTokenPurpose.email_verification,
        expires_at=datetime.now(UTC) + timedelta(minutes=OTP_EXPIRE_MINUTES),
    )
    db.add(auth_token)
    background_tasks.add_task(send_otp_email, user.email, otp)


async def signup(db: AsyncSession, payload: SignupRequest, background_tasks: BackgroundTasks) -> User:
    if await _get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    existing_student_id = await db.execute(select(User).where(User.student_id == payload.student_id))
    if existing_student_id.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this student ID already exists")

    existing_reg_no = await db.execute(
        select(User).where(User.registration_no == payload.registration_no)
    )
    if existing_reg_no.scalar_one_or_none() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this registration number already exists"
        )

    if await db.get(Hall, payload.hall_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid hall")
    if await db.get(Department, payload.department_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid department")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        student_id=payload.student_id,
        registration_no=payload.registration_no,
        hall_id=payload.hall_id,
        department_id=payload.department_id,
        session=payload.session,
        batch=compute_batch(payload.session),
    )
    db.add(user)
    await db.flush()

    await _create_otp(db, user, background_tasks)
    await db.commit()
    await db.refresh(user)
    return user


async def resend_otp(db: AsyncSession, email: str, background_tasks: BackgroundTasks) -> None:
    user = await _get_user_by_email(db, email)
    if user is None or user.is_verified:
        # Don't leak whether the account exists or is already verified.
        return

    result = await db.execute(
        select(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.email_verification,
            AuthToken.used_at.is_(None),
        )
        .order_by(AuthToken.created_at.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    if latest is not None:
        age = datetime.now(UTC) - latest.created_at
        if age < timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Please wait {OTP_RESEND_COOLDOWN_SECONDS - int(age.total_seconds())}s before requesting another code",
            )
        latest.used_at = datetime.now(UTC)  # invalidate the old code

    await _create_otp(db, user, background_tasks)
    await db.commit()


async def verify_email(db: AsyncSession, email: str, otp: str) -> User:
    user = await _get_user_by_email(db, email)
    invalid_error = HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired verification code")
    if user is None:
        raise invalid_error
    if user.is_verified:
        return user

    result = await db.execute(
        select(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.email_verification,
            AuthToken.used_at.is_(None),
        )
        .order_by(AuthToken.created_at.desc())
        .limit(1)
    )
    token = result.scalar_one_or_none()
    if token is None or token.expires_at < datetime.now(UTC) or token.attempts >= OTP_MAX_ATTEMPTS:
        raise invalid_error

    if hash_token(otp) != token.token_hash:
        token.attempts += 1
        await db.commit()
        raise invalid_error

    token.used_at = datetime.now(UTC)
    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, payload: LoginRequest) -> User:
    invalid_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    user = await _get_user_by_email(db, payload.email)
    if user is None or user.hashed_password is None:
        raise invalid_error
    if not verify_password(payload.password, user.hashed_password):
        raise invalid_error
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please verify your email before logging in")
    return user


async def issue_refresh_token(
    db: AsyncSession, user: User, user_agent: str | None, ip_address: str | None
) -> str:
    raw_token = generate_refresh_token()
    refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(refresh_token)
    await db.commit()
    return raw_token


async def rotate_refresh_token(
    db: AsyncSession, raw_token: str, user_agent: str | None, ip_address: str | None
) -> tuple[User, str]:
    invalid_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session, please log in again")
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
    token = result.scalar_one_or_none()
    if token is None:
        raise invalid_error

    if token.revoked_at is not None:
        # Reuse of a revoked token — possible theft. Revoke the whole family.
        await _revoke_token_family(db, token)
        await db.commit()
        raise invalid_error

    if token.expires_at < datetime.now(UTC):
        raise invalid_error

    user = await db.get(User, token.user_id)
    if user is None or not user.is_active:
        raise invalid_error

    token.revoked_at = datetime.now(UTC)
    new_raw_token = generate_refresh_token()
    new_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_raw_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(new_token)
    await db.flush()
    token.replaced_by_token_id = new_token.id
    await db.commit()
    return user, new_raw_token


async def _revoke_token_family(db: AsyncSession, token: RefreshToken) -> None:
    await revoke_all_user_tokens(db, token.user_id)


async def revoke_all_user_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Revokes every outstanding refresh token for a user — used on ban/deactivate
    so an admin action takes effect immediately instead of waiting for token expiry."""
    result = await db.execute(select(RefreshToken).where(RefreshToken.user_id == user_id))
    for t in result.scalars().all():
        if t.revoked_at is None:
            t.revoked_at = datetime.now(UTC)


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
    token = result.scalar_one_or_none()
    if token is not None and token.revoked_at is None:
        token.revoked_at = datetime.now(UTC)
        await db.commit()
