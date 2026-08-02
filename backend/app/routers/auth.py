from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    CompleteProfileRequest,
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
    SignupRequest,
    UpdateWhatsAppRequest,
    VerifyOtpRequest,
)
from app.schemas.user import UserPublic
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

REFRESH_COOKIE_PATH = "/auth"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = settings.ENV != "development"
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        REFRESH_TOKEN_COOKIE,
        refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path=REFRESH_COOKIE_PATH)


@router.post("/signup", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> User:
    return await auth_service.signup(db, payload, background_tasks)


@router.post("/verify-email", response_model=UserPublic)
async def verify_email(
    payload: VerifyOtpRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
) -> User:
    return await auth_service.verify_email(db, payload.email, payload.otp, background_tasks)


@router.post("/resend-otp", status_code=status.HTTP_204_NO_CONTENT)
async def resend_otp(
    payload: ResendOtpRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> None:
    await auth_service.resend_otp(db, payload.email, background_tasks)


@router.post("/login", response_model=UserPublic)
async def login(
    payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> User:
    user = await auth_service.authenticate(db, payload)
    access_token = create_access_token(str(user.id))
    refresh_token = await auth_service.issue_refresh_token(
        db, user, request.headers.get("user-agent"), request.client.host if request.client else None
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return user


@router.post("/google", response_model=UserPublic)
async def google_login(
    payload: GoogleLoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> User:
    user = await auth_service.google_login(db, payload.credential)
    access_token = create_access_token(str(user.id))
    refresh_token = await auth_service.issue_refresh_token(
        db, user, request.headers.get("user-agent"), request.client.host if request.client else None
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return user


@router.patch("/complete-profile", response_model=UserPublic)
async def complete_profile(
    payload: CompleteProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await auth_service.complete_profile(db, user, payload)


@router.post("/refresh", response_model=UserPublic)
async def refresh(
    request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> User:
    raw_refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if raw_refresh_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    user, new_refresh_token = await auth_service.rotate_refresh_token(
        db, raw_refresh_token, request.headers.get("user-agent"), request.client.host if request.client else None
    )
    access_token = create_access_token(str(user.id))
    _set_auth_cookies(response, access_token, new_refresh_token)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> None:
    raw_refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if raw_refresh_token is not None:
        await auth_service.revoke_refresh_token(db, raw_refresh_token)
    _clear_auth_cookies(response)


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/whatsapp", response_model=UserPublic)
async def update_whatsapp(
    payload: UpdateWhatsAppRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await auth_service.update_whatsapp_number(db, user, payload.whatsapp_number)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> None:
    await auth_service.request_password_reset(db, payload.email, background_tasks)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> None:
    await auth_service.reset_password(db, payload.token, payload.new_password)
