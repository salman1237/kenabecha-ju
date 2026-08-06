"""The health endpoint backs the container health check, so both of its
outcomes matter: a bare 200 would let Docker call a database-less container
healthy and a proxy keep routing traffic to it."""

import pytest
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app


async def test_health_reports_ok_when_the_database_answers(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_health_reports_503_when_the_database_is_unreachable(client):
    """Simulates Postgres being down by making the session raise."""

    class BrokenSession:
        async def execute(self, *_args, **_kwargs):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    async def _broken():
        yield BrokenSession()

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _broken
    try:
        res = await client.get("/health")
        assert res.status_code == 503
    finally:
        if previous is not None:
            app.dependency_overrides[get_db] = previous
        else:
            app.dependency_overrides.pop(get_db, None)
