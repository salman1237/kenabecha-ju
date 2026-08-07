import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler
from app.core.logging import setup_logging
from app.core.request_id import RequestIdMiddleware
from app.db.session import get_db
from app.tasks.expiry import sweeper
from app.websocket.manager import manager
from app.routers import (
    admin,
    admin_categories,
    navigation,
    auth,
    categories,
    page_sections,
    chat,
    dashboard,
    listings,
    notifications,
    public,
    ratings,
    reference,
    reports,
    shops,
    tags,
    users,
    ws,
)

setup_logging()
settings = get_settings()

Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # The heartbeat has to be started inside the running event loop, not at
    # import time — asyncio.create_task needs a loop to attach to. Same
    # reason the Redis pub/sub subscriber (manager.py's fan-out across the
    # backend's worker processes) starts here rather than at import time.
    manager.start_heartbeat()
    await manager.start_pubsub()
    sweeper.start()
    yield
    await manager.stop_heartbeat()
    await manager.stop_pubsub()
    await sweeper.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Marketplace API for Jahangirnagar University students to buy, sell, and run shops.",
    version="0.1.0",
    lifespan=lifespan,
)

# Outermost so the id is set before anything else logs, including CORS
# rejections and the error handler.
app.add_middleware(RequestIdMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")

# Emits the machine-readable `code` alongside `detail` so the frontend can
# translate errors instead of showing the API's English strings.
app.add_exception_handler(AppError, app_error_handler)

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(reference.router)
app.include_router(categories.router)
app.include_router(page_sections.public_router)
app.include_router(page_sections.admin_router)
app.include_router(shops.router)
app.include_router(tags.router)
app.include_router(listings.router)
app.include_router(chat.router)
app.include_router(ws.router)
app.include_router(ratings.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(admin_categories.router)
app.include_router(navigation.public_router)
app.include_router(navigation.admin_router)
app.include_router(notifications.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["meta"])
async def health(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Readiness, not liveness.

    A bare `{"status": "ok"}` is worse than useless as a container health
    check: the process answers while Postgres is unreachable, so Docker
    keeps the container "healthy" and a proxy keeps routing traffic to an
    instance that 500s on every real request. Touching the database is what
    makes the check mean something.
    """
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - surfaced as a 503, not swallowed
        logging.getLogger(__name__).warning("Health check failed: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable"
        ) from exc
    return {"status": "ok"}
