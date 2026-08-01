import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from enum import Enum

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def hash_token(raw_token: str) -> str:
    """For high-entropy random tokens (refresh tokens): fast, deterministic hash for exact-match lookup."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


class TokenType(str, Enum):
    access = "access"
    refresh = "refresh"


def create_access_token(user_id: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "type": TokenType.access.value, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != TokenType.access.value:
        return None
    return payload.get("sub")
