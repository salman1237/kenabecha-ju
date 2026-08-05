# 🔍 KenaBecha JU — Comprehensive System Audit & Improvement Plan

> **Audited:** Every file in `backend/app/` (models, routers, services, core, schemas, websocket) and `frontend/app/` (pages, components, lib, types).
> **Reference:** [ekhanei.com](https://ekhanei.com) and standard marketplace platforms (FB Marketplace, Airbnb, OLX).

---

## Table of Contents

1. [Critical Bugs](#1-critical-bugs)
2. [Security Vulnerabilities](#2-security-vulnerabilities)
3. [Backend — Logic & Data Bugs](#3-backend--logic--data-bugs)
4. [Backend — Missing Features](#4-backend--missing-features)
5. [Frontend — Bugs & UX Issues](#5-frontend--bugs--ux-issues)
6. [Frontend — Missing Features & Pages](#6-frontend--missing-features--pages)
7. [DevOps & Infrastructure](#7-devops--infrastructure)
8. [Performance Bottlenecks](#8-performance-bottlenecks)
9. [i18n / Localization (Bangla + English)](#9-i18n--localization-bangla--english)
10. [Feature Comparison vs ekhanei.com](#10-feature-comparison-vs-ekhaneiccom)
11. [Redesign Improvement Summary](#11-redesign-improvement-summary)

---

## 1. Critical Bugs

> [!CAUTION]
> These bugs can cause data loss, security breaches, or application crashes in production.

### 🐛 BUG-01: `admin_remove_listing` — Missing `email_subject` & `email_body` kwargs
**File:** [admin_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/admin_service.py#L65-L76)

The `notify()` call on line 65 passes `type=` as a keyword (which collides with `ntype` parameter name in `notification_service.notify`) and is missing the **required** `email_subject` and `email_body` arguments. This will crash with a `TypeError` at runtime whenever an admin removes a listing.

```diff
- await notification_service.notify(
-     db,
-     background_tasks=background_tasks,
-     user_id=listing.seller_id,
-     type=NotificationType.listing_removed,   # ← wrong kwarg name
-     title="Your listing was removed",
-     body=f'"{listing.title}" was removed ...',
-     link_url="/listings",
-     related_listing_id=listing.id,
- )
+ await notification_service.notify(
+     db,
+     background_tasks,
+     listing.seller_id,
+     NotificationType.listing_removed,
+     title="Your listing was removed",
+     body=f'"{listing.title}" was removed ...',
+     link_url="/listings",
+     email_subject="Your listing was removed from KenaBecha JU",
+     email_body=f'Your listing "{listing.title}" was removed by a moderator.',
+     related_listing_id=listing.id,
+ )
```

### 🐛 BUG-02: `chat_service.list_conversations` — PostgreSQL `DISTINCT ON` syntax
**File:** [chat_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/chat_service.py#L64-L70)

The query uses `.distinct(Message.conversation_id)` which generates `DISTINCT ON (conversation_id)` — a PostgreSQL-specific extension. While this works on PostgreSQL, SQLAlchemy's `.distinct()` on a column without `.order_by` on the same column in the same direction can produce **non-deterministic results**. If the query engine reorders, you may get a non-latest message per conversation.

**Fix:** Add an explicit `ORDER BY conversation_id, created_at DESC` before `.distinct(Message.conversation_id)`.

### 🐛 BUG-03: `is_top` field lacks migration awareness flag
**File:** [listing.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/models/listing.py#L119-L121)

The `is_top` column has `server_default="false"` which is good for new rows, but if the migration wasn't run on an existing database, existing rows will have `NULL` instead of `false`, which could cause `WHERE is_top = false` to exclude those rows unexpectedly. The migration needs to explicitly `UPDATE listings SET is_top = false WHERE is_top IS NULL`.

### 🐛 BUG-04: WebSocket DB session leak risk
**File:** [ws.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/routers/ws.py#L14-L16)

```python
async with async_session_maker() as db:
    user = await get_current_user_ws(access_token, db)
```

The DB session is opened *only* for authentication and immediately closed. But if the user is loaded with `lazy="selectin"` relationships (hall, department), those relationships are eagerly loaded within this session — fine. However, the session is closed before `manager.connect()`, meaning if any downstream code tries to access lazy-loaded attributes on the `user` object, it will raise `DetachedInstanceError`. Currently not triggered but fragile.

### 🐛 BUG-05: `Listing.is_active` not checked in `get_listing`
**File:** [listing_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/listing_service.py#L76-L80)

`get_listing()` checks `listing.deleted_at is not None` but does NOT check `listing.is_active`. Since `delete_listing()` sets both `is_active = False` AND `deleted_at`, this currently works. But if any future code sets `is_active = False` without setting `deleted_at`, the listing will remain visible. Defensive fix: check `is_active` too.

---

## 2. Security Vulnerabilities

> [!WARNING]
> These issues could be exploited by a malicious user.

### 🔒 SEC-01: JWT secret key default is insecure
**File:** [config.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/core/config.py#L14)

`JWT_SECRET_KEY: str = "change-me-in-env"` — if the `.env` file is missing or the variable isn't set, the app runs with a hardcoded secret. Any user who reads this source code can forge tokens.

**Fix:** Raise a startup error if `JWT_SECRET_KEY` equals the default.

### 🔒 SEC-02: No rate limiting on login/signup/OTP/password-reset endpoints
**File:** [auth.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/routers/auth.py)

There's OTP resend cooldown (60s), but no rate limiting on:
- `/auth/login` — brute force attack possible
- `/auth/signup` — mass account creation
- `/auth/forgot-password` — email bombing
- `/auth/google` — no abuse prevention

**Fix:** Add `slowapi` or a custom rate limiter middleware.

### 🔒 SEC-03: Search queries are vulnerable to ILIKE injection patterns
**File:** [listing_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/listing_service.py#L126-L128)

```python
like = f"%{filters.q}%"
query = query.where((Listing.title.ilike(like)) | ...)
```

If `filters.q` contains `%` or `_`, these are interpreted as LIKE wildcards. A search for `%` returns **all listings**. While not a data breach, it's an unintended behavior.

**Fix:** Escape `%` and `_` in user input: `filters.q.replace("%", "\\%").replace("_", "\\_")`

### 🔒 SEC-04: No file content validation in `media_service.save_image`
**File:** [media_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/media_service.py#L18-L35)

The service checks `file.content_type` but this header is **client-controlled** and easily spoofed. A malicious user could upload a `.exe` or malware disguised as `image/jpeg`.

**Fix:** Validate the actual file magic bytes (e.g., using `python-magic` or `Pillow`'s `Image.open()`).

### 🔒 SEC-05: Old uploaded files are never cleaned up
When a user changes their avatar or a shop changes its logo/cover, the old file remains on disk forever. No cleanup logic exists.

**Fix:** Delete old files in `update_avatar()`, `set_logo()`, `set_cover()`.

### 🔒 SEC-06: WebSocket has no heartbeat/ping — zombie connections accumulate
**File:** [manager.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/websocket/manager.py)

If a client disconnects uncleanly (e.g., network drop), the server-side WebSocket stays open indefinitely until the next send attempt fails. This leaks memory and leads to incorrect `is_online()` status.

**Fix:** Implement periodic ping/pong with timeout-based cleanup.

---

## 3. Backend — Logic & Data Bugs

### 📋 LOGIC-01: `browse_listings` doesn't exclude soft-deleted sellers
If a user is deactivated (`is_active=False`), their listings remain visible. Active listings from banned users should be hidden.

### 📋 LOGIC-02: No category/classification system for listings
**Critical missing feature.** Every marketplace (ekhanei.com, OLX, FB Marketplace) has a hierarchical category system. KenaBecha only has freeform tags. Tags are unstructured and user-created, meaning:
- No consistent taxonomy
- No category-based browsing
- No sidebar navigation by category

### 📋 LOGIC-03: `list_shops` always returns max 6 shops
**File:** [shop_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/shop_service.py#L57)

The default `limit=6` is hardcoded in the service. The public API `/shops` endpoint passes this through, meaning users can never browse all shops. There's no pagination for shops.

### 📋 LOGIC-04: Shop listing count has N+1 rating query problem
**File:** [shops.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/routers/shops.py#L38-L42)

```python
for shop, count in shops:
    avg, rcount = await rating_service.get_shop_rating_summary(db, shop.id)
```

This runs one DB query **per shop** for ratings. For 6 shops = 6 extra queries. For a paginated list of 50 shops, this becomes 50 extra queries.

**Fix:** Batch-query ratings in a single SQL using `GROUP BY`.

### 📋 LOGIC-05: User can create unlimited shops
No limit on how many shops a user can own. Could be abused.

### 📋 LOGIC-06: Tag `usage_count` is only incremented, never decremented
**File:** [listing_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/listing_service.py#L31)

When tags are replaced (e.g., editing a listing), old tags' `usage_count` is not decremented. Over time, counts become inaccurate.

### 📋 LOGIC-07: Deleting a listing image doesn't reorder `sort_order`
**File:** [listing_service.py](file:///c:/Users/salman/Desktop/kenabecha-ju/backend/app/services/listing_service.py#L233-L238)

After deleting an image, remaining images may have gaps in `sort_order` (e.g., 0, 2, 3). This could cause ordering issues on the frontend.

### 📋 LOGIC-08: Conversations can exist for soft-deleted listings
No check prevents chatting about a removed/sold listing. Users can still send messages for listings that no longer exist.

### 📋 LOGIC-09: `SoftDeleteMixin` has no query-level filter
Every service that queries soft-deletable models needs to manually add `.where(Model.deleted_at.is_(None))` or `.where(Model.is_active.is_(True))`. This is error-prone — several queries miss this check.

---

## 4. Backend — Missing Features

### ⭐ FEAT-01: Wishlist / Saved Items
**Priority: HIGH** — Every marketplace has this. Users should be able to save/bookmark listings.

### ⭐ FEAT-02: Category System
**Priority: CRITICAL** — Need a hierarchical `Category` model with parent/child relationships. Listings should belong to a category.

### ⭐ FEAT-03: Search Suggestions / Autocomplete
**Priority: MEDIUM** — ekhanei.com has popular search suggestions. We need a `/search/suggestions` endpoint.

### ⭐ FEAT-04: View Count / Analytics per Listing
**Priority: MEDIUM** — Track how many views a listing gets. Show sellers which listings are performing.

### ⭐ FEAT-05: Listing Promotion / Featured Listings
**Priority: MEDIUM** — Beyond `is_top`, need a time-based promotion system (e.g., "Featured for 7 days").

### ⭐ FEAT-06: Seller Verification Badge
**Priority: LOW** — Beyond `profile_complete`, show a "Trusted Seller" badge based on rating history.

### ⭐ FEAT-07: Listing Expiration
**Priority: MEDIUM** — Listings should auto-expire after N days (e.g., 30 days). Seller can renew.

### ⭐ FEAT-08: Search History
**Priority: LOW** — Save recent searches per user for quick access.

### ⭐ FEAT-09: Similar / Related Listings
**Priority: MEDIUM** — On listing detail page, show related listings by tag or category.

### ⭐ FEAT-10: Bulk Image Upload
**Priority: MEDIUM** — Currently images are uploaded one at a time via separate requests. Allow multi-image upload in a single request.

### ⭐ FEAT-11: Listing Share via WhatsApp/Social
**Priority: LOW** — Generate shareable links with OG meta tags for listings.

### ⭐ FEAT-12: Contact via Phone/WhatsApp CTA
**Priority: HIGH** — Backend has `phone` and `whatsapp_number` on User model, but no dedicated endpoint to expose seller contact info to buyers (only visible via user profile page).

### ⭐ FEAT-13: Admin Dashboard Stats — Time-based Charts
**Priority: LOW** — Current stats are single numbers. Need daily/weekly/monthly trends.

### ⭐ FEAT-14: Terms of Service / Privacy Policy pages
**Priority: MEDIUM** — ekhanei.com has comprehensive legal pages. KenaBecha has none.

### ⭐ FEAT-15: Notification Preferences
**Priority: LOW** — Let users choose which notifications they receive via email.

### ⭐ FEAT-16: Backend Tests
**Priority: HIGH** — `backend/tests/` directory is **completely empty**. Zero test coverage. This is a serious risk for production.

---

## 5. Frontend — Bugs & UX Issues

### 🖥️ FE-BUG-01: No loading states on initial page load
Most pages flash a blank screen before data loads. Only a few pages (shop, profile) have `Skeleton` loaders.

### 🖥️ FE-BUG-02: No error boundaries
If any component throws, the entire page crashes with a white screen. No `ErrorBoundary` component exists.

### 🖥️ FE-BUG-03: No 404 page
No custom `not-found.tsx` — Next.js shows a generic 404.

### 🖥️ FE-BUG-04: WebSocket reconnection doesn't re-authenticate
**File:** [client.ts](file:///c:/Users/salman/Desktop/kenabecha-ju/frontend/lib/ws/client.ts#L52-L57)

On reconnect, the WS client creates a new connection but the access token in the cookie may have expired. If the cookie expired during the reconnect delay, the WebSocket will be rejected with code 4401 but the client will keep trying to reconnect forever.

### 🖥️ FE-BUG-05: Chat page — duplicate messages possible
**File:** [inbox/[conversationId]/page.tsx](file:///c:/Users/salman/Desktop/kenabecha-ju/frontend/app/inbox/%5BconversationId%5D/page.tsx#L127-L129)

When sending a message, the response is appended to `messages`. But if the WebSocket `on("message")` fires before the POST response returns, the same message will be appended twice.

**Fix:** Deduplicate by `message.id` before appending.

### 🖥️ FE-BUG-06: Image URLs aren't handled for external URLs
**File:** `mediaUrl()` helper prepends `API_URL` to all image paths. If a Google user's `avatar_url` is an external URL (e.g., `https://lh3.googleusercontent.com/...`), `mediaUrl()` will break it.

### 🖥️ FE-BUG-07: Inbox page has no empty state for unauthenticated users
If a user navigates to `/inbox` without being logged in, they'll see a loading spinner forever (no error handling for 401).

### 🖥️ FE-BUG-08: `reloadProfile` is called but ESLint dependency warning is suppressed
**File:** [profile/[id]/page.tsx](file:///c:/Users/salman/Desktop/kenabecha-ju/frontend/app/profile/%5Bid%5D/page.tsx#L192)

The `// eslint-disable-next-line react-hooks/exhaustive-deps` suppresses a real issue — `reloadProfile` is not in the dependency array and is redefined every render.

---

## 6. Frontend — Missing Features & Pages

### 📱 FE-FEAT-01: No dedicated Browse/Explore page
The landing page shows some listings, but there's no `/browse` or `/listings` page where users can browse with filters, search, and pagination. This is the **core user journey** of any marketplace.

### 📱 FE-FEAT-02: No search page with results
No `/search?q=...` route exists. Users can't search from the navbar.

### 📱 FE-FEAT-03: No "Post Ad" / "Sell" flow entry point in the navbar
The navigation doesn't have a prominent "Sell" or "Post an Ad" button — the primary CTA for any marketplace (ekhanei.com has "ফ্রি বিজ্ঞাপন দিন" prominently in the header).

### 📱 FE-FEAT-04: No footer
No footer exists with links to about, terms, help, etc.

### 📱 FE-FEAT-05: No "All Shops" browse page
Shops can only be seen on the landing page (limited to 6). No `/shops` browse page exists.

### 📱 FE-FEAT-06: No breadcrumb navigation
No breadcrumbs on listing detail, shop, or profile pages.

### 📱 FE-FEAT-07: No image gallery / lightbox on listing detail
Listing images are shown but there's no zoom/fullscreen gallery.

### 📱 FE-FEAT-08: No sharing buttons on listing detail
No way to share a listing via WhatsApp, Facebook, or copy link.

### 📱 FE-FEAT-09: No "Contact Seller" prominent CTA on listing detail
The listing detail page should have a large, prominent "Chat with Seller" / "Call" / "WhatsApp" button section.

### 📱 FE-FEAT-10: No price negotiation UI
`price_type: "negotiable"` exists in the data model but there's no UI to make an offer.

### 📱 FE-FEAT-11: No dashboard for sellers
No `/dashboard` or `/my-listings` page. Sellers can only view their listings from their profile page.

### 📱 FE-FEAT-12: No "Reset Password" page
The backend has `/auth/reset-password`, but there's no `/reset-password` page in the frontend.

### 📱 FE-FEAT-13: No "My Shop" management page
No dedicated page for shop owners to manage their shop (edit details, view analytics, manage listings).

### 📱 FE-FEAT-14: No pagination UI component
Browse APIs return paginated data (`Page<T>`) but the frontend never renders "Load More" or page numbers.

### 📱 FE-FEAT-15: No toast notifications for WebSocket events
WebSocket messages and notifications are received but not shown as toast notifications.

### 📱 FE-FEAT-16: No responsive mobile bottom navigation
ekhanei.com has a mobile bottom nav bar (Home, Search, Sell, Chat, Profile). KenaBecha has none.

### 📱 FE-FEAT-17: No SEO optimization
- No `<meta>` description tags
- No Open Graph tags for social sharing
- No structured data (JSON-LD)
- No `sitemap.xml`
- No `robots.txt`

---

## 7. DevOps & Infrastructure

### 🔧 DEVOPS-01: No production Docker configuration
`docker-compose.yml` only has a `dev` target. No production build with:
- Multi-stage builds for smaller images
- Environment-specific configs
- Health checks for backend

### 🔧 DEVOPS-02: No CI/CD pipeline
No GitHub Actions, no linting checks, no automated tests on push.

### 🔧 DEVOPS-03: No database backup strategy
No `pg_dump` cron, no backup volume.

### 🔧 DEVOPS-04: No logging aggregation
Backend uses `setup_logging()` but logs go to stdout only. No structured logging for production.

### 🔧 DEVOPS-05: `pg_trgm` extension dependency not documented
The listing model uses `gin_trgm_ops` indexes which require `CREATE EXTENSION pg_trgm`. If the extension isn't installed, migrations will fail. This should be documented or added to the migration.

---

## 8. Performance Bottlenecks

### ⚡ PERF-01: N+1 queries in shop listing with ratings
As noted in LOGIC-04, each shop requires a separate rating query.

### ⚡ PERF-02: `selectin` lazy loading on all relationships
Every model uses `lazy="selectin"` which eagerly loads ALL relationships. For `browse_listings()`, this means every listing query also loads: `seller` (+ seller's hall + department), `shop`, `images[]`, `tags[]` — **5 extra queries per listing fetch**.

**Fix:** Use `lazy="raise"` by default and explicit `options(selectinload(...))` only where needed.

### ⚡ PERF-03: No image optimization / thumbnails
Full-size images (up to 5MB) are served directly. No thumbnail generation for listing cards.

### ⚡ PERF-04: Frontend makes no use of caching
No `SWR`, `React Query`, or Next.js ISR/SSR for data caching. Every page navigation refetches all data.

### ⚡ PERF-05: No database connection pooling configuration
The database URL uses default asyncpg settings. No explicit pool size, max overflow, or pool recycle.

---

## 9. i18n / Localization (Bangla + English)

> User requested: "Bangla + English language support"

### 🌐 I18N-01: No i18n framework configured
The frontend `LanguageContext` was started but no actual translations exist. Need:
- Translation JSON files (`en.json`, `bn.json`)
- Language switcher in navbar
- RTL support consideration (Bangla is LTR, so no RTL needed)
- Bangla font (`Noto Sans Bengali` — used by ekhanei.com)

### 🌐 I18N-02: All hardcoded strings need extraction
Every page has hardcoded English strings. Need to extract ~200+ strings.

### 🌐 I18N-03: Date/Time/Currency localization
- Dates should show in Bangla format when language is `bn`
- Currency: `৳` (Taka) symbol needs to be used
- Numbers: Bengali numerals (০১২৩৪৫৬৭৮৯) when in Bangla mode

### 🌐 I18N-04: Backend error messages are English-only
API error messages are all in English. Consider returning error codes that the frontend can translate.

---

## 10. Feature Comparison vs ekhanei.com

| Feature | ekhanei.com | KenaBecha JU | Gap |
|---|---|---|---|
| **Hierarchical Categories** | ✅ Full category tree with counts | ❌ Only freeform tags | 🔴 Critical |
| **Location-based filtering** | ✅ Division → District → Upazila | ❌ No location at all | 🟡 N/A (campus-only) |
| **Search with autocomplete** | ✅ Full search + suggestions | ❌ No search page | 🔴 Critical |
| **Bangla + English** | ✅ Full bilingual | ❌ English only | 🔴 Required |
| **Sticky navbar with search** | ✅ Premium sticky header | ❌ Basic navbar | 🔴 Critical |
| **Category sidebar** | ✅ Sticky sidebar with counts | ❌ None | 🟡 Medium |
| **Hero section with CTA** | ✅ Gradient hero + search | ✅ Partial (in progress) | 🟡 Needs polish |
| **Recent/Featured listings grid** | ✅ 4-column responsive grid | ❌ Basic cards | 🔴 Critical |
| **Listing card with location+time** | ✅ Rich card with badge, time, location | ❌ Minimal card | 🔴 Critical |
| **Footer with quick links** | ✅ 4-column footer | ❌ No footer | 🔴 Critical |
| **Mobile bottom nav** | ✅ Home/Search/Post/Chat/Profile | ❌ None | 🔴 Critical |
| **Post Ad CTA in header** | ✅ Prominent blue button | ❌ None | 🔴 Critical |
| **Login modal** | ✅ Modal with Google/Phone | ❌ Separate page only | 🟡 Medium |
| **Ad management dashboard** | ✅ My Ads with status tabs | ❌ None | 🔴 High |
| **Saved/Wishlist** | ✅ Save for later | ❌ None | 🟡 Medium |
| **Image carousel on listing** | ✅ Swiper carousel | ❌ Basic image list | 🟡 Medium |
| **Seller contact (Call/Chat/WhatsApp)** | ✅ All three | ❌ Chat only | 🔴 High |
| **Quick links / popular searches** | ✅ Tag cloud | ❌ None | 🟡 Low |
| **Loading skeletons everywhere** | ✅ Beautiful pulse skeletons | ❌ Partial | 🟡 Medium |
| **OG meta tags for sharing** | ✅ Full OG support | ❌ None | 🟡 Medium |

---

## 11. Redesign Improvement Summary

### Landing Page (Highest Priority)
- [ ] Sticky glass navbar with search bar, language toggle, "Post Ad" CTA, auth buttons
- [ ] Hero section with gradient (green/teal palette), search, popular tags
- [ ] Featured Shops carousel section
- [ ] Top Products section (admin-curated via `is_top`)
- [ ] Latest Picks grid (4-column responsive)
- [ ] All Products section with "View All" link
- [ ] Category quick-access cards (when category system is built)
- [ ] Stats/trust section (total listings, users, transactions)
- [ ] Footer with 4 columns: About, Quick Links, Categories, Contact

### Browse / Listings Page
- [ ] Left sidebar with filters (category, price range, condition, tags)
- [ ] Sort dropdown (newest, price asc/desc, popularity)
- [ ] Grid/List view toggle
- [ ] Infinite scroll or pagination
- [ ] Active filter chips with clear button

### Listing Detail Page
- [ ] Image gallery with lightbox/zoom
- [ ] Seller info card with rating, "JU Verified" badge
- [ ] Prominent Contact buttons: Chat, Call, WhatsApp
- [ ] Related listings section
- [ ] Report / Share buttons
- [ ] Breadcrumbs

### Seller Dashboard
- [ ] My Listings with status tabs (Active, Sold, Removed)
- [ ] My Shops management
- [ ] Quick stats (views, messages, ratings)
- [ ] Quick create listing button

### Chat / Inbox
- [ ] Split-panel layout (conversations list + chat window) on desktop
- [ ] Online status indicators
- [ ] Typing indicator
- [ ] Image sharing in messages
- [ ] "Seen" receipts

### Auth Pages
- [ ] Modern split-screen layout (illustration + form)
- [ ] Google sign-in prominence
- [ ] Forgot password flow (missing page!)
- [ ] Reset password page (missing!)

### Mobile Experience
- [ ] Bottom navigation bar
- [ ] Pull-to-refresh
- [ ] Swipe gestures for listing cards
- [ ] PWA manifest for "Add to Home Screen"

---

> [!IMPORTANT]
> **Recommended Execution Order:**
> 1. Fix critical bugs (BUG-01 through BUG-05)
> 2. Fix security vulnerabilities (SEC-01, SEC-02, SEC-04)
> 3. Add Category system (FEAT-02) — unlocks sidebar navigation
> 4. Build Browse/Search page (FE-FEAT-01, FE-FEAT-02)
> 5. Redesign Navbar + Footer + Landing Page
> 6. Add Seller Dashboard + missing pages
> 7. Implement i18n (Bangla + English)
> 8. Add tests
> 9. Polish mobile experience
> 10. DevOps + deployment pipeline
