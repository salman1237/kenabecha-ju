# Backend tests

```bash
docker compose exec backend python -m pytest          # everything
docker compose exec backend python -m pytest -q       # quiet
docker compose exec backend python -m pytest tests/test_listings.py -k expiry
```

## How it works

Tests run against a **throwaway `kenabecha_test` database**, dropped and
recreated on each session and brought up with `alembic upgrade head`. Real
Postgres, not SQLite: the schema depends on native enums, `pg_trgm` indexes,
`ON CONFLICT ON CONSTRAINT` and `ILIKE ... ESCAPE`, so a SQLite stand-in
would pass things production would fail. Running the migrations rather than
`metadata.create_all()` also means the tests exercise the schema that ships,
and get the seed data (halls, departments, categories) the API needs.

Each test gets a session bound with `join_transaction_mode="create_savepoint"`.
The service layer commits constantly, which would end a plain outer
transaction and leak state into the next test; as savepoints, one rollback at
the end undoes everything — including rate-limit counters.

The `client` fixture shares that same session, so requests and assertions see
the same uncommitted state.

## Adding tests

`conftest.py` provides `make_user`, `make_listing` and `login`. Note that
`profile_complete` is a derived property, not a settable column — it comes
from the JU fields `make_user` fills in.

## Keeping them honest

A passing suite proves nothing on its own. When you fix a bug, first
reintroduce it and confirm the new test goes red. The current tests were
checked this way: reverting the suggestion status filter, the category
validation and the seller view-count exclusion each turned exactly the
corresponding test red, and nothing else.
