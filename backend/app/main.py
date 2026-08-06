from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.errors import AppError, app_error_handler
from app.tasks.expiry import sweeper
from app.websocket.manager import manager
from app.routers import (
    admin,
    auth,
    categories,
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
    # import time — asyncio.create_task needs a loop to attach to.
    manager.start_heartbeat()
    sweeper.start()
    yield
    await manager.stop_heartbeat()
    await sweeper.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Marketplace API for Jahangirnagar University students to buy, sell, and run shops.",
    version="0.1.0",
    lifespan=lifespan,
)

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
app.include_router(shops.router)
app.include_router(tags.router)
app.include_router(listings.router)
app.include_router(chat.router)
app.include_router(ws.router)
app.include_router(ratings.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
