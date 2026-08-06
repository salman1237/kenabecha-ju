# KenaBecha JU

A marketplace web app for Jahangirnagar University students — buy and sell used items, run a small campus shop, chat with buyers/sellers in real time, and rate people you've dealt with. No payments on-platform: listings are arranged in-app, deals happen in person on campus.

Built incrementally, phase by phase; the full history of what was built and why is in [PLAN.md](PLAN.md).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind v4), shadcn/ui on Base UI, Framer Motion |
| Backend | FastAPI (Python 3.12), async SQLAlchemy, Alembic |
| Database | PostgreSQL 16 (`pg_trgm` for search) |
| Realtime | WebSockets (chat, typing indicators, read receipts, live notifications) |
| Auth | JWT access + rotating refresh tokens in httpOnly cookies, plus Google Identity Services (ID-token flow) |
| i18n | English + Bangla, cookie-driven locale, ~280 translated keys with compile-time key parity |
| Deploy | Docker Compose, GitHub Actions CI/CD → Dokploy on a self-hosted VPS |

## Features

- **Listings** — personal or shop-based, categories, tags, image galleries, pickup/delivery/both fulfillment, view counts, 30-day expiry with renewal, admin-curated "top" and time-boxed "featured" promotion.
- **Shops** — storefronts with a cover/logo, stats, reviews, followers; a seller dashboard to manage inventory.
- **Chat** — per-listing conversations, live delivery over WebSocket, typing indicators, read receipts, image attachments.
- **Ratings & reports** — buyers rate sellers/shops after a real conversation; anyone can report a listing, shop, or user into an admin queue.
- **Notifications** — in-app (live + persisted) and email, for messages, ratings, and moderation actions.
- **Bilingual** — every user-facing surface in English and Bangla, switchable per session, correct on first paint.
- **Admin panel** — roles (admin/moderator) with an audit log of every privileged action; a modular landing page (reorder/hide/edit/delete sections); category management; navbar & footer navigation management; a metrics dashboard; bulk moderation; a scheduled site-wide announcement banner.

## Project layout

```
backend/     FastAPI app — app/{models,schemas,routers,services}, alembic/, tests/
frontend/    Next.js app — app/, components/, lib/, context/, types/
docker-compose.yml        local dev (hot reload, bind mounts)
docker-compose.prod.yml   production target for Dokploy
DEPLOYMENT.md              VPS + Dokploy + CI/CD setup, in detail
PLAN.md                    phase-by-phase build log — what shipped, and why
```

## Local development

Requires Docker.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 — interactive API docs at `/docs`
- Postgres: exposed on the default port, data on a named volume (`db_data`)

Both env files work out of the box for local dev. Two things are optional and degrade gracefully if left blank:
- `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — without it, the "Continue with Google" button is hidden; email/password signup still works.
- `SMTP_*` (backend) — without an `SMTP_HOST`, outgoing email is logged to the console instead of sent.

The first admin account has to be granted directly — either `UPDATE users SET role = 'admin' WHERE email = '...'` against the dev database, or by listing the address in `ADMIN_EMAILS` before that account first signs in or signs in with Google.

## Testing

```bash
docker compose exec backend python -m pytest -q
```

231 tests, run against a real Postgres database (not SQLite — the schema leans on native enums, trigram indexes, and Postgres-specific constraint syntax that a SQLite stand-in would silently let through). Each test runs inside a savepoint that's rolled back afterward, so the suite doesn't need a reset step between runs.

```bash
docker compose exec frontend npx tsc --noEmit   # typecheck
docker compose exec frontend npx eslint .        # lint
```

## Deployment

Production runs on a self-hosted VPS behind [Dokploy](https://dokploy.com), with GitHub Actions gating every deploy on the test suite:

```
push to main → CI (migrations, drift check, 231 tests, typecheck, build) → Dokploy rebuild → health check
```

A failing check never reaches the server. `entrypoint.sh` runs `alembic upgrade head` before the app starts serving, so a deploy can never ship against an unmigrated schema. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full VPS setup — DNS, Dokploy configuration, environment variables, backups, and the CI/CD pipeline in detail.

## More detail

[PLAN.md](PLAN.md) is the project's build log: every phase, in order, with the reasoning behind non-obvious decisions and the bugs that were caught along the way. It's long, but it's the real history — worth a search (`Ctrl+F` a filename or feature name) before assuming something hasn't been considered.
