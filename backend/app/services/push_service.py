import asyncio
import base64
import json
import logging

import firebase_admin
from firebase_admin import credentials, messaging
from firebase_admin.exceptions import FirebaseError
from sqlalchemy import delete

from app.core.config import get_settings
from app.db.session import async_session_maker
from app.models.device_token import DeviceToken

logger = logging.getLogger("app.push")

_firebase_app: firebase_admin.App | None = None


def _get_app() -> firebase_admin.App | None:
    """Mirrors `email_service`'s dev-mode fallback: no configured credential
    means push is silently a no-op (logged, not sent) rather than a startup
    failure — a fresh deployment, or one without Firebase set up, never
    calls out to it until a real credential is provided.

    Two ways to provide one, checked in order: the base64 env var (what
    production actually uses — the image is rebuilt from a fresh git
    checkout on every deploy, so there's nowhere persistent to put a secret
    *file*), then the local-dev file path. Never both configured in the
    same environment, but the base64 form wins if they somehow are."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    settings = get_settings()
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64:
        info = json.loads(base64.b64decode(settings.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64))
        cred = credentials.Certificate(info)
    elif settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    else:
        return None

    _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app


async def _delete_stale_tokens(tokens: list[str]) -> None:
    async with async_session_maker() as db:
        await db.execute(delete(DeviceToken).where(DeviceToken.fcm_token.in_(tokens)))
        await db.commit()


def send_push_to_tokens(tokens: list[str], title: str, body: str, link_url: str | None) -> None:
    """Best-effort, fire-and-forget: a failed push means a device misses a
    notification, never a user-facing error. Kept a plain (non-async)
    function like `send_email` so Starlette's BackgroundTasks runs it in a
    thread pool instead of blocking the event loop on firebase-admin's
    blocking HTTP calls."""
    if not tokens:
        return
    app = _get_app()
    if app is None:
        logger.info("=== DEV PUSH (no Firebase configured) ===\n%s: %s -> %d device(s)", title, body, len(tokens))
        return

    stale_tokens: list[str] = []
    for token in tokens:
        message = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data={"link_url": link_url or ""},
        )
        try:
            messaging.send(message, app=app)
        except messaging.UnregisteredError:
            # The app was uninstalled or the token otherwise expired —
            # clean it up so future notifications don't keep retrying it.
            stale_tokens.append(token)
        except FirebaseError:
            logger.exception("Push send failed for a device token")

    if stale_tokens:
        asyncio.run(_delete_stale_tokens(stale_tokens))
