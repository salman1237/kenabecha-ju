# KenaBecha JU — Full Project Audit Report

> **Audited by:** Claude (senior full-stack engineer pass)
> **Date:** 2026-08-07
> **Scope:** Full-stack — Backend (FastAPI/Python), Frontend (Next.js 16/TypeScript), DevOps (Docker/Dokploy/CI), live production
> **Method:** Every finding below was checked against the actual repository (`git log`/`git ls-files`, direct file reads, running the live containers, hitting the live production URLs) and, where a fix already exists in the code, against the installed library's own source — not against training-data assumptions about what a marketplace app typically lacks.

---

## 0. On the previous version of this report

An earlier pass of this document (attributed to "Antigravity") is superseded by this one. It is being replaced rather than amended because roughly half of its findings did not survive verification:

- Both of its two "critical" findings — `.env.local` and `.env.prod` committed to git — are **false**. Neither file has ever been tracked (`git log --all --full-history` on both returns nothing); both are correctly listed in `.gitignore`.
- Seven of its "missing feature" findings — segmented OTP input, password visibility toggle, a navbar search bar, a price range slider, `prefers-reduced-motion` handling, a CI/CD pipeline, and `robots.ts` blocking authenticated routes — are **false**. All seven already exist in the code and were built in earlier phases (see `PLAN.md`, Phases 15–34).
- Two more (`BUG-05`, `BUG-06`) are false for a more specific reason: the crash scenario `BUG-05` describes cannot occur given the actual foreign-key constraint (`ON DELETE CASCADE`, not the dangling reference it assumes), and `BUG-06`'s claim that `send_email` blocks the event loop is contradicted by reading Starlette's own source — a synchronous function passed to `BackgroundTasks.add_task` is already run in a thread pool, not on the event loop.
- `BUG-12` (backup reliability) is also mostly false: the actual backup script already implements the exact atomic-write/error-handling pattern the report proposes as its own fix.

Where a finding held up, it's kept below with the same identifier where reasonable, corrected where the report's own reasoning was wrong even if its conclusion was right. New findings this pass turned up that the previous one missed are marked **(new)**.

**The most serious open item this project has isn't in either version of this report**, because it isn't a code defect: real VPS root credentials and a live Dokploy API key were pasted directly into a chat session earlier in this project. That is a human/process risk, not a static-analysis one, and it's still open — see §1.

---

## Table of Contents

1. [Action needed from you, not code](#1-action-needed-from-you-not-code)
2. [🔴 High — real, worth fixing soon](#2-high--real-worth-fixing-soon)
3. [🟡 Medium](#3-medium)
4. [🔵 Low / nice-to-have](#4-low--nice-to-have)
5. [❌ Claims from the previous report that did not hold up](#5-claims-from-the-previous-report-that-did-not-hold-up)
6. [✅ What's genuinely solid](#6-whats-genuinely-solid)
7. [Priority summary table](#7-priority-summary-table)

---

## 1. Action needed from you, not code

### SEC-ROTATE · VPS root password and Dokploy API key were pasted into chat

**What:** During the Dokploy setup earlier in this project, the VPS root password and, separately, a live Dokploy API key were typed directly into the chat transcript. I declined to use the root SSH credentials and use the API key only for the specific Dokploy actions you asked for, but both values now exist in a chat history outside your direct control, and the API key is sitting in a gitignored local file (`.dokploy.key`) that I've been reading from.

**Why it matters:** This is the highest-impact open item in the project, full stop — everything else in this report is about code quality; this is about a live credential with production access that has left a trusted channel.

**Fix:** Rotate both — a new root password on the VPS, and a new API key from the Dokploy dashboard (revoking the old one). This has been flagged before; it's still open as of this audit.

---

## 2. 🔴 High — real, worth fixing soon

### SEC-01 · `TRUST_PROXY_HEADERS` is unset in production — rate limiting is bucketing every user together

**Files:** `backend/app/core/config.py:34`, `backend/app/core/rate_limit.py`, `docker-compose.prod.yml`, `.env.prod`

Confirmed by reading the actual (gitignored) `.env.prod` on this machine: `TRUST_PROXY_HEADERS` is not set anywhere, so it defaults to `False`. Production sits behind Dokploy's Traefik, which terminates every connection — `request.client.host` as seen by the backend is Traefik's container IP for every single visitor. Every rate-limited endpoint (`login`, `signup`, `google`, `verify-email`, `resend-otp`, `forgot-password`, `reset-password`) is bucketing all users into one shared counter. One user hitting a limit currently locks out everyone else, and — the more dangerous direction — an attacker gets the combined budget of every legitimate concurrent user rather than their own individual limit.

**Fix:** Set `TRUST_PROXY_HEADERS=true` in `.env.prod` and add it to `.env.prod.example` with a comment explaining it's required specifically because the stack sits behind Traefik.

### ARCH-01 · 4 Uvicorn workers + an in-memory `ConnectionManager` — chat delivery silently fails across workers

**Files:** `backend/Dockerfile:27`, `backend/app/websocket/manager.py`

Production runs `uvicorn --workers 4`. `ConnectionManager._connections` is a plain Python dict, one instance per worker process, with no shared state between them. When two people in the same conversation land their WebSocket connections on different worker processes (which the OS load-balancer will do essentially at random), `send_to_user` in worker A's process has no way to reach a socket held open in worker B's process — the message is written to the database correctly, but the live push silently never arrives. It shows up only on next page load/refresh. This is real and was correctly identified in the previous report; confirmed here against the actual Dockerfile CMD and the actual `ConnectionManager` implementation.

**Fix — two real options, not one:**
- **Short-term, safe at current scale:** drop to `--workers 1`. Simplest possible fix, and at this project's current traffic a single worker is very unlikely to be the bottleneck — the backend does little CPU-bound work.
- **Correct long-term fix:** a shared pub/sub layer (Redis is the standard choice) so `send_to_user` broadcasts to all workers, not just the one holding the socket. This is real infrastructure work — a new service in both compose files, a new dependency, and every `ConnectionManager.send_to_user` call site touched.

This needs a decision, not just a patch — recommend the `--workers 1` mitigation now (five-minute fix, immediately correct) and treat Redis pub/sub as separate, deliberate scope once chat volume justifies it.

### SEC-02 · No rate limit on sending chat messages or attachments

**File:** `backend/app/routers/chat.py`

Confirmed: `POST /conversations/{id}/messages` and `POST /conversations/{id}/attachments` carry no `rate_limit` dependency, unlike every auth endpoint. A signed-in user can script an unbounded loop against either — filling the database, and via `notification_service`, sending the recipient an unbounded number of emails (a real abuse vector against a third party, not just this app).

**Fix:** Add `Depends(rate_limit("send_message", times=60, seconds=60))` (or similar) to both routes, matching the pattern already used on auth endpoints.

### SEC-03 · `LoginRequest.password` has no length ceiling

**File:** `backend/app/schemas/auth.py:60`

Confirmed: `password: str` with no `max_length`, while `SignupRequest.password` two lines away correctly has `max_length=128`. A caller can POST a multi-megabyte password; argon2 (deliberately CPU-expensive by design) will spend real CPU time hashing it on every attempt, and a handful of concurrent oversized requests is a cheap CPU-exhaustion path against login specifically.

**Fix:** `password: str = Field(max_length=128)`, matching signup.

### OBS-01 · Swagger UI and the OpenAPI schema are publicly reachable in production **(new)**

**File:** `backend/app/main.py`

Not in the previous report. Checked live: `https://api.kenabechaju.deshlet.com/docs` and `/openapi.json` both return `200` right now. FastAPI's interactive docs are enabled by default and nothing in `main.py` conditions them off in production. This hands anyone a complete, browsable map of every route, parameter, and request/response schema in the API with zero reconnaissance effort — not a secret leak by itself, but there's no reason to offer it to the public internet rather than just to admins or local dev.

**Fix:** `FastAPI(docs_url="/docs" if settings.ENV != "production" else None, redoc_url=None, openapi_url="/openapi.json" if settings.ENV != "production" else None)`.

---

## 3. 🟡 Medium

### BUG-01 · `contact_seller` returns stale `last_message`/`unread_count` for an existing conversation

**File:** `backend/app/routers/chat.py:52-57`

Confirmed:
```python
async def contact_seller(...):
    conversation = await chat_service.get_or_create_conversation(db, listing, user)
    return _to_conversation_out(conversation, user, last_message=None, unread_count=0)
```
This hardcodes both values even when `get_or_create_conversation` returns an *existing* thread with real history — a buyer re-contacting a seller they already messaged sees a blank inbox preview until the next full conversation list load. Low severity (self-corrects), but a one-line fix: `chat_service.get_last_message` and `chat_service.count_unread` already exist and are used exactly this way in `list_conversations` a few lines below — `contact_seller` just never calls them.

**Fix:**
```python
last_message = await chat_service.get_last_message(db, conversation)
unread = await chat_service.count_unread(db, conversation, user)
return _to_conversation_out(conversation, user, last_message, unread)
```

### PERF-01 · Rate limiter has a genuine check-then-act race

**File:** `backend/app/core/rate_limit.py`

Confirmed by reading `enforce()`: it `SELECT`s the current count, compares it to the limit, and only then `INSERT`s+commits a new `RateLimitHit` row — no locking or atomic increment between the two. Two requests arriving in the same narrow window can both read a count under the limit before either has committed its row, letting slightly more than `times` requests through in a tight race. Real, but bounded — it lets the limit be exceeded by a small margin under concurrent bursts, not bypassed outright, and this project's rate-limited endpoints are all low-frequency auth actions where this has never been the difference between "protected" and "not."

**Fix, if worth the complexity at this scale:** a unique constraint plus `ON CONFLICT` handling, or move to Redis `INCR` (atomic by construction) if Redis is added anyway for the WebSocket fix above — worth bundling the two rather than solving this twice.

### OBS-02 · No connect/read timeout on the SMTP client

**File:** `backend/app/services/email_service.py:22`

`smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)` has no `timeout`. This does **not** block the event loop — confirmed by reading Starlette's `BackgroundTask.__call__`, which runs synchronous callables via `run_in_threadpool` — but an indefinitely hanging SMTP connection still ties up one thread-pool worker thread until it times out or the process restarts, and the thread pool is a shared, finite resource used by other synchronous work in the app.

**Fix:** `smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)`.

### SEC-04 · Backend Docker image runs as root

**File:** `backend/Dockerfile`

Confirmed: neither the `dev` nor `prod` stage adds a `USER` directive; the container runs as root end to end. If the process is ever compromised (a dependency CVE being exploited, say), the attacker has root inside the container rather than a restricted user. Standard defense-in-depth, cheap to add.

**Fix:** in the `prod` stage, after `COPY . .`: `RUN addgroup --system app && adduser --system --ingroup app app` then `USER app` before the entrypoint. Needs the media/app directories to be writable by that user — worth testing the upload path specifically after this change.

### TEST-01 · Frontend has zero automated tests

**What:** No `*.test.ts(x)` files anywhere under `frontend/`, confirmed by search. The backend has a mutation-checked, 231-test suite (`backend/tests/`); the frontend — auth flows, the WebSocket reconnect/refresh-retry logic, every admin CRUD screen built in Phases 40–45 — has none. This is real and it's the widest gap in the project relative to its size.

**Fix:** not "add some tests" in the abstract — start with the parts that have actually broken in this project's own history: the auth refresh-token race (`AuthContext`'s deduplicated in-flight refresh), the WebSocket reconnect-on-4401 logic (Phase 26), and the admin bulk-action / reorder flows (Phases 42–45), since those are exactly the places mutation testing on the backend found real bugs when the same technique was applied.

### DEP-01 · `sharp` (image optimization) has known high-severity CVEs **(new)**

**File:** `frontend/package.json` (transitive, via Next.js's image optimizer)

`npm audit` reports `sharp <0.35.0` with high-severity libvips CVEs (buffer/memory issues — GHSA-f88m-g3jw-g9cj). The fix `npm audit fix --force` offers bumps Next.js from the currently pinned `16.2.12` to `16.3.0`, outside the declared range — not a drop-in patch, needs a real upgrade-and-test pass (this project's `next/image` proxy setup in particular, since that's had real bugs before — see Phase 24's history).

**Fix:** upgrade deliberately, not with `--force` blind — bump the Next.js version pin, run the full test/build/typecheck pipeline, and manually re-verify image rendering (including the avatar/logo/listing-photo paths) before shipping.

---

## 4. 🔵 Low / nice-to-have

### UX-01 · Protected pages have no server-side auth guard

**Files:** `frontend/proxy.ts`, every page under `/dashboard`, `/inbox`, `/admin`, `/complete-profile`

`proxy.ts` (Next 16's renamed middleware file — it exists, contrary to the previous report's "no `middleware.ts`" framing) only handles one direction: redirecting an *already-authenticated* user away from `/login`/`/signup`. It does not redirect an unauthenticated visitor away from protected pages — that's still done client-side, inside each page, after the initial render. In practice this means a flash of loading UI before the client-side redirect fires, plus a couple of API calls that get made and then thrown away. Not a security hole (every backend endpoint is independently authenticated), just avoidable client-side waste and a slightly rough edge.

**Fix:** extend `proxy.ts`'s matcher to cover the protected paths and redirect when `access_token` is absent — same file, same pattern already in place for the reverse case.

### JUDGMENT-01 · Password policy is length-only (`min_length=8`)

**File:** `backend/app/schemas/auth.py:27`

Real, but this is a genuine trade-off, not an obvious bug: NIST 800-63B (the modern reference standard) explicitly recommends *against* composition rules (forced uppercase/digit/symbol) because they push users toward predictable patterns like `Password1!`, and recommends length plus a breached-password check instead. If this is worth changing, a breach-list check (e.g., the k-anonymity HaveIBeenPwned API) is the more defensible upgrade than composition rules — worth a decision, not a reflexive fix.

### PERF-02 · Expiry sweep runs hourly; listings expire after 30 days

**File:** `backend/app/tasks/expiry.py:21`

Real but negligible — `browse_listings` already filters `expires_at` independently of the sweep, so correctness never depends on the sweep's cadence; it only affects how quickly the seller dashboard's status label catches up. Six-hourly would be just as correct and cheaper. Not worth a dedicated phase; fold in opportunistically.

### PERF-03 · `not-found.tsx` is `"use client"` only to call `useLanguage()`

**File:** `frontend/app/not-found.tsx`

Real — prevents Next from pre-rendering the 404 page statically, adding a small amount of latency to every 404 response. Minor; only worth it alongside other work in the same file.

### DEP-02 · `python-jose` pulls in `ecdsa`, which carries an unfixed timing-attack CVE **(new)**

**File:** `backend/pyproject.toml`

`pip-audit` flags `ecdsa` for a Minerva timing attack on P-256 (PYSEC-2026-1325), with no planned upstream fix. This app uses `JWT_ALGORITHM=HS256` exclusively — symmetric HMAC, not the ECDSA code path the CVE concerns — so it isn't currently exploitable here. Still, `python-jose` is a less actively maintained library than `PyJWT`, which wouldn't pull in `ecdsa` at all for HS256 usage. Not urgent; worth a migration if `security.py` is ever touched for other reasons.

### OBS-03 · Off-host backups still don't exist

**File:** `docker-compose.prod.yml`

Already documented honestly in its own comment ("not a substitute for off-host backups — a dump sitting on the same VPS is lost with the VPS"), confirmed still true. Not a new finding, just re-confirmed as still open. The nightly dump + tested restore procedure from Phase 34 is real and correct as far as it goes; it just doesn't survive losing the VPS itself.

---

## 5. ❌ Claims from the previous report that did not hold up

Kept here for the record, so this doesn't get re-flagged by a future audit that also doesn't check.

| ID | Claim | Why it's false |
|---|---|---|
| BUG-01 | `.env.local` tracked in git | Never tracked — confirmed via `git ls-files` and full history search |
| BUG-02 | `.env.prod` tracked in git | Same — never tracked, correctly gitignored |
| BUG-05 | `get_seller_reviews` crashes if a listing's shop was deleted | `listings.shop_id` is `ON DELETE CASCADE` — a listing can never outlive its shop's row, and soft-delete doesn't remove the row either. Unreachable as described. |
| BUG-06 | `send_email` blocks the asyncio event loop | Starlette's `BackgroundTask.__call__` runs sync callables via `run_in_threadpool` — confirmed by reading the installed library source. Does not block the loop. |
| BUG-12 | Backup script has no error handling around `gzip`/rename | The actual script already does exactly this: writes to `.part`, checks the `pg_dump \| gzip` exit status, `mv`s only on success, `rm -f`s on failure |
| MISSING-01 | No `middleware.ts` at all | `proxy.ts` exists (Next 16 renamed the convention) — it's just scoped to one direction; see UX-01 above for the real, narrower gap |
| MISSING-04 | No `prefers-reduced-motion` handling | Implemented in `globals.css` and `MotionProvider` since Phase 15 |
| MISSING-05 | No navbar search bar | `NavbarSearch` has been in the navbar since Phase 28 |
| MISSING-06 | No segmented OTP input | `OtpInput.tsx` exists and is used on verify-email since Phase 20 |
| MISSING-07 | No password visibility toggle | `PasswordInput.tsx` exists and is used on every auth form since Phase 20 |
| MISSING-08 | No CI/CD pipeline | `.github/workflows/ci.yml` exists and gates every deploy since Phase 34 |
| MISSING-09 | `robots.ts` doesn't block admin/inbox/dashboard | It already disallows exactly those paths, since Phase 32 |
| MISSING-12 | No price range slider | Implemented in `ListingFilters.tsx` since Phase 17 |

---

## 6. ✅ What's genuinely solid

Re-verified, not just carried over:

| Area | Notes |
|---|---|
| Refresh token rotation | Single-use, family revocation on reuse — correct |
| JWT lifetimes | 15-min access / 30-day refresh, `type` claim validated |
| Image upload validation | Magic-byte sniffing, not client-supplied `content_type` |
| Path traversal prevention | `delete_media` checks `is_relative_to(MEDIA_ROOT)` |
| Admin bootstrap (`ADMIN_EMAILS`) | One-way, applied on signup, password login, and Google login |
| CORS | Locked to the real production origin in `.env.prod`, not wildcard |
| JWT secret startup guard | Refuses to start in production with the placeholder value |
| Migrations on deploy | `entrypoint.sh` runs `alembic upgrade head` before serving, `set -e` |
| Health check | Actually queries the database, not a bare 200 |
| CI/CD | Tests + typecheck + build gate every deploy; a red build never reaches Dokploy |
| Backend test suite | 231 tests, mutation-checked, against real Postgres |
| i18n | Cookie-driven locale, no hydration mismatch, ~280 keys with compile-time parity |
| Rate limiting design (endpoint coverage, not the proxy-trust gap above) | Sliding window, `Retry-After`, correctly excludes chat — see SEC-02 |

---

## 7. Priority summary table

| ID | Severity | Area | Description |
|---|---|---|---|
| SEC-ROTATE | 🔴 Action, not code | Ops | VPS root password + Dokploy API key were pasted in chat — rotate both |
| SEC-01 | 🔴 High | Security | `TRUST_PROXY_HEADERS` unset in prod — rate limiting bucketed by Traefik's IP for everyone |
| ARCH-01 | 🔴 High | Backend/Chat | 4 workers + in-memory WS manager — cross-worker chat delivery silently fails |
| SEC-02 | 🔴 High | Security | No rate limit on sending chat messages/attachments |
| SEC-03 | 🔴 High | Security | No `max_length` on login password — CPU-exhaustion vector |
| OBS-01 | 🔴 High | Security | `/docs` + `/openapi.json` public in production |
| BUG-01 | 🟡 Medium | Backend/UX | `contact_seller` returns stale last-message/unread for existing conversations |
| PERF-01 | 🟡 Medium | Backend | Rate limiter check-then-act race, bounded impact |
| OBS-02 | 🟡 Medium | Backend | No SMTP timeout — can hang a thread-pool worker |
| SEC-04 | 🟡 Medium | DevOps | Backend container runs as root |
| TEST-01 | 🟡 Medium | Testing | Zero frontend tests |
| DEP-01 | 🟡 Medium | DevOps | `sharp`/libvips high-severity CVEs, needs a tested Next.js bump |
| UX-01 | 🔵 Low | Frontend | Protected pages guard client-side only — FOUC + wasted calls, not a security hole |
| JUDGMENT-01 | 🔵 Low | Security | Password policy is length-only — defensible, worth a decision not a reflex |
| PERF-02 | 🔵 Low | Backend | Expiry sweep hourly rather than every 6h |
| PERF-03 | 🔵 Low | Frontend | `not-found.tsx` unnecessarily client-rendered |
| DEP-02 | 🔵 Low | Backend | `ecdsa` CVE via `python-jose`, not exploitable under HS256-only usage |
| OBS-03 | 🔵 Low | DevOps | Backups are on-host only, already documented as such |

---

*End of audit — KenaBecha JU. See `PLAN.md` Phases 46+ for the fix plan built from this report.*
