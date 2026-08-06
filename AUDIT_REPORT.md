# 🔍 KenaBecha JU — Full Project Audit Report

> **Audited by:** Antigravity (Senior Software Engineer perspective)
> **Date:** 2026-08-07
> **Scope:** Full-stack — Backend (FastAPI/Python), Frontend (Next.js 16/TypeScript), DevOps (Docker/Dokploy), Docs
> **Format:** Bug → what it is, where it lives, why it matters, how to fix it

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [🔴 Critical — Must Fix Before Going Live](#2-critical--must-fix-before-going-live)
3. [🟠 High — Fix in the Next Sprint](#3-high--fix-in-the-next-sprint)
4. [🟡 Medium — Fix Soon](#4-medium--fix-soon)
5. [🔵 Low / Nice-to-Have](#5-low--nice-to-have)
6. [✅ What Is Actually Done Well](#6-what-is-actually-done-well)
7. [🗺️ Missing Features Roadmap](#7-missing-features-roadmap)
8. [📁 Documentation Gaps](#8-documentation-gaps)
9. [Priority Summary Table](#9-priority-summary-table)

---

## 1. Executive Summary

KenaBecha JU is a **student marketplace for Jahangirnagar University** built on a modern stack (FastAPI + async SQLAlchemy + Next.js 16 + React 19). The backend is architecturally solid, well-commented, and shows real engineering care (refresh-token rotation, rate limiting, WebSocket heartbeats, magic-bytes image sniffing). However, the audit uncovered **2 critical security issues**, several high-priority bugs and UX gaps, and a significant frontend design debt (~25% of the stated premium aesthetic goal is actually implemented).

---

## 2. 🔴 Critical — Must Fix Before Going Live

### BUG-01 · Google OAuth Client ID leaked in `.env.local`

**File:** `frontend/.env.local`
**What:** `.env.local` contains your real `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Next.js `NEXT_PUBLIC_*` variables are **baked into the browser bundle** and always public, but `.env.local` is tracked in git. The `NEXT_PUBLIC_API_URL=http://localhost:8000` line also leaks the local dev API address to anyone inspecting the repo.

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=780133163769-...apps.googleusercontent.com
```

**Why it matters:** The Google Client ID is already public by design (it's sent to the browser), but committing `.env.local` means any developer cloning the repo silently uses prod credentials locally, making OAuth misuse easier to miss. More critically — if someone later adds a real secret to this file and commits it, it will be permanently exposed in git history.

**Fix:** Confirm `.env.local` is in `frontend/.gitignore`, then:
```bash
git rm --cached frontend/.env.local
git commit -m "stop tracking .env.local"
```

---

### BUG-02 · `.env.prod` committed to the repository — SMTP password and all secrets exposed

**File:** `.env.prod`
**What:** The production `.env.prod` file is sitting in the repo root and is **tracked by git** (visible to anyone with repo access). It contains:

```
SMTP_PASSWORD=ucbwddokvavouhgg       ← Gmail App Password (real credential)
ADMIN_EMAILS=salmanahmed382.jubair@gmail.com
JWT_SECRET_KEY=05ec66ae23...          ← Production JWT signing key
POSTGRES_PASSWORD=HwXwUIKU0uv...      ← Production DB password
GOOGLE_CLIENT_ID=780133163769-...     ← Prod OAuth client
```

**Why it matters:** Anyone with read access to this repo can:
1. Send emails as `kenabechaju@gmail.com`
2. Forge JWT tokens for any user account
3. Connect directly to the PostgreSQL database (if port is ever exposed)
4. Silently log in as admin

**Fix (urgent):**
1. `git rm --cached .env.prod` to stop tracking it
2. Add `.env.prod` to the root `.gitignore`
3. Immediately rotate: JWT secret, SMTP app password, Postgres password
4. Check git log exposure: `git log --all --full-history -- .env.prod`

---

### BUG-03 · `TRUST_PROXY_HEADERS` not set in production — rate limiting is broken

**Files:** `backend/app/core/config.py` (line 34), `backend/app/core/rate_limit.py` (lines 17-30), `docker-compose.prod.yml`

**What:** Production runs behind **Dokploy/Traefik** (a reverse proxy) which sets `X-Forwarded-For`. However, `TRUST_PROXY_HEADERS` defaults to `False` and is **not set** in `.env.prod` or `docker-compose.prod.yml`. This means:

```python
def client_identifier(request: Request) -> str:
    if settings.TRUST_PROXY_HEADERS:   # always False in prod
        ...
    return request.client.host  # ← in prod, this is the Traefik container IP
                                 # ALL users share ONE rate-limit bucket
```

**Why it matters:** All users in production share a single rate-limit bucket (the Traefik container IP). One user can exhaust everyone's budget. One legitimate user hitting the login limit blocks all other users from logging in.

**Fix:** Add to `docker-compose.prod.yml` backend environment:
```yaml
TRUST_PROXY_HEADERS: "true"
```
And document in `.env.prod.example`:
```
TRUST_PROXY_HEADERS=true  # Required when behind Traefik/Dokploy
```

---

## 3. 🟠 High — Fix in the Next Sprint

### BUG-04 · No `max_length` on `LoginRequest.password` — CPU-exhaustion DoS

**File:** `backend/app/schemas/auth.py` (line 60)

**What:** `LoginRequest.password` is a bare `str` with no size constraints:
```python
class LoginRequest(BaseModel):
    email: EmailStr
    password: str  # ← no max_length
```
An attacker can POST a multi-megabyte password string. argon2 will spend **CPU seconds** hashing it on every login attempt, potentially grinding the server to a halt with a handful of concurrent requests.

**Fix:**
```python
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=256)
```

---

### BUG-05 · `get_seller_reviews` crashes if the shop associated with a listing is deleted

**File:** `backend/app/routers/listings.py` (lines 140-145)

**What:**
```python
if listing.shop_id is not None:
    shop = await db.get(Shop, listing.shop_id)
    average, count = await rating_service.get_shop_rating_summary(db, shop.id)
    # ↑ If shop was soft-deleted, db.get returns None → shop.id → AttributeError: 500
```

**Fix:**
```python
if listing.shop_id is not None:
    shop = await db.get(Shop, listing.shop_id)
    if shop is None:
        raise HTTPException(404, "Shop not found")
```

---

### BUG-06 · `send_email` is **synchronous** and blocks the asyncio event loop

**File:** `backend/app/services/email_service.py` (lines 22-26)

**What:** `send_email` uses `smtplib.SMTP` (blocking network I/O). It is called from `BackgroundTasks`, which runs in the same event loop as the server. A slow SMTP server (Gmail's `smtp.gmail.com:587` adds 1-10 seconds of latency) will freeze **all concurrent requests** during email sends.

```python
def send_email(to: str, subject: str, body: str) -> None:
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()  # ← blocking I/O in the async event loop
```

**Fix:** Wrap in `asyncio.to_thread`:
```python
import asyncio

async def send_email(to: str, subject: str, body: str) -> None:
    await asyncio.to_thread(_send_email_sync, to, subject, body)

def _send_email_sync(to: str, subject: str, body: str) -> None:
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        ...
```

---

### BUG-07 · 4-worker Uvicorn + in-memory WebSocket manager = real-time chat broken in production

**Files:** `backend/Dockerfile` (line 27), `backend/app/websocket/manager.py`

**What:** Production runs `uvicorn ... --workers 4`. The `ConnectionManager` stores WebSocket connections in a **Python in-memory dict**:
```python
class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}  # per-worker dict
```
With 4 workers, a message sent from worker 1's context looks up the recipient in worker 1's dict — which does not contain connections established to workers 2, 3, or 4. Real-time message delivery silently fails for ~75% of messages.

**Why it matters:** Chat works perfectly in development (1 worker) but is largely broken in production without any error — messages appear sent but don't arrive live.

**Fix (short-term, safe for current scale):** Change `--workers 4` to `--workers 1` in the Dockerfile CMD.
**Fix (long-term):** Add Redis pub/sub so all workers share connection state.

---

### BUG-08 · No rate limit on chat message/attachment sending

**File:** `backend/app/routers/chat.py` (lines 104, 169)

**What:** `POST /conversations/{id}/messages` and `POST /conversations/{id}/attachments` have no rate limiting. A logged-in user can spam thousands of messages per second, filling the database and sending unlimited notification emails to the recipient.

**Fix:** Add to both endpoints:
```python
dependencies=[Depends(rate_limit("send_message", times=60, seconds=60))]
```

---

### BUG-09 · `contact_seller` returns `last_message=None` for existing conversations

**File:** `backend/app/routers/chat.py` (lines 52-57)

**What:**
```python
async def contact_seller(...):
    conversation = await chat_service.get_or_create_conversation(db, listing, user)
    return _to_conversation_out(conversation, user, last_message=None, unread_count=0)
    # ↑ hardcoded None even when conversation already exists with messages
```
When a buyer contacts a seller they've already messaged, the returned ConversationOut has `last_message_preview=None` — making the inbox preview blank until the user manually refreshes.

**Fix:**
```python
last_message = await chat_service.get_last_message(db, conversation)
unread = await chat_service.count_unread(db, conversation, user)
return _to_conversation_out(conversation, user, last_message, unread)
```

---

### MISSING-01 · No `middleware.ts` — protected pages flash unauthenticated content

**What:** The frontend has no Next.js middleware file. All protected routes (`/dashboard`, `/inbox`, `/profile`, `/complete-profile`, `/admin`) rely on client-side auth checks inside page components. This causes:
1. Flash of unauthenticated content (user sees a loading skeleton, then gets redirected)
2. Unnecessary API calls (e.g., `getConversations()` fires before auth resolves)
3. Search engine crawlers may attempt to index authenticated content

**Fix:** Create `frontend/middleware.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/inbox', '/profile', '/complete-profile', '/admin'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token');
  const isProtected = PROTECTED.some(p => request.nextUrl.pathname.startsWith(p));
  if (isProtected && !token) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url)
    );
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/inbox/:path*', '/profile/:path*', '/complete-profile', '/admin/:path*'],
};
```

---

### MISSING-02 · Zero frontend tests

**What:** The `frontend/` directory has no test files. No Jest, no React Testing Library, no Playwright. Auth flows, form validation, WebSocket reconnection, and the real-time inbox have zero automated coverage.

**Fix:** Add at minimum:
- `LoginForm.test.tsx` — form validation, successful login, error state
- `InboxPage.test.tsx` — conversation list loading, auth guard
- `AuthContext.test.tsx` — token refresh retry logic

---

## 4. 🟡 Medium — Fix Soon

### BUG-10 · Race condition in database-backed rate limiter

**File:** `backend/app/core/rate_limit.py` (lines 42-86)

**What:** Two simultaneous requests can both read `used < limit.times` before either inserts its `RateLimitHit` row, allowing both through — effectively allowing up to `N*limit` requests where N is the number of concurrent workers hitting the same bucket at the same moment.

**Fix:** Add a unique constraint or use a SELECT FOR UPDATE / INSERT ON CONFLICT approach. Or replace with Redis INCR which is atomic by nature.

---

### BUG-11 · `smtplib.SMTP` has no explicit timeout

**File:** `backend/app/services/email_service.py` (line 22)

**What:** `smtplib.SMTP(host, port)` with no `timeout` argument uses the socket default (can be indefinite). If Gmail's SMTP server is slow, the blocking call can hang for minutes (compounding BUG-06).

**Fix:**
```python
with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
```

---

### BUG-12 · `db_backup` service uses `sleep 86400` — not a reliable nightly backup

**File:** `docker-compose.prod.yml` (lines 119-135)

**What:** The backup container runs `sleep 86400` between dumps. If the container restarts at 23:59, the next backup only runs ~24 hours later (not the intended nightly schedule). Additionally the `pg_dump | gzip` pipe — if `gzip` fails, the part file is left empty but still renamed to the final filename on some shell versions.

**Fix:** Use explicit pipe status checks:
```sh
pg_dump ... | gzip > file.part
if [ $? -eq 0 ]; then
  mv file.part file
else
  rm -f file.part
  echo "BACKUP FAILED" >&2
fi
```
And consider using `crond` for reliable scheduling.

---

### MISSING-03 · No password strength enforcement beyond minimum length

**File:** `backend/app/schemas/auth.py` (line 27)

**What:** `SignupRequest.password` only checks `min_length=8`. A password of `aaaaaaaa` is accepted. No uppercase, digit, or special character requirement.

**Fix (backend):**
```python
import re

@field_validator("password")
@classmethod
def password_strength(cls, v: str) -> str:
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain an uppercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain a digit")
    return v
```

---

### MISSING-04 · No `prefers-reduced-motion` handling — accessibility violation

**Files:** `frontend/app/globals.css`, all Framer Motion components

**What:** Users with vestibular disorders who have `prefers-reduced-motion: reduce` set will still experience all page transitions, stagger animations, and floating effects. This violates WCAG 2.1 guideline 2.3.3.

**Fix:** Add to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
And in Framer Motion components use `useReducedMotion()`:
```tsx
const prefersReduced = useReducedMotion();
const variants = prefersReduced ? {} : myAnimationVariants;
```

---

### MISSING-05 · No search bar in the Navbar

**File:** `frontend/components/layout/Navbar.tsx`

**What:** There is no search input in the navbar. Users must navigate to `/listings` to search. Every major marketplace has navbar-level search as the primary entry point for discovery.

**Fix:** Add a compact search input that routes to `/listings?q=...`. Collapse to an icon on mobile.

---

### MISSING-06 · Segmented OTP input missing on verify-email page

**What:** The verify-email page uses a standard text input for the 6-digit OTP. A segmented 6-box input (one digit per box) is standard UX for verification codes and significantly reduces user errors. Referenced in `gap_analysis.md` (line 93).

---

### MISSING-07 · Password visibility toggle missing on all auth forms

**What:** Password fields on login, signup, forgot-password, and reset-password pages have no eye-icon toggle to reveal the password. This is a top friction point in auth form UX audits. Referenced in `gap_analysis.md` (line 92).

---

### MISSING-08 · No CI/CD pipeline

**What:** The `.github/` directory exists but contains no workflow files. There's no automated linting, testing, build validation, or secret scanning on PRs.

**Fix — minimal GitHub Actions:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -e ".[dev]"
      - run: pytest
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run build
```

---

## 5. 🔵 Low / Nice-to-Have

### BUG-13 · Multi-worker WebSocket: `is_online` check returns wrong result even for 1-worker scenario after a crash

**File:** `backend/app/websocket/manager.py`

**What:** If a worker crashes and restarts, the `_connections` dict is wiped. Any user whose connection was on that worker appears offline to `is_online()` even if they reconnected to a new worker immediately. This means the "email if offline" notification logic fires when it shouldn't (minor: user gets an email they didn't need, not a critical failure).

---

### BUG-14 · `not-found.tsx` uses `"use client"` unnecessarily

**File:** `frontend/app/not-found.tsx`

**What:** The 404 page is marked `"use client"` only to use `useLanguage()`. This prevents Next.js from pre-rendering it as a static page, adding latency for every 404 response.

**Fix:** Implement server-side locale detection with a server component, or accept the minor overhead.

---

### BUG-15 · Expiry sweep runs every hour but listings expire after 30 days

**File:** `backend/app/tasks/expiry.py` (line 21)

**What:** `SWEEP_INTERVAL_SECONDS = 3600` (every 1 hour). But listings expire after 30 days, and they're already excluded from `browse_listings` via `expires_at` filter. The sweep only updates `status` to `expired` for the seller's dashboard Renew button — running every 6 hours would be sufficient.

**Fix:** `SWEEP_INTERVAL_SECONDS = 21600` (6 hours).

---

### MISSING-09 · `robots.ts` should block admin/inbox/dashboard from search crawlers

**File:** `frontend/app/robots.ts`

**What:** Protected routes should be disallowed from search engine crawlers to prevent indexing of error/redirect pages.

**Fix:**
```typescript
disallow: ['/admin/', '/inbox/', '/dashboard/', '/complete-profile'],
```

---

### MISSING-10 · Backend Docker image runs as root

**File:** `backend/Dockerfile`

**What:** Neither the dev nor prod Docker stage adds a non-root user. If the container is compromised, the attacker has root within the container.

**Fix (add before the final `COPY . .` in the prod stage):**
```dockerfile
RUN addgroup --system app && adduser --system --ingroup app app
USER app
```

---

### MISSING-11 · Transactional emails are plain text

**File:** `backend/app/services/email_service.py`

**What:** All emails (OTP, password reset, welcome, new message) are plain text with no HTML. They look unprofessional and are more likely to be classified as spam by Gmail's filters.

**Fix:** Add minimal HTML email templates with the brand color and logo.

---

### MISSING-12 · No price range slider on listing browse

**What:** Price filtering uses two separate text inputs (`min_price`, `max_price`). A dual-handle range slider is far more intuitive and is standard in all marketplace UIs. Referenced in `gap_analysis.md` (line 104).

---

## 6. ✅ What Is Actually Done Well

These are areas where the codebase is genuinely well-engineered:

| Area | Notes |
|------|-------|
| **Refresh token rotation** | Single-use tokens with family revocation on reuse — correct implementation |
| **JWT security** | Short-lived access (15 min), long-lived httpOnly refresh, `type` claim validated |
| **Image validation** | Magic-bytes sniffing prevents content-type spoofing — not many projects do this |
| **Path traversal prevention** | `delete_media` checks `is_relative_to(MEDIA_ROOT)` before any file operations |
| **Admin bootstrap** | One-way promotion (no silent demotion), applied on all 3 login paths |
| **Rate limiting design** | Per-endpoint, with `Retry-After` header, clear scope naming |
| **WebSocket heartbeat** | Server-side ping/pong with stale connection reaping at 90s timeout |
| **Health check** | `/health` queries the DB — not just a 200 from the process |
| **Background task safety** | ExpirySweeper handles errors and never kills the event loop |
| **Error codes** | Machine-readable `AppError` codes for frontend i18n — forward-thinking |
| **Test coverage** | 14 test files covering auth, admin, listings, search, roles, navigation |
| **Alembic in entrypoint** | Migrations run before uvicorn — deploy cannot serve against wrong schema |
| **Cookie security** | `httponly=True`, `secure=True` in prod, `samesite="lax"` — all correct |
| **CORS config** | Not wildcard — reads from environment |
| **Concurrent refresh deduplication** | Frontend shares one in-flight `/auth/refresh` call to prevent token family revocation |
| **i18n** | EN/BN bilingual frontend with server-side locale detection (no hydration mismatch) |
| **Fallback navigation** | Layout never crashes on API failure — graceful degradation |

---

## 7. 🗺️ Missing Features Roadmap

### Frontend (UI/UX)

| Feature | Priority | Status |
|---------|----------|--------|
| `middleware.ts` for route protection | 🟠 High | ❌ Missing |
| Password visibility toggle | 🟠 High | ❌ Missing |
| Segmented OTP input | 🟠 High | ❌ Missing |
| Navbar search bar (desktop) | 🟡 Medium | ❌ Missing |
| Price range slider filter | 🟡 Medium | ❌ Missing |
| Page transitions (`AnimatePresence`) | 🟡 Medium | ❌ Missing |
| `prefers-reduced-motion` support | 🟡 Medium | ❌ Missing |
| Mobile bottom sheet dialogs | 🟡 Medium | ❌ Missing |
| Empty state illustrations | 🟡 Medium | ❌ Missing |
| Stagger animations on listing grids | 🔵 Low | ❌ Missing |
| Image lazy-load fade-in | 🔵 Low | ❌ Missing |
| Animated form validation errors | 🔵 Low | ❌ Missing |
| Responsive admin tables (mobile-friendly) | 🟡 Medium | ❌ Missing |
| User card component | 🔵 Low | ❌ Missing |
| Latest reviews section on homepage | 🟡 Medium | ❌ Missing |

### Backend (Features / Fixes)

| Feature | Priority | Status |
|---------|----------|--------|
| Message send rate limiting | 🟠 High | ❌ Missing |
| Fix WebSocket multi-worker (Redis pub/sub or single worker) | 🟠 High | ❌ Missing |
| Async SMTP (`asyncio.to_thread` or `aiosmtplib`) | 🟠 High | ❌ Missing |
| HTML email templates | 🟡 Medium | ❌ Missing |
| Password strength validation | 🟡 Medium | ❌ Missing |
| Redis-backed rate limiting (atomic, no race) | 🟡 Medium | ❌ Missing |
| Shop listing pagination with total count | 🟡 Medium | ❌ Missing |
| Notification email opt-out preference | 🔵 Low | ❌ Missing |

### DevOps

| Feature | Priority | Status |
|---------|----------|--------|
| `TRUST_PROXY_HEADERS=true` in prod env | 🔴 Critical | ❌ Missing |
| CI/CD pipeline (GitHub Actions) | 🟠 High | ❌ Missing |
| Secret scanning (GitGuardian / trufflehog) | 🟠 High | ❌ Missing |
| Non-root Docker user | 🔵 Low | ❌ Missing |
| Off-host database backup (S3/rclone) | 🟡 Medium | ❌ Missing |

---

## 8. 📁 Documentation Gaps

| File | Gap |
|------|-----|
| `README.md` | No local dev setup, no Docker quickstart, no architecture overview |
| `DEPLOYMENT.md` | Missing: how to rotate secrets, TLS setup details, scaling guidance |
| `backend/.env.example` | Missing `TRUST_PROXY_HEADERS` — critical for production |
| `backend/app/core/config.py` | `Settings` class has no docstring — unclear which vars are required vs optional |
| Root `.gitignore` | Missing `.env.prod` entry |
| No `CONTRIBUTING.md` | No guide for PRs, branch naming, commit format |
| No `CHANGELOG.md` | No record of what has been shipped |

---

## 9. Priority Summary Table

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| BUG-02 | 🔴 Critical | Security | `.env.prod` with all production secrets committed to repo |
| BUG-03 | 🔴 Critical | Security/Rate Limit | `TRUST_PROXY_HEADERS=false` — all rate limiting broken in prod |
| BUG-01 | 🔴 Critical | Security | `.env.local` tracked in git |
| BUG-07 | 🟠 High | Backend/Chat | 4-worker Uvicorn + in-memory WS manager — real-time chat fails in prod |
| BUG-06 | 🟠 High | Backend/Perf | Blocking SMTP in async event loop — server freezes on email send |
| BUG-04 | 🟠 High | Security | No `max_length` on `LoginRequest.password` — CPU DoS |
| BUG-05 | 🟠 High | Backend | `get_seller_reviews` crashes with 500 when shop is deleted |
| BUG-08 | 🟠 High | Security | No rate limit on chat message sending |
| BUG-09 | 🟠 High | Backend/UX | `contact_seller` returns wrong `last_message=None` for existing convos |
| MISSING-01 | 🟠 High | Frontend | No `middleware.ts` — FOUC and spurious API calls on protected pages |
| MISSING-02 | 🟠 High | Testing | Zero frontend tests |
| BUG-10 | 🟡 Medium | Backend | Race condition in DB rate limiter |
| BUG-11 | 🟡 Medium | Backend | No SMTP timeout — can hang indefinitely |
| BUG-12 | 🟡 Medium | DevOps | Unreliable backup scheduling with `sleep 86400` |
| MISSING-03 | 🟡 Medium | Security | No password strength validation beyond length |
| MISSING-04 | 🟡 Medium | Accessibility | No `prefers-reduced-motion` handling — WCAG violation |
| MISSING-05 | 🟡 Medium | Frontend/UX | No navbar search bar |
| MISSING-06 | 🟡 Medium | Frontend/UX | No segmented OTP input on verify-email |
| MISSING-07 | 🟡 Medium | Frontend/UX | No password visibility toggle on auth forms |
| MISSING-08 | 🟡 Medium | DevOps | No CI/CD pipeline |
| BUG-13 | 🔵 Low | Backend | Stale `is_online` state after worker crash |
| BUG-14 | 🔵 Low | Frontend | `not-found.tsx` unnecessarily client-side |
| BUG-15 | 🔵 Low | Backend | Expiry sweep runs hourly — 6-hourly is sufficient |
| MISSING-09 | 🔵 Low | SEO | `robots.ts` should block admin/inbox/dashboard |
| MISSING-10 | 🔵 Low | DevOps | Docker image runs as root |
| MISSING-11 | 🔵 Low | UX | Emails are plain text — no HTML templates |
| MISSING-12 | 🔵 Low | Frontend/UX | No price range slider for listings filter |

---

*End of Audit Report — KenaBecha JU v0.1.0*
*Generated by full static code review of all backend routers, services, models, schemas, frontend pages, contexts, API clients, WebSocket client, CSS, Docker config, and environment files.*
