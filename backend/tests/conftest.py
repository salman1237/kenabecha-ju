"""Shared test fixtures.

Two decisions shape everything here:

1. **Tests run against a real Postgres**, not SQLite. The schema depends on
   Postgres-specific features — native enums, `pg_trgm` indexes, `ON CONFLICT
   ON CONSTRAINT`, `ILIKE ... ESCAPE` — so a SQLite stand-in would pass tests
   the production database would fail. A throwaway `kenabecha_test` database
   is created and migrated once per session.

2. **Isolation is per-test via savepoints**, not by truncating tables. The
   service layer calls `db.commit()` constantly, which would end a plain
   outer transaction and leak state into the next test. Binding the session
   with `join_transaction_mode="create_savepoint"` turns those commits into
   savepoint releases, so a single rollback at the end of each test undoes
   everything — including rate-limit counters and seeded users.
"""

import asyncio
import os
import uuid

# The env var has to be set before anything imports `app`, because
# get_settings() is lru_cached: the first call wins for the whole process.
_DEFAULT_DB = "postgresql+asyncpg://kenabecha:kenabecha@db:5432/kenabecha"
_ADMIN_URL = os.environ.get("DATABASE_URL", _DEFAULT_DB)
TEST_DB_NAME = "kenabecha_test"
TEST_DB_URL = f"{_ADMIN_URL.rsplit('/', 1)[0]}/{TEST_DB_NAME}"

os.environ["DATABASE_URL"] = TEST_DB_URL
# A real (if throwaway) secret, so the tests exercise the same code path as
# production rather than the development-only placeholder allowance.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-used-anywhere-else-0123456789")
# Forced, not setdefault: with setdefault the suite inherits whatever ENV the
# surrounding container happens to have. Locally that was "development", which
# makes auth cookies non-Secure; CI set "test", which makes them Secure, and
# every logged-in test then failed with 401 because httpx will not send a
# Secure cookie over http. Pinning it means the suite behaves the same
# everywhere.
os.environ["ENV"] = "test"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402

from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.listing import Listing, ListingStatus  # noqa: E402
from app.models.user import User  # noqa: E402
from app.core.security import hash_password  # noqa: E402


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
async def _database() -> None:
    """Drop, recreate and migrate the test database once per session."""
    admin = create_async_engine(_ADMIN_URL, isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        # Terminate stragglers first: DROP DATABASE fails while any session
        # is still connected, which is easy to hit after an aborted run.
        await conn.execute(
            text(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = :name AND pid <> pg_backend_pid()"
            ),
            {"name": TEST_DB_NAME},
        )
        await conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"'))
        await conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    await admin.dispose()

    # Migrations rather than metadata.create_all: they're what actually ships,
    # and they carry the seed data (halls, departments, categories) the API
    # requires for signup and for category filtering.
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
    # env.py drives the async engine with asyncio.run(), which refuses to
    # nest inside this fixture's already-running loop. A worker thread gets
    # its own loop, so the migration runs unmodified.
    await asyncio.to_thread(command.upgrade, cfg, "head")

    yield

    from app.db.session import engine

    await engine.dispose()


@pytest.fixture
async def db() -> AsyncSession:
    """A session whose work is discarded when the test ends."""
    from app.db.session import engine

    conn = await engine.connect()
    trans = await conn.begin()
    session = AsyncSession(
        bind=conn,
        join_transaction_mode="create_savepoint",
        # Must match app.db.session's sessionmaker. With the default
        # expire_on_commit=True, every service commit expires the ORM objects
        # and response serialisation then triggers a lazy load outside the
        # async context — MissingGreenlet. The app doesn't behave that way, so
        # a fixture that did would be testing a different application.
        expire_on_commit=False,
    )
    try:
        yield session
    finally:
        await session.close()
        await trans.rollback()
        await conn.close()


@pytest.fixture
async def client(db: AsyncSession) -> AsyncClient:
    """API client sharing the test's session, so requests and assertions see
    the same uncommitted state and are rolled back together."""

    async def _override() -> AsyncSession:
        yield db

    app.dependency_overrides[get_db] = _override
    # ASGITransport talks to the app in-process and does not run the lifespan,
    # which keeps the WebSocket heartbeat and the expiry sweeper out of tests.
    transport = ASGITransport(app=app)
    # https, not http: outside development the app marks its auth cookies
    # Secure, and a client on a plain-http base URL silently drops them. There
    # is no real TLS here — ASGITransport never opens a socket — but the URL
    # scheme is what decides whether the cookie jar sends them back, so this
    # exercises the same cookie flags production uses.
    async with AsyncClient(transport=transport, base_url="https://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# --- data helpers -----------------------------------------------------------

TEST_PASSWORD = "TestPass123!"


async def make_user(
    db: AsyncSession,
    *,
    email: str | None = None,
    is_verified: bool = True,
    is_active: bool = True,
    role: str = "user",
) -> User:
    """A verified, sellable-from account by default. Values that must be
    unique are suffixed so callers can create several without collisions.

    `profile_complete` is deliberately not a parameter: it's a derived
    property on the model, computed from the JU fields set below, so setting
    it directly would let a test assert a state the app can never produce."""
    suffix = uuid.uuid4().hex[:8]
    reference = await db.execute(text("SELECT id FROM halls LIMIT 1"))
    hall_id = reference.scalar_one()
    reference = await db.execute(text("SELECT id FROM departments LIMIT 1"))
    department_id = reference.scalar_one()

    user = User(
        email=email or f"student-{suffix}@juniv.edu",
        hashed_password=hash_password(TEST_PASSWORD),
        full_name=f"Test Student {suffix}",
        phone=f"01{7000000 + int(suffix[:6], 16) % 1000000:08d}"[:11],
        student_id=f"sid-{suffix}",
        registration_no=f"reg-{suffix}",
        hall_id=hall_id,
        department_id=department_id,
        session="2020-21",
        # profile_complete requires batch too; without it get_seller rejects
        # every listing attempt with a 403 and the tests never reach the code
        # they mean to exercise.
        batch=50,
        is_verified=is_verified,
        is_active=is_active,
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


async def make_listing(
    db: AsyncSession,
    seller: User,
    *,
    title: str = "Test listing",
    price: str | None = "500",
    status: ListingStatus = ListingStatus.active,
    **kwargs,
) -> Listing:
    listing = Listing(
        # Assigning the collections marks them loaded. Left untouched they
        # stay deferred, and serialising the listing later triggers a lazy
        # load outside the async context (MissingGreenlet).
        images=[],
        tags=[],
        seller_id=seller.id,
        title=title,
        description="A description long enough to be realistic.",
        price=price,
        status=status,
        pickup_address="Room 1, Al Beruni Hall",
        **kwargs,
    )
    db.add(listing)
    await db.flush()
    return listing


async def login(client: AsyncClient, user: User) -> None:
    """Authenticate the client. Auth is cookie-based, so the AsyncClient's
    own cookie jar carries the session for subsequent requests."""
    res = await client.post(
        "/auth/login", json={"email": user.email, "password": TEST_PASSWORD}
    )
    assert res.status_code == 200, res.text
