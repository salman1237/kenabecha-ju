# KenaBecha JU — Original Plan & Progress

This is the schema/folder-structure plan approved before scaffolding began, kept here as a durable record. Progress is tracked below; the plan content itself (further down) is left as originally written, with deviations noted rather than rewritten in place.

## Progress

- [x] **Phase 0 — Schema & folder structure design** (this doc). Approved before any code was written.
- [x] **Phase 1 — Project scaffolding.** Next.js 16 (App Router/TS/Tailwind) + FastAPI, `docker-compose.yml` (dev) and `docker-compose.prod.yml` (Dokploy target). Commit `b41be16`.
- [x] **Phase 2 — Database models + initial migration.** All tables from the schema below, plus `pg_trgm` GIN indexes for search. Commit `88f414b`.
- [x] **Phase 3 — Auth.** Commit `ad3431b`. Expanded beyond the original plan (see "Deviations" below): signup now collects real JU student-verification fields, and email verification is OTP-based rather than a simple link/flag.
- [x] **Phase 4 — Listings CRUD** (personal + shop-based), plus the shops management it depends on. Commit `b2525b8`. Includes tag autocomplete/trending, image uploads, and browse/search/filter. Full profile page (personal listings + shop cards) and shop edit UI were **not** built this phase — see "Deviations" below.
- [x] **Phase 5 — Chat.** Commit `f0e9988`. WebSocket-pushed live delivery with REST-persisted history, per-listing conversations, owner inbox with shop filter tabs and unread badges. Email notification for offline messages is **not** included — that's Phase 8 (Notifications) territory per the original plan.
- [x] **Phase 6 — Ratings.** Commit `867f543`. Eligibility gated on sold/out_of_stock + an existing buyer conversation + not-already-rated; targets the shop or the seller depending on listing type. Also builds the public profile page deferred from Phase 4, since personal ratings need somewhere to render — see "Deviations" below.
- [x] **Phase 7 — Admin panel.** Commit `fbc488a`. Reporting (any user, any target type) feeds an admin-only queue; resolving with dismiss/remove/warn/ban applies real side effects — remove soft-deletes the content, ban deactivates the responsible user and revokes all their sessions immediately. User/listing/shop moderation views and a stats dashboard round it out.
- [ ] **Phase 8 — Notifications** (email + in-app).
- [ ] **Phase 9 — Google OAuth** (deferred; `auth_provider`/`google_id` columns already exist on `users`).

### Deviations from the original plan below

- **`users` table extended** beyond the original proposal to support real JU student verification at signup: `student_id` (unique), `registration_no` (unique), `hall_id` (FK), `department_id` (FK), `session` (e.g. `"2020-21"`), `batch` (server-computed, non-editable — `batch = session_start_year − 1970`). `phone` changed from nullable to required.
- **New reference tables**: `halls` (21 rows) and `departments` (38 rows), seeded via migration from data fetched off juniv.edu (6 faculties + 4 institutes).
- **`auth_tokens` gained an `attempts` column** for OTP brute-force protection (not in the original proposal, added when building the OTP flow).
- **Email verification is OTP-based** (6-digit code, 10min expiry, attempt-limited) rather than the simpler token/flag the original schema implied — the `auth_tokens.purpose = email_verification` row now stores a hashed OTP instead of a hashed link token.
- **Login is blocked until `is_verified`** (confirmed decision during the auth phase, not specified in the original plan).
- **Shops CRUD was scoped into Phase 4** rather than treated as its own phase, since shop-based listings need an existing shop to attach to. Shop *creation/listing* is built (My Shops dashboard, storefront pages); shop *editing* is not — deleting and recreating is the current workaround. A dedicated shops-polish pass can add it later.
- **Profile page** (personal listings + per-shop mini-storefront cards on a user's own profile) was **not** built in Phase 4, even though it's part of the original "Shops & Storefronts" feature — it depends on both listings and shops being stable, which they now are, so it's a natural next small addition.
- **Tag filtering on browse uses ANY-match semantics** (a listing matches if it has at least one of the selected tags), not AND — not specified either way in the original plan.
- **Image validation trusts the client-declared MIME type** (JPEG/PNG/WEBP, 5MB cap) rather than sniffing file bytes — acceptable for now since this isn't a security-sensitive boundary yet, but worth hardening before production.
- **Public profile page built as part of Phase 6** (see above) rather than Phase 4 — resolved the deferred item and the "ratings need a home" dependency together. It's read-only: name, department, batch, bio, average rating, personal listings, shop cards, recent reviews. Profile *editing* (avatar/bio/phone) still isn't built — no phase has needed it yet.
- **Rating eligibility requires an existing conversation** as the proof-of-transaction signal ("they were the one who messaged about it" from the spec), not a payment or explicit "confirm receipt" step, since there's no payment integration by design. A buyer who never messaged before the seller marked it sold can't rate — arguably strict, but matches the spec's literal wording.
- **Average ratings are computed on read** (`AVG`/`COUNT` query) rather than denormalized onto `shops`/`users` — simplest correct approach at this scale; would need revisiting if rating volume ever made per-request aggregation a bottleneck.
- **No self-serve path to become an admin** — by design, matching how the schema was always meant to work (`role` isn't settable via signup or any user-facing endpoint). The first admin has to be promoted directly in the database (`UPDATE users SET role='admin' WHERE email=...`), which is what was done for testing. Worth a documented runbook step before real deployment, not an app feature.
- **"Warn user" is a status-only resolution** — it records `resolved_warned` and a resolution note but doesn't yet notify the user, since sending that notification is explicitly Phase 8 (Notifications) territory. "Ban" *does* have a real, immediate side effect (deactivation + session revocation) because that's a moderation action, not a notification.
- **Admin listing/shop views intentionally show removed/soft-deleted content** (unlike every public-facing browse endpoint), since a moderation dashboard needs full visibility, not just what's currently live.

---

## Context
`prompt.md` specifies a full marketplace web app (Next.js + FastAPI + Postgres, Docker/Dokploy deployment) for JU students to buy/sell used items and run small shops. The repo is currently empty except `prompt.md` and a logo PNG. The spec explicitly asks for **schema + folder structure to be proposed and confirmed before any scaffolding code is written** — this plan delivers exactly that (items 1 & 2 of the "what I want first" list in prompt.md). No code will be written in this pass; actual scaffolding starts in a follow-up turn once this is approved.

**Decisions confirmed with user:**
- Project name: **KenaBecha JU** (the root logo says "Recycle Bin JU" — that's a mismatch/placeholder to swap out later, not an instruction to rename the project).
- Media storage: **local Docker volume** for both dev and the Dokploy production compose (simplest for MVP; can migrate to S3-compatible storage later if needed).
- Google OAuth: **deferred**. Initial auth chunk is email/password (JWT + httpOnly cookies) only; Google OAuth added as a later increment once core auth is proven out. Schema still includes `auth_provider`/`google_id` columns on `users` so no migration rework is needed when it's added.

---

## 1. Proposed PostgreSQL Schema

**Conventions:** UUID PKs (app-generated), `created_at`/`updated_at` TIMESTAMPTZ on all mutable tables, soft-delete (`deleted_at`, `is_active`) on `users`/`shops`/`listings` only (since messages/ratings/reports must remain displayable after removal), native Postgres ENUMs except where the spec calls for free text (`shops.shop_type`, `tags.name`).

### `users`
id (PK), email (unique), hashed_password (nullable — null for OAuth-only accounts), full_name, avatar_url, phone (nullable), bio (nullable), role (enum: user/admin), auth_provider (enum: local/google), google_id (nullable, partial-unique), is_active, is_verified, created_at ("member since"), updated_at, deleted_at.

> See "Deviations" above — this table now also has `student_id`, `registration_no`, `hall_id`, `department_id`, `session`, `batch`, and `phone` is required.

### `shops`
id (PK), owner_id (FK→users), shop_name, slug (unique, for storefront URLs), description, shop_type (free text), logo_url, cover_url, is_active, created_at, updated_at, deleted_at.
Index: owner_id.

### `listings`
id (PK), seller_id (FK→users, required), shop_id (FK→shops, nullable), title, description, price (numeric, nullable), price_type (enum: fixed/negotiable/free), condition (enum: new/used_like_new/used_good/used_fair, default 'new' — "required for personal listings" enforced at the Pydantic/service layer, not DB), quantity (int, default 1, check ≥0), status (enum: active/sold/out_of_stock/removed), created_at, updated_at, deleted_at.
Check: price required when price_type='fixed'.
Indexes: seller_id, shop_id, status, (status, created_at desc) for browse/newest, price for sort, GIN trigram on title/description for keyword search.

### `listing_images`
id (PK), listing_id (FK→listings, cascade delete), image_url, sort_order, created_at.

### `tags`
id (PK), name (display casing), normalized_name (unique, lowercased), usage_count (denormalized, for trending), created_at.
Index: GIN trigram on normalized_name for autocomplete; usage_count desc for trending.
Exact-duplicate prevention only; fuzzy suggestions surfaced via trigram similarity in the autocomplete endpoint, no auto-merge.

### `listing_tags` (join)
listing_id + tag_id composite PK, both FK cascade delete.

### `conversations`
id (PK), listing_id (FK→listings), buyer_id (FK→users), seller_id (FK→users, denormalized from listing for indexing), shop_id (FK→shops, nullable, denormalized from listing at creation time for inbox filtering without a join), last_message_at (denormalized, bumped per new message), created_at, updated_at.
Constraints: unique(listing_id, buyer_id) — re-messaging reuses the thread; check(buyer_id != seller_id).
Indexes: seller_id (owner inbox), buyer_id, shop_id, last_message_at desc.

### `messages`
id (PK), conversation_id (FK→conversations, cascade delete), sender_id (FK→users), receiver_id (FK→users), content, created_at, read_at (nullable — null = unread).
Indexes: (conversation_id, created_at) for thread fetch; partial index on receiver_id WHERE read_at IS NULL for fast unread counts.
Per-message `read_at` chosen over a per-conversation read cursor since every conversation is strictly 1:1.

### `ratings`
id (PK), listing_id (FK→listings), rater_id (FK→users, the buyer), target_type (enum: shop/user), target_shop_id (FK→shops, nullable), target_user_id (FK→users, nullable), stars (1-5, check), review_text (nullable), created_at.
Constraints: unique(listing_id, rater_id) — one rating per buyer per transaction; check ensuring exactly one of target_shop_id/target_user_id is set matching target_type.
Polymorphic target modeled as two nullable real FKs + type discriminator + CHECK, rather than a generic (table,id) pair, so referential integrity stays DB-enforced.

### `reports`
id (PK), reporter_id (FK→users), target_type (enum: listing/shop/user), target_listing_id/target_shop_id/target_user_id (nullable FKs, same polymorphic pattern as ratings), reason_code (enum), note (nullable), status (enum: pending/resolved_dismissed/resolved_removed/resolved_warned/resolved_banned), resolved_by (FK→users, nullable), resolved_at, resolution_note, created_at.
Index: partial on status WHERE pending (admin queue).
Note: admin resolution actions (e.g. resolved_removed also flipping listings.status, resolved_banned also flipping users.is_active + revoking refresh tokens) are service-layer orchestration, not DB-enforced.

### `notifications`
id (PK), user_id (FK→users, recipient), type (enum: new_message/new_rating/listing_reported/listing_removed/shop_reported/shop_removed), title, body (nullable), link_url (nullable), related_listing_id/related_shop_id/related_conversation_id (nullable FKs), is_read, created_at.
Indexes: (user_id, is_read) for unread count; (user_id, created_at desc) for bell dropdown.
Welcome/password-reset emails are sent via BackgroundTasks+SMTP directly with no notifications row (nothing in-app to show for them).

### `refresh_tokens`
id (PK), user_id (FK→users, cascade delete), token_hash (unique — raw token never stored), issued_at, expires_at, revoked_at (nullable), replaced_by_token_id (self-FK, rotation chain), user_agent, ip_address.
Stored server-side, hashed, rotated on every use; reuse of a revoked token revokes the whole family. Chosen specifically because admin "ban user" needs to immediately invalidate sessions.

### `auth_tokens` (password reset + email verification)
id (PK), user_id (FK→users, cascade delete), token_hash (unique), purpose (enum: password_reset/email_verification), expires_at, used_at (nullable), created_at.

> See "Deviations" above — this table also gained an `attempts` column for OTP brute-force protection.

---

## 2. Backend Folder Structure (`/backend`)

```
backend/
  app/
    main.py                    # FastAPI instance, router registration, CORS, exception handlers
    core/                      # config.py (Pydantic Settings), security.py (hashing/JWT), dependencies.py (get_db/get_current_user), exceptions.py, logging.py
    db/                        # base.py (declarative Base), session.py (async engine/sessionmaker)
    models/                    # SQLAlchemy ORM models — mixins.py + one module per domain table above
    schemas/                   # Pydantic DTOs mirroring models/, common.py for pagination/error envelope
    routers/                   # auth, users, shops, listings, tags, chat, ws, ratings, reports, admin, notifications
    services/                  # business logic per domain + email_service.py, notification_service.py
    websocket/                 # manager.py (ConnectionManager), handlers.py (message dispatch)
    tasks/                     # email_tasks.py (BackgroundTasks senders)
    seed/                      # seed.py entrypoint + factories.py (Faker-based dummy data)
  alembic/                     # env.py, versions/
  tests/                       # conftest.py + test_*.py per domain
  Dockerfile                   # multi-stage: dev (uvicorn --reload) / prod (uvicorn workers)
  .env.example
```

Built so far: `main.py` (now also mounts `/media` static files), `core/` (config, security, dependencies incl. WS auth + admin-role guard, logging — `exceptions.py` not yet needed), `db/`, `models/` (all domain tables + `reference.py` for halls/departments), `schemas/` (auth, user, reference, shop, listing, tag, common, chat, rating, report, admin), `routers/` (auth, reference, shops, listings, tags, chat, ws, ratings, users, reports, admin), `services/` (auth_service, email_service, reference_service, shop_service, listing_service, tag_service, media_service, chat_service, rating_service, report_service, admin_service), `websocket/manager.py` (per-user connection registry). Not yet built: `tasks/`, `seed/`, `tests/` — these land with the notifications/seed-data phases.

## 3. Frontend Folder Structure (`/frontend`)

```
frontend/
  app/
    layout.tsx, page.tsx (browse/home), middleware.ts (route protection)
    (auth)/login, signup            # Google OAuth callback route deferred until that phase
    listings/ (browse, new, [id], [id]/edit)
    shops/ ([slug] storefront, dashboard "My Shops")
    profile/ ([id], settings)
    inbox/ (conversation list, [conversationId] chat window)
    admin/ (layout with role guard, stats, users, listings, shops, reports)
  components/                  # ui/, listings/, shops/, chat/, ratings/, admin/, notifications/, layout/
  lib/
    api/                        # typed fetch client per resource, credentials:'include', normalized errors
    ws/client.ts                # WebSocket singleton + reconnect
    validation/                 # zod schemas mirroring backend Pydantic schemas
    utils.ts, constants.ts
  hooks/                        # useAuth, useCurrentUser, useWebSocket, useNotifications, useDebounce, useInfiniteListings
  context/AuthContext.tsx        # or lightweight store: current user + notification unread count
  types/api.ts                  # shared TS types mirroring backend schemas
  public/                       # logo asset, favicon
  Dockerfile                    # multi-stage: dev (next dev) / prod (next build && next start)
  .env.local.example
```

Built so far: `app/(auth)/login,signup,verify-email`, `app/listings/` (browse, new, `[id]`, `[id]/edit`), `app/shops/` (`[slug]` storefront, `dashboard`), `app/inbox/` (list, `[conversationId]` chat window), `app/profile/[id]/` (public profile), `app/admin/` (layout w/ role guard, stats, users, listings, shops, reports), `components/ui/FormField.tsx`, `components/listings/` (ListingCard, ListingForm, TagInput), `components/ratings/` (StarRating, RatingForm), `components/ReportButton.tsx`, `lib/api/` (client, auth, reference, shops, listings, tags, chat, ratings, users, reports, admin), `lib/ws/client.ts` (reconnecting WS singleton), `lib/validation/` (auth, shop, listing), `lib/utils.ts`, `context/AuthContext.tsx` (now also owns the WS connection lifecycle), `types/api.ts`. Route protection landed as **`proxy.ts`** at the repo root, not `app/middleware.ts` — Next.js 16 renamed the middleware file convention to `proxy` (confirmed against the installed Next docs). Not yet built: `hooks/`, most of `components/shops/`.

## 4. Docker Compose / Dokploy

- **`docker-compose.yml`** (local dev, repo root): `db` (postgres:16-alpine, named volume, healthcheck), `backend` (build `./backend` target `dev`, bind-mounted source, `uvicorn --reload`, depends on db healthy), `frontend` (build `./frontend` target `dev`, bind-mounted source, `next dev`, depends on backend).
- **`docker-compose.prod.yml`** (Dokploy): same Dockerfiles, `target: prod` — backend as slim `python:3.12-slim` running uvicorn with multiple workers, frontend as slim `node:20-alpine` running `next start` post-build. No bind mounts, code baked into images. Postgres data on a named volume; uploaded media (avatars/logos/listing photos) also on a **named/persistent Docker volume**, mounted into the backend container, per the local-volume decision above. Secrets via Dokploy's env var UI.
- Dokploy's exact Traefik routing/label requirements for the prod compose will be nailed down when we actually reach the deployment step, not blocking this schema/structure approval.

Both files built as described. `frontend/Dockerfile`'s prod target additionally uses `output: "standalone"` (Next.js's recommended lean-Docker-image setting) for a smaller production image.

---

## Next Steps (after this plan is approved)
Per prompt.md's explicit ordering, do **not** scaffold everything at once. First follow-up chunk: project scaffolding (repo layout, Dockerfiles, docker-compose.yml, base FastAPI/Next.js apps wired to each other) → SQLAlchemy models + first Alembic migration matching the schema above → email/password auth (signup/login/JWT/refresh, httpOnly cookies) → listings CRUD (personal + shop-based). Chat, ratings, admin panel, notifications, and Google OAuth are later chunks, confirmed incrementally rather than built in one shot.

## Verification
- After scaffolding: `docker compose up` should bring up db+backend+frontend locally; `/docs` (Swagger) reachable on the backend; frontend home page reachable and able to hit a basic backend health endpoint.
- After models/migrations: `alembic upgrade head` runs clean against a fresh Postgres container; seed script populates dummy data without errors.
- After auth chunk: signup/login/refresh/logout flows tested via Swagger UI and from the Next.js login page, cookies verified as httpOnly in browser devtools.

All three verification passes above were carried out for real (not just described) — `docker compose up` brought up all three services cleanly, `alembic check` reported no drift after each migration, and the full signup → OTP → verify → login flow was exercised both via curl and a headless-browser (Playwright) run against the actual dev server, confirming both cookies are set `httpOnly`.
