import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Anyone reading this repo knows this value, so a deployment still using it
# has an effectively public signing key — tokens for any account could be
# forged. Refused outright outside development.
INSECURE_JWT_SECRET = "change-me-in-env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENV: str = "development"
    PROJECT_NAME: str = "KenaBecha JU"

    DATABASE_URL: str = "postgresql+asyncpg://kenabecha:kenabecha@db:5432/kenabecha"

    JWT_SECRET_KEY: str = INSECURE_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    FRONTEND_URL: str = "http://localhost:3000"

    MEDIA_ROOT: str = "/app/media"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@kenabecha.ju"

    GOOGLE_CLIENT_ID: str = ""


@lru_cache
def get_settings() -> Settings:
    settings = Settings()

    if settings.JWT_SECRET_KEY == INSECURE_JWT_SECRET:
        if settings.ENV == "development":
            # Don't block local work, but make it impossible to miss.
            logger.warning(
                "JWT_SECRET_KEY is still the placeholder value. This is only "
                "tolerated because ENV=development — set a real secret before deploying."
            )
        else:
            raise RuntimeError(
                "JWT_SECRET_KEY is still set to the placeholder value "
                f"'{INSECURE_JWT_SECRET}'. Anyone with the source could forge "
                "tokens for any account. Set a strong random JWT_SECRET_KEY "
                "(e.g. `openssl rand -hex 32`) before starting outside development."
            )

    return settings
