#!/bin/sh
# Bring the database schema up to date, then start the app.
#
# Nothing ran migrations on deploy before this. Shipping new code against an
# un-migrated database means every request touching a new column 500s, and
# the failure looks like an application bug rather than a missed step. Doing
# it here means a deploy cannot forget.
#
# `alembic upgrade head` is idempotent, so re-running it on every restart is
# safe. It is deliberately *not* backgrounded and the script uses `set -e`:
# if the migration fails the container must not start serving, because a
# half-migrated schema is worse than being briefly down.
set -e

echo "==> Running database migrations"
alembic upgrade head

echo "==> Starting application"
# exec so uvicorn becomes PID 1 and receives Docker's stop signals directly;
# without it, SIGTERM goes to this shell and containers die by timeout
# instead of shutting down cleanly.
exec "$@"
