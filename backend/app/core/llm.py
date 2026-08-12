from openai import AsyncOpenAI

from app.core.config import get_settings


def get_openai_client() -> AsyncOpenAI:
    """A plain factory, not `lru_cache`d like `get_settings` — tests monkeypatch
    this function directly, and a cached instance would leak across tests."""
    settings = get_settings()
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
