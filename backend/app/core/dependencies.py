import uuid

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


async def get_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
    )
    if access_token is None:
        raise credentials_error

    user_id = decode_access_token(access_token)
    if user_id is None:
        raise credentials_error

    user = await db.get(User, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise credentials_error
    return user


async def get_optional_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """For public endpoints that personalise when a viewer happens to be
    logged in (e.g. "are you following this shop?") but must still serve
    anonymous callers. Never raises — an invalid token is just `None`."""
    if access_token is None:
        return None

    user_id = decode_access_token(access_token)
    if user_id is None:
        return None

    user = await db.get(User, uuid.UUID(user_id))
    return user if user is not None and user.is_active else None


async def get_seller(user: User = Depends(get_current_user)) -> User:
    """Gate for actions that require the full JU-verification profile — opening a
    shop or listing an item. Google-lite buyers hit this until they complete it."""
    if not user.profile_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete your JU profile before opening a shop or listing an item",
        )
    return user


async def get_current_staff(user: User = Depends(get_current_user)) -> User:
    """Moderation surface: reports, removing listings and shops.

    Admins and moderators both pass. Separate from get_current_admin so a
    moderator can act on a reported listing without also being able to grant
    themselves permissions or rewrite the site.
    """
    if not user.role.is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Moderator access required"
        )
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Administration: user management, role changes, site content.

    Admin only — deliberately narrower than get_current_staff.
    """
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def get_current_user_ws(
    access_token: str | None,
    db: AsyncSession,
) -> User | None:
    """Same as get_current_user but returns None instead of raising, since WebSocket
    endpoints close the connection with a code rather than returning an HTTP error."""
    if access_token is None:
        return None
    user_id = decode_access_token(access_token)
    if user_id is None:
        return None
    user = await db.get(User, uuid.UUID(user_id))
    if user is None or not user.is_active:
        return None
    return user
