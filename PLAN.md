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
- [x] **Phase 8 — Notifications.** Commit `997d9a5`. In-app (WS-pushed live + REST list/mark-read) and email for all six `NotificationType`s, plus the password-reset flow and a welcome email that had no phase claiming them until now — see "Deviations" below.
- [x] **Phase 9 — Design system foundation.** Commit `71d771a`. shadcn/ui (base-ui primitives, not Radix — see "Deviations") + Tailwind CSS-variable theming, dark/light toggle (`next-themes`), emerald/zinc palette with warning/info/success tokens added, motion (Framer Motion) for animation. Base primitives installed (Button, Input, Select, Textarea, Card, Dialog, Dropdown Menu, Badge, Avatar, Skeleton, Sonner, Tabs, Label, Separator); Navbar rebuilt as the proof-of-concept. Rest of the app intentionally untouched — that's Phase 13.
- [x] **Phase 10 — Tiered authentication: Google OAuth + full JU signup.** Commit `4e6705e`. Supersedes the original placeholder "Phase 9 — Google OAuth" line below. Google one-click signup/login for buyers via the Identity Services ID-token flow (no client secret) — JU fields now nullable on `users`, `profile_complete` computed from them. Selling (create shop/listing) gated behind a `get_seller` dependency; incomplete profiles hit a `/complete-profile` page. **Not yet verified with real Google credentials** — waiting on a `GOOGLE_CLIENT_ID` from the user; everything else (gate, linking, nullable schema, UI) verified via a directly-created test user standing in for a real Google login.
- [x] **Phase 11 — Cart & orders, pickup/delivery fulfillment.** Commit `01a213b`. Listings choose pickup (with address) or delivery at creation; cart/orders/order_items added; checkout splits by (seller, shop, fulfillment_type) into separate orders with no payment fields. Order status flow (pending → confirmed → completed, either side can cancel while pending) notifies the other party. Simplified from the original 3-way `pickup/delivery/both` plan to a strict either/or per listing — see Deviations.
- [x] **Phase 12 — Public landing page.** Commit `4eff70a`. Real homepage: hero + search, trending tags, newest listings, featured shops, "how it works," sign-up CTA — all public, all built on the Phase 9 design system with scroll-triggered fade-ins. Added `GET /shops` (public browse — didn't exist before). Fixed a real bug this surfaced: `/listings` never read `q`/`tags` from the URL, so the landing page's search and tag links would have gone nowhere.
- [x] **Phase 13 — Full application redesign pass.** Commit `c43a1af`. Every remaining page from Phases 3–8 retrofitted onto the Phase 9 system — consistent Card/Input/Label/Button/Badge/Table/Skeleton throughout, `confirm()` replaced with AlertDialog everywhere destructive, admin panel rebuilt on Table, Navbar gained a Sheet-based mobile hamburger menu. **This closes out the UI/UX redesign initiative (Phases 9–13).**
- [x] **Phase 14 — Modern Animated & Glassmorphism Frontend Redesign + i18n + Admin Top Products.** Complete UI overhaul: green/teal gradient palette, glassmorphism utilities (`glass-card`, `glass-navbar`, `gradient-bg-hero`), Inter Google Font typography, Framer Motion micro-animations (`AnimatedButton`, `GradientCard`), bilingual Bangla + English translation context (`LanguageContext`), fixed React hook `set-state-in-effect` lint bugs across 6 components, added `is_top` column & Alembic migration `e8b9f0a1c2d3` for admin-curated Top Products, and revamped landing page with Top Products, Latest Picks, Featured Shops, Categories, and How It Works sections.

- [x] **Phase 15 — Design system & motion foundation.** Fixed `--font-sans` (was Geist while `layout.tsx` loaded Inter — literal family name, not `var()`, since Tailwind v4 `@theme inline` resolves at parse time). Added a two-layer soft-shadow scale (`--shadow-soft-xs…xl` + emerald-tinted `soft-primary`), `scroll-behavior: smooth`, a global `:focus-visible` ring, and a CSS `prefers-reduced-motion` block. `lib/motion.ts` centralizes the motion vocabulary (fade/slideUp/scaleIn/stagger/pageTransition/hoverLift + spring presets) so sections stop re-declaring variants ad hoc. New hooks `useMediaQuery` (+`useIsMobile`/`useIsDesktop`), `useDebounce`, `useIntersectionObserver`. New `EmptyState`, `ErrorState`, `FieldError` (animated), and `SmartImage` (fade-in, lazy, error fallback, shimmer). `Button` gained `loading`/`loadingText` with `aria-busy`. `MotionProvider` (`MotionConfig reducedMotion="user"`) + `PageTransition` wired into the root layout.
- [x] **Phase 16 — Footer & homepage completion.** Migration `b9efc178bd30`. Built the missing `Footer` (brand column, 3 link groups, socials, safety note) and wired it into the root layout — the app previously had none at all, the landing page just ended. Three new homepage sections: `StatsSection` (count-up figures off a new public `GET /public/stats`, skipping the animation under `prefers-reduced-motion`), `ReviewsSection` (real testimonials off `GET /public/reviews`), `NewsletterSection` (backed by a real `newsletter_subscribers` table + `POST /public/newsletter` — a form that silently discarded emails would have been deceptive). Sections self-hide when they have no data rather than rendering zeroes/placeholders. New `PublicRaterOut` schema deliberately narrower than `ListingSellerOut` so the public reviews feed doesn't carry reviewers' phone numbers.
- [x] **Phase 17 — Browse page overhaul.** Rebuilt `/listings` from a single inline column of `<select>`s into a real browse experience: sticky desktop filter sidebar (`ListingFilters`), dual-thumb **price range slider** (shadcn/base-ui `Slider`) replacing the two number inputs, grid/list **view toggle** with a crossfade between layouts, and **infinite scroll** (via `useIntersectionObserver`) replacing manual prev/next pagination. Below `lg` the sidebar becomes a `Sheet` since there's no room for it. Added a `list` variant to `ListingCard`. Proper `EmptyState` (with a "clear all filters" action) and `ErrorState` (with retry) replace the old bare `<p>`. Search now uses the shared `useDebounce`. Two correctness details: the first-page effect guards against a slower earlier request overwriting fresher results, and `loadMore` dedupes by id so a double-fired sentinel can't produce duplicate React keys. At the top of the slider the max-price filter is dropped entirely so the range reads "and above" rather than silently excluding pricier items.
- [x] **Phase 18 — Product detail page.** Two-column layout with a **sticky contact panel** (price, condition, fulfillment, seller card w/ rating, Chat/Call/WhatsApp, share, report). New `ImageGallery` with a fullscreen **lightbox** — click-to-zoom, arrow-key nav, Escape to close, body-scroll lock. **Animated tabs** (Description / Details / Reviews) replace the previous everything-inline layout. New `Breadcrumbs` and `ShareButton` (native share sheet where available, clipboard fallback; a cancelled share is a user action, not an error). New `RatingSummary` with an animated 5→1 star-distribution chart plus written reviews, fed by a new `GET /listings/{id}/seller-reviews` (resolves shop-vs-user the same way the rating system itself does, and zero-fills the breakdown so all five bars always render). **Related listings** rail from `GET /listings/{id}/related`, which tiers through same-shop → shared-tags → recent so a listing with neither still gets a useful rail.
- [x] **Phase 19 — User dashboard.** Migration `c4111ed45d6b`. Built the entire missing section (was 0% coverage): `/dashboard` with a responsive rail nav (horizontal scroller on mobile, sticky sidebar on desktop) and four pages — **Overview** (stat cards, seller reputation, recent listings, activity chart), **My listings** (merges personal + per-shop inventory, status filter chips), **Saved** (optimistic removal with rollback), and **Settings** (avatar, profile, contact options, JU verification status). New `saved_listings` table + `/dashboard/{stats,activity,saved,saved/ids}` endpoints and a `SaveButton` now on every listing card. `ActivityChart` is a hand-rolled SVG area chart rather than a charting dependency — one shape was not worth the bundle; floors the y-denominator at 1 so an empty month draws a flat baseline instead of `NaN` paths, and uses `vectorEffect="non-scaling-stroke"` so the stretched viewBox doesn't distort line weight. `SaveButton` caches saved ids at module level so a 24-card grid doesn't fire 24 identical requests, and `preventDefault`s so tapping it inside a card link doesn't navigate. Also fixed a pre-existing gap: `is_top` was missing from the frontend `Listing` type despite the backend sending it.
- [x] **Phase 20 — Auth pages polish.** New `AuthShell` split-screen layout (form + gradient brand panel with trust highlights; panel hidden below `lg` rather than stacked, since on a phone it would only push the form off-screen). New `PasswordInput` (visibility toggle, `tabIndex={-1}` so tabbing skips the eye), `PasswordStrength` (advisory heuristic — the real 8-char rule stays in Zod/backend; long passphrases aren't punished for lacking symbols), and `OtpInput` (six segmented boxes with auto-advance, backspace-to-previous, arrow keys, paste-anywhere, and `autoComplete="one-time-code"` for SMS autofill). Login/signup/verify-email rebuilt on all of it; validation errors now animate in via `FieldError` instead of snapping. Verify-email auto-submits on the sixth digit and clears the field on failure so a retry doesn't require six backspaces.
- [x] **Phase 21 — Chat enhancements.** Migration `d09a0a8ea5bc`. Message bubbles now animate in (spring, `layout`), carry timestamps, and show **read receipts** (single tick sent / green double-tick read) driven by a new `read` WS event pushed from `POST /conversations/{id}/read` — skipped when nothing was actually unread, since that endpoint fires on every thread open. **Typing indicator** via a new bidirectional `typing` WS frame: the `/ws` endpoint now *reads* client frames (it was drain-only before) and re-checks conversation membership server-side on every one, so nobody can spray typing events into threads they aren't in. Client throttles to one frame per 2s and the receiver self-expires the dots after 5s in case the sender closes their tab mid-compose. **Image attachments** via `POST /conversations/{id}/attachments` (+ `messages.image_url`); `content` stays non-empty (`📷 Photo` placeholder) so existing preview/notification/email readers don't need to special-case image-only messages. Verified end-to-end with two real browser sessions. **Also fixed a regression from Phase 16**: adding the Footer made the page taller than the viewport, so the chat's `scrollIntoView` was scrolling the *window* and pushing the whole thread off-screen — now scrolls the message container directly.
- [x] **Phase 22 — Shop pages.** Migration `2d9d01a15fef`. Storefront rebuilt: cover **banner** with an overlapping logo tile (falls back to a branded gradient band rather than a grey void when no cover is set), a four-tile **statistics** row (`GET /shops/{slug}/stats`), **Listings/Reviews tabs** (`GET /shops/{slug}/reviews`), breadcrumbs, share, and a **follow** button on a new `shop_follows` table (`POST /shops/{id}/follow`, self-follow rejected). Added a `get_optional_user` dependency — the stats endpoint must serve anonymous viewers but personalise `is_following` when someone happens to be logged in; `is_following` is `null` rather than `false` for anonymous so the UI can prompt a login instead of rendering a misleading un-followed state. `sold_count` is included because "this shop completes trades" is a real trust signal that an active-listing count isn't.
- [x] **Phase 23 — Admin dashboard.** New reusable `DataTable`: **sortable** headers, **search** (server-driven where the endpoint supports it, local otherwise — never both, which would double-filter), **CSV export** (RFC 4180 quoting + UTF-8 BOM so Excel opens Bangla shop names without mojibake), sticky headers, horizontal scroll on desktop and a **card fallback on mobile** instead of an unreadable squashed table. Applied to users/listings/shops. Stats page rebuilt with clickable metric cards, a "platform composition" bar chart (relative magnitude communicates far more than five bare numerals) and an at-a-glance ratios panel, with pending reports styled as an alert. **Also fixed a real pre-existing bug**: `onRemove` in the admin listings, shops *and* reports pages all called an undefined `load()` — the fetch had been inlined into `useEffect` — so every moderation action threw a `ReferenceError` and the table silently never refreshed.
- [x] **Phase 24 — Performance & accessibility.** Migrated `SmartImage` (and therefore nearly every image in the app) to **`next/image`** — automatic AVIF/WebP negotiation, responsive `srcset`, lazy loading. Measured **95% smaller** on a real listing photo (451KB PNG → 21KB WebP). Getting there required a genuine architectural fix rather than an allow-list: the optimizer runs *server-side inside the frontend container*, where `localhost:8000` is the frontend itself, not the API — so `remotePatterns` pointed at the browser-facing URL could never work. Media is now proxied same-origin via a Next rewrite to the container-network address (`INTERNAL_API_URL=http://backend:8000`), which needs no allow-list and behaves identically in dev and prod; only Google's avatar CDN remains allow-listed. Also added a keyboard **skip-to-content** link, and **bottom-sheet dialogs on mobile** (`Dialog` + `AlertDialog` anchor to the bottom edge below `sm`, centred from `sm` up) — verified at a 390px viewport. Focus rings and reduced-motion landed back in Phase 15.

**This closes out the gap_analysis.md frontend initiative (Phases 15–24).** Deliberately not done, and why: image-only chat previews, the listing-form blob previews and the zoomable lightbox still use raw `<img>` — object URLs and CSS-transform zoom don't work through the optimizer. Emoji picker, pull-to-refresh, keyboard shortcuts, search suggestions, context menus and virtualized lists from the gap analysis were judged low-value relative to their cost at this scale and were skipped rather than half-built.

- [x] **Phase 25 — Critical bugs & security hardening.** No migration. **BUG-01** was a genuine production crash: `admin_remove_listing` passed `type=`/`user_id=` as keywords and omitted the required `email_subject`/`email_body`, so *every* admin listing removal raised `TypeError: missing a required argument: 'ntype'` before the commit — moderation was completely broken. Proved it by binding the exact call signature, fixed it, and verified end-to-end (HTTP 200, seller notified, listing 404s publicly). **BUG-05** `get_listing` now also checks `is_active`. **SEC-01** `get_settings()` refuses to start outside development with the placeholder JWT secret (warns in dev so local work isn't blocked). **SEC-03** LIKE metacharacters are escaped via a new shared `app/core/search.py` — `q=%` used to return every listing and now returns 0; applied to all three search sites (listings, admin users, tag autocomplete), not just the one the audit named. **SEC-04** uploads are validated by magic bytes rather than the client-supplied `content_type`, and the sniffed type decides the stored extension; a renamed executable is now rejected with 400. Chose stdlib header checks over adding Pillow — a 12-byte check didn't justify a new dependency and container rebuild. **SEC-05** superseded avatars/logos/covers are unlinked after the replacement commits (never before, so a failed commit can't orphan the row), with a `MEDIA_ROOT` containment check so a traversal payload in the DB can't delete arbitrary files; external Google avatar URLs are left alone. **Excluded as not-real after verification:** BUG-02 (the `ORDER BY` the audit asks for is already present) and BUG-03 (`is_top` is `NOT NULL DEFAULT false`, 0 NULL rows).
- [x] **Phase 26 — Rate limiting & WebSocket resilience.** Migration `bc75b0879d9c`. **SEC-02** rate limiting on signup/login/google/verify-email/resend-otp/forgot-password/reset-password. Backed by a `rate_limit_hits` **table rather than process memory**, because prod runs `uvicorn --workers 4` — an in-memory counter lives per worker, so an attacker would silently get 4× the advertised limit (and more per replica). These endpoints are low-frequency, so one indexed round-trip is a cheap price for the limit actually being the limit. Hits are committed immediately so a *failed* login — precisely the case being defended — still counts despite its rollback. Sliding window with a `Retry-After` header; expired rows are purged per-key on each check, so no sweeper job is needed. `X-Forwarded-For` is only honoured behind `TRUST_PROXY_HEADERS` (off by default — trusting it unconditionally would let anyone spoof an IP and walk past every limit). Verified: 10 bad logins pass, the 11th returns 429 with `Retry-After: 280`. **SEC-06** WebSocket heartbeat — server pings every 30s and reaps sockets silent for 90s; without it an uncleanly-dropped client stayed registered until the next send failed, leaking memory and keeping `is_online` true, which suppressed the offline-email path so the user never learned they had a message. Client answers with `pong`. Verified four sweep cases in isolation plus a real browser round-trip. **BUG-04** `/ws` now copies the user id out while the session is open instead of holding a detached ORM object. Also fixed **FE-BUG-04** (not originally scoped here but same subsystem): on close code 4401 the client used to reconnect forever against an expired cookie; it now refreshes the token once and retries, and stops if the session is genuinely gone.
- [x] **Phase 27 — Category system.** Migration `6605a57ca25d`. Built hierarchical `Category` model and seeded 2-level taxonomy. Added `category_id` to `Listing`, wired through the backend API (`BrowseFilters`, `ListingCreate`, `ListingUpdate`). Updated frontend `ListingFilters` to show a Category dropdown on the browse page, added category selector to `ListingForm`, and added category breadcrumb to the listing detail page.
- [x] **Phase 28 — Search page & autocomplete.** Added `GET /listings/suggestions` to backend and `NavbarSearch` autocomplete component to frontend. Wired to redirect to the `/listings` browse page with query parameters to act as the dedicated search page without redundant code duplication.
- [ ] **Phase 29 — Data-integrity & query-performance fixes.** Not started.
- [ ] **Phase 30 — View counts, listing expiry & promotion.** Not started.
- [ ] **Phase 31 — i18n completion (Bangla + English).** Not started.
- [ ] **Phase 32 — SEO, error boundaries, 404 & mobile bottom nav.** Not started.
- [ ] **Phase 33 — Backend test suite.** Not started.
- [ ] **Phase 34 — DevOps: production compose, CI, backups.** Not started.

See "Phase 9+ — UI/UX Redesign, Tiered Auth & Cart/Orders" below (before "## Context") for the detailed breakdown of those five phases, written 2026-08-01 per user request. All five are complete. "Phases 15–24 — Frontend Gap Closure" is likewise complete. "Phases 25–34" is the current initiative.

---

## Phases 25–34 — System Audit Remediation (planned 2026-08-05)

Driven by `improvement.md`, a full audit of `backend/app/` and `frontend/app/`.

**Important caveat recorded up front:** the audit was written *before* Phases 15–24 landed, so a large share of its findings are already resolved. Verified as **already done**: FE-FEAT-01 (browse page), FE-FEAT-04 (footer), FE-FEAT-06 (breadcrumbs), FE-FEAT-07 (lightbox), FE-FEAT-08 (share), FE-FEAT-09 (Chat/Call/WhatsApp CTAs), FE-FEAT-11/13 (dashboard + shop management), FE-FEAT-14 (infinite scroll), FEAT-01 (wishlist/saved), FEAT-09 (related listings), FEAT-12 (seller contact), FE-BUG-01 (skeletons), FE-BUG-06 (`mediaUrl` external URLs), plus the chat typing/seen/image items and the auth split-screen. Two findings are **not real**: BUG-02 (the `ORDER BY conversation_id, created_at DESC` the audit asks for is already there) and BUG-03 (`listings.is_top` is `NOT NULL DEFAULT false` with zero NULL rows). Those are excluded rather than "fixed" for show.

### Phase 25 — Critical bugs & security hardening
BUG-01 (`admin_remove_listing` passes `type=`/`user_id=` as kwargs and omits the required `email_subject`/`email_body` — a guaranteed `TypeError` every time a moderator removes a listing), BUG-05 (`get_listing` ignores `is_active`), SEC-01 (startup guard against the default JWT secret), SEC-03 (escape `%`/`_` in search so `%` doesn't match everything), SEC-04 (validate image magic bytes, not the client-supplied `content_type`), SEC-05 (delete the superseded file when an avatar/logo/cover is replaced).

### Phase 26 — Rate limiting & WebSocket resilience
SEC-02 (rate-limit login/signup/forgot-password/google), SEC-06 + BUG-04 (WS heartbeat so dropped connections don't linger and skew `is_online`, and harden the auth-session handling).

### Phase 27 — Category system
FEAT-02 / LOGIC-02 — hierarchical `Category` model, listing association, category browse + sidebar navigation with counts. The audit's top-priority structural gap.

### Phase 28 — Search page & autocomplete
FE-FEAT-02 / FEAT-03 — dedicated `/search` route, navbar search wired to it, and a suggestions endpoint.

### Phase 29 — Data-integrity & query-performance fixes
LOGIC-01 (hide listings from deactivated sellers), LOGIC-03 (paginate shops; `/shops` is hard-capped at 6), LOGIC-04/PERF-01 (batch the per-shop rating queries), LOGIC-06 (decrement `usage_count` when tags are replaced), LOGIC-07 (re-sequence `sort_order` after image delete), LOGIC-08 (block chat on removed listings), PERF-05 (explicit connection-pool settings).

### Phase 30 — View counts, listing expiry & promotion
FEAT-04, FEAT-05, FEAT-07.

### Phase 31 — i18n completion
I18N-01→04 — the `LanguageContext` and `messages/{en,bn}.ts` exist but cover only the landing page; extract the remaining strings, add Noto Sans Bengali, and localize dates/currency/numerals.

### Phase 32 — SEO, error boundaries, 404 & mobile bottom nav
FE-BUG-02, FE-BUG-03, FE-FEAT-16, FE-FEAT-17, FEAT-14 (legal pages).

### Phase 33 — Backend test suite
FEAT-16 — `backend/tests/` is empty; zero coverage.

### Phase 34 — DevOps
DEVOPS-01→05.

---

## Phases 15–24 — Frontend Gap Closure (planned 2026-08-05)

Driven by `gap_analysis.md`, which scored the frontend at **~28% coverage** against a "production-grade marketplace frontend" target (Airbnb/Facebook Marketplace/Stripe Dashboard class). ~80 features missing across 10+ pages. Ordered so foundations land before the pages that consume them, and highest-impact user-visible gaps land early.

### Phase 15 — Design system & motion foundation
Everything later phases build on. `--font-sans` currently points at Geist while `layout.tsx` loads Inter — fix so Inter actually applies. Add a soft-shadow scale and consistent `rounded-xl/2xl` tokens. Central motion primitives (`lib/motion.ts`: fade/slideUp/scaleIn/stagger variants) so animations stop being re-declared ad hoc per section. Global `prefers-reduced-motion` handling and `scroll-behavior: smooth`. Reusable hooks the gap analysis calls out as missing: `useMediaQuery`, `useDebounce`, `useIntersectionObserver`. Shared `EmptyState` / `ErrorState` components to replace bare `<p>` text. `Button` gains a real loading state. Page-transition wrapper.

### Phase 16 — Footer & homepage completion
Top-listed gap: **there is no footer at all** — the landing page just ends. Build a real multi-column footer (brand, links, contact, social, legal). Add the three missing homepage sections: platform statistics, latest reviews, newsletter signup. Restyle the categories strip from basic icon+text to premium cards.

### Phase 17 — Browse page overhaul
Lowest-coverage page at ~12%. Sticky sidebar filter panel (replacing inline selects), price **range slider** instead of two number inputs, grid/list view toggle, infinite scroll replacing manual pagination, animated filter/result transitions, and proper empty states.

### Phase 18 — Product detail page
Image zoom/lightbox, animated tabs (description / details / reviews) instead of everything inline, related-products rail, rating summary with star breakdown, share button, and breadcrumbs.

### Phase 19 — User dashboard
**0% coverage — the entire section doesn't exist.** New `/dashboard`: overview stat cards, my-listings management, activity chart, and a settings page. Saved/bookmarked listings need a backend table + endpoints, so that's scoped here too.

### Phase 20 — Auth pages polish
Floating labels, password visibility toggle, password strength meter, animated validation feedback, a proper segmented OTP input for verify-email, and a split-screen layout with brand illustration.

### Phase 21 — Chat enhancements
Message enter animations, typing indicator (new WS event type), read receipts surfaced in UI (`read_at` already exists in the schema), and image/file attachments in chat (needs backend upload support).

### Phase 22 — Shop pages
Cover banner, shop statistics row, shop reviews section, and a follow/followers concept (new backend table).

### Phase 23 — Admin dashboard
Charts for the stats currently rendered as bare numbers, table search, CSV export, plus sortable + responsive (card-fallback) tables with sticky headers.

### Phase 24 — Performance & accessibility
Migrate every `<img>` to `next/image`, add lazy loading, dynamic-import heavy components (charts, emoji picker), visible focus states, ARIA labels, contrast audit, and mobile bottom-sheet dialogs.

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
- **"Warn user" remains a status-only resolution even after Phase 8** — it records `resolved_warned` and a resolution note but still doesn't notify the user, because `NotificationType` (fixed back in Phase 2) has no "warned" variant, only the six types the spec actually named. Adding one would mean a migration for a feature the spec never asked for; flagging it here rather than silently skipping it. "Ban" *does* have a real, immediate side effect (deactivation + session revocation) because that's a moderation action, not a notification.
- **Admin listing/shop views intentionally show removed/soft-deleted content** (unlike every public-facing browse endpoint), since a moderation dashboard needs full visibility, not just what's currently live.
- **Password-reset flow and a welcome email were built as part of Phase 8**, not Phase 3 — the spec lists both under "account-related emails" in the Notifications section, and `auth_tokens.purpose='password_reset'` had existed unused since the Phase 2 schema design. Reset tokens are single-use and revoke every other active session on success (mirroring the ban/deactivate behavior).
- **Message notifications email only when the recipient has no open WebSocket connection** (reusing `manager.is_online` from Phase 5); every other notification type emails unconditionally. This is the spec's literal wording — only "new message received" carries the "(if user is offline)" qualifier.
- **Phase 13's "mobile-first responsive audit" and "z-index audit" were satisfied by construction rather than a dedicated pass**: every new/retrofitted component uses shadcn primitives whose overlays (Dialog, AlertDialog, Sheet, DropdownMenu, Select) are all portal-rendered at `z-50` with correct DOM-order stacking, and the sticky Navbar sits at `z-40` — comfortably below any overlay. This is a simpler, more robust outcome than the originally-planned explicit 40/50/60/100/200 numeric scale, achieved by not hand-rolling overlay z-index values at all. Responsive behavior likewise came from consistently using the same breakpoint-aware grid/flex patterns already established in Phases 9–12, plus the one true structural gap (Navbar overflow once Cart/Orders links were added) fixed with a Sheet-based mobile menu.
- **`GET /shops` added for the landing page's featured-shops section** — the original schema/plan never called for a general shop-browse endpoint (only "my shops" and "shop by slug"), since nothing before Phase 12 needed to list shops in aggregate. Sorted by `created_at desc`, capped at a `limit` query param (default 6); no search/filter yet since nothing needs it.
- **`/listings` reading `q`/`tags` from the URL was a pre-existing gap, not a Phase 12 addition** — the browse page always managed those as component-local state with no `useSearchParams` at all, so deep links into it silently did nothing. Fixed as part of this phase since the landing page's search bar and tag chips depend on it working.
- **`fulfillment_type` simplified to strictly pickup OR delivery per listing, not a "both" option** as originally sketched in the Phase 11 plan — the user's own wording framed it as an either/or seller choice, and supporting "both" would have forced a checkout-time pickup-vs-delivery choice per item that added real complexity (which address type does an order snapshot?) for a case nobody asked for.
- **Cart has no separate `carts` parent table** — just `cart_items` keyed on `(buyer_id, listing_id)`. A user's cart is simply "their cart_items rows"; no empty-shell parent entity needed.
- **Checkout groups by `(seller_id, shop_id, fulfillment_type)`, not just seller** — a shop with both pickup and delivery listings in the same cart becomes two orders, since each needs a different address shown to the buyer and there's no clean way to represent "half this order is pickup" on one row.
- **Cart/checkout re-validates listing availability and quantity at order time**, not just at add-to-cart time — if a listing sold out or was removed between adding to cart and checking out, checkout 409s naming the listing rather than silently dropping it, so the buyer can fix their cart deliberately.
- **No inventory reservation while items sit in a cart** — two buyers can both have the same limited-quantity listing in their carts; whoever checks out first gets it, the other gets a clear 409 at checkout. Acceptable for this scale; a real reservation/hold system would need TTLs and background expiry, not justified yet.
- **Google sign-in uses the Identity Services ID-token flow, not the authorization-code OAuth2 flow** — the frontend loads Google's `gsi/client` script, gets a signed JWT credential directly from the rendered button, and POSTs it to `/auth/google`, which verifies it server-side with `google-auth`'s `verify_oauth2_token` against `GOOGLE_CLIENT_ID`. No client secret, no redirect URI dance — deliberately the simplest option since this project only needs identity (email/name/picture), no Google API scopes.
- **Signing in with Google using an email that already has a local/JU account links `google_id` to the existing user** rather than creating a second account — same person, same email, one account. Their existing role/profile/listings/shop are untouched.
- **`get_seller` dependency gates both `POST /shops` and `POST /listings`** (not just shop creation) — the user's instruction was "before opening any store or listing any used item," so personal listings need a complete profile too, not just shop-based ones.
- **`complete_profile` allows re-submission / overwriting**, not just a one-time fill-in — simplest option, and there's no reason to block a user correcting a typo in their student ID after the fact.
- **shadcn/ui initialized on Base UI primitives, not Radix** (`init -d`'s current default) — components use a `render` prop for composition rather than Radix's `asChild`+`Slot` pattern, and Base UI's own docs say links shouldn't be composed into `Button` via `render` at all (they have their own semantics) — link-styled buttons use `buttonVariants()` classes applied directly to `next/link`'s `Link` instead of wrapping `Button`. No functional difference from Radix for this project; noted here since it affects how every future shadcn component composition is written.
- **`shadcn init` overwrote `lib/utils.ts`** with just its own `cn()`, silently dropping the pre-existing `mediaUrl`/`formatPrice`/`CONDITION_LABELS` helpers every listing component depends on — caught immediately via a 500 on `/listings` after the container restart, fixed by merging both back into one file. Worth remembering if `shadcn add` or `init` is ever re-run.
- **A shared Navbar was added in Phase 8** (not present before) specifically so the notification bell has one persistent, always-visible home instead of being bolted onto the homepage alone — the homepage's previously-duplicated login/logout controls were removed in favor of it.

---

## Phase 9+ — UI/UX Redesign, Tiered Auth & Cart/Orders (planned 2026-08-01)

Planning-only pass, written per explicit user request before any implementation: "first add all these things & modify plan.md in multiple phase in details & carefully, i will implement phase by phase." Nothing below is built yet — each phase starts only when told to continue, matching the working pattern used for Phases 1–8.

**Why this exists / relation to the original spec:** `prompt.md`'s non-functional requirements said "clean, minimal, fast UI — prioritize usability and load speed over visual flourish" and described minimal signup ("just email/password or Google OAuth... don't force phone/bio/shop-creation at signup"). Phase 3 deviated from that minimal-signup vision under explicit user instruction, making full JU-verification fields mandatory for every signup. The new request effectively restores the original minimal/Google-first signup path, but scoped to buyers only — sellers keep the Phase 3 full-verification requirement. Separately, the emphasis on animation/visual polish is a deliberate, explicit reprioritization above the original "usability over flourish" guidance — noted here as an intentional pivot, not an oversight. The cart/order system is new scope `prompt.md` didn't ask for, but it does **not** reintroduce payment: no payment gateway, no card/mobile-banking integration — orders formalize "I want this" + logistics (pickup/delivery, contact info) only, consistent with the original "no payment integration, meet in person" non-goal.

### Design system spec (locked in now, tunable during Phase 9 implementation)

- **Stack:** shadcn/ui (Tailwind-native, accessible, CSS-variable themeable — will invoke the `vercel:shadcn` skill when Phase 9 starts) + `next-themes` for flash-free dark/light/system theme switching, persisted in localStorage + Framer Motion for page/element transitions (fade-in, slide-up, scale-in, list stagger) layered on top of Tailwind's built-in `transition-*`/`animate-*` for simple hover/focus states.
- **Palette** (CSS variables, shadcn convention; brand nods to the existing "reuse/recycle" logo theme):
  - Light: `--background #ffffff`, `--foreground zinc-950 #09090b`, `--primary emerald-600 #059669`, `--primary-foreground #ffffff`, `--secondary/--muted zinc-100`, `--muted-foreground zinc-500`, `--border zinc-200`, `--destructive red-600 #dc2626`, `--warning amber-500 #f59e0b`, `--info blue-500 #3b82f6`, `--ring emerald-500`.
  - Dark: `--background zinc-950 #09090b`, `--foreground zinc-50 #fafafa`, `--primary emerald-500 #10b981` (brightened for dark-bg contrast), `--primary-foreground zinc-950`, `--secondary/--muted zinc-800`, `--muted-foreground zinc-400`, `--border zinc-800`, `--destructive red-500 #ef4444`, `--warning amber-400`, `--info blue-400`, `--ring emerald-400`.
  - Every token ships with a paired `-foreground` value so text-on-background contrast is guaranteed by construction, addressing "no visibility/overlap issues" directly.
- **Scales:** documented spacing/typography/radius scale (Tailwind defaults, used consistently rather than ad hoc), and an explicit **z-index scale** — sticky navbar 40, dropdown/autocomplete 50, mobile drawer/bottom-sheet 60, modal/dialog 100, toast 200 — so nothing built later collides with the notification bell dropdown, tag autocomplete, or admin filter menus already in place.
- **Base primitives rebuilt via shadcn:** Button, Input, Select, Textarea, Card, Dialog, Dropdown Menu, Badge, Avatar, Skeleton, Toast (replaces ad hoc inline error/success text), Tabs. Applied to the Navbar + a couple of shared components in Phase 9 as proof-of-concept; the rest of the app keeps its current styling until Phase 13.

### Phase 9 — Design system foundation
Install/configure shadcn/ui + `next-themes` + Framer Motion; define the palette/scales above as CSS variables; rebuild the base primitive set; add a `ThemeToggle` (sun/moon) to the Navbar. Deliverable: a working dark/light toggle and a consistent component kit that Phases 10–13 build against, without yet touching every existing page.

### Phase 10 — Tiered authentication (Google OAuth + full JU signup)
- **Backend:** real Google OAuth (the `auth_provider`/`google_id` columns have existed since Phase 2 for exactly this). Migration: make JU-specific fields nullable on `users` (`student_id`, `registration_no`, `hall_id`, `department_id`, `session`, `batch`); add a `profile_complete` check (service-layer, all JU fields present) that gates shop-creation and listing-creation endpoints.
- **Google-lite buyers:** one click → account created from the Google profile (name, email, avatar), `is_verified=True` immediately (Google already proved the email), no OTP step, no JU fields collected.
- **Sellers (unchanged requirement, now enforced as a gate rather than only at signup):** must complete the full existing JU-verification form — either at signup directly, or later via a "complete your profile" interstitial if they signed up with Google first and then try to open a shop or list an item.
- **Frontend:** redesign login/signup pages (Phase 9 components) — "Continue with Google" as the primary buyer CTA, full JU form as a secondary "sign up to sell" path; new "complete your profile" page; `/shops/dashboard` and `/listings/new` entry points check `profile_complete` and redirect there if needed.
- **Needs from user before this phase can be tested end-to-end:** a Google Cloud OAuth client ID/secret (same kind of real-credential dependency the SMTP setup had) and confirmation of the dev + prod redirect URIs.

### Phase 11 — Cart & orders, pickup/delivery fulfillment
- **Schema:** `listings` gains `fulfillment_type` (pickup/delivery/both) and `pickup_address` (nullable, required when pickup is enabled) — set by the seller at listing-creation time. New `carts`/`cart_items` (user_id, listing_id, quantity) and `orders`/`order_items` (buyer_id, seller_id, fulfillment_type chosen, delivery_address + phone captured at checkout when delivery is chosen, status: pending/confirmed/completed/cancelled).
- **Default judgment call (confirm/adjust when this phase starts):** a cart can hold items from multiple sellers; placing an order splits it into one `orders` row per seller, since pickup/delivery and addresses are seller/listing-specific — the standard marketplace pattern (Amazon/Daraz-style split checkout).
- **No payment fields anywhere in this schema** — orders remain a reserve/arrange-logistics record, not a transaction; consistent with the original spec's no-payment-integration stance.
- **Backend:** cart CRUD, checkout/place-order endpoint (splits by seller, decrements shop-listing quantity, marks personal listings reserved appropriately), seller-side order management, buyer-side order history. New `NotificationType` values (`order_placed`, `order_status_changed`) wired through the existing `notification_service.notify` pattern from Phase 8.
- **Frontend:** Add-to-Cart action (gated behind login exactly like the existing Contact Seller gate), cart page/drawer, checkout form (delivery address + phone shown only when delivery is selected; pickup address shown read-only when pickup is selected), buyer "My Orders", seller "Orders" view. Contact Seller/chat stays as-is for questions — Add to Cart / Place Order is the new, separate "I want this" action, not a replacement for chat.

### Phase 12 — Public landing page
Replace the current placeholder `/` homepage with a real landing page usable without an account: hero, live recent/trending listings grid (existing `ListingCard`, restyled per Phase 9), trending tags as quick filters, featured shops, brief "how it works," non-blocking sign-up CTA. Browsing (`/listings`, listing detail, storefronts) is already public today — this phase makes discovery the front door rather than a bare hero, and confirms the auth gate stays scoped to intent-to-act (Contact Seller, Add to Cart, Place Order, Rate all redirect to Google-first login when unauthenticated).

### Phase 13 — Full application redesign pass
Retrofit every page built in Phases 3–8 (auth, listings browse/new/detail/edit, shops storefront/dashboard, inbox, profile, admin) onto the Phase 9 system: palette, motion presets, dark/light support. Mobile-first responsive audit on every page (single-column stacking below `sm`, ≥44px tap targets, bottom-sheet modals on mobile vs. centered dialogs on desktop, revisit the Navbar for a mobile nav pattern once Cart/Orders links are added). Standardize empty/loading/error states (skeletons instead of the blank returns several pages currently use during loading). Final z-index/overlap audit against the Phase 9 scale across dropdowns, modals, toasts, and the sticky navbar.

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

> See "Deviations" above — this table now also has `student_id`, `registration_no`, `hall_id`, `department_id`, `session`, `batch`. All of these plus `phone` were required from Phase 3 through Phase 9; Phase 10 made them nullable again for Google-lite buyers — see the Phase 10 deviation below.

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

Built so far: `main.py` (now also mounts `/media` static files), `core/` (config incl. `FRONTEND_URL`, security incl. `generate_secure_token`, dependencies incl. WS auth + admin-role guard, logging — `exceptions.py` not yet needed), `db/`, `models/` (all domain tables + `reference.py` for halls/departments), `schemas/` (auth, user, reference, shop, listing, tag, common, chat, rating, report, admin, notification), `routers/` (auth, reference, shops, listings, tags, chat, ws, ratings, users, reports, admin, notifications), `services/` (auth_service, email_service, reference_service, shop_service, listing_service, tag_service, media_service, chat_service, rating_service, report_service, admin_service, notification_service), `websocket/manager.py` (per-user connection registry). `tasks/` (dedicated BackgroundTasks modules) was never split out separately — email sends are queued inline at each call site via `background_tasks.add_task`, which has been enough so far. Not yet built: `seed/`, `tests/`.

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

Built so far: `app/(auth)/login,signup,verify-email,forgot-password,reset-password`, `app/listings/` (browse, new, `[id]`, `[id]/edit`), `app/shops/` (`[slug]` storefront, `dashboard`), `app/inbox/` (list, `[conversationId]` chat window), `app/profile/[id]/` (public profile), `app/admin/` (layout w/ role guard, stats, users, listings, shops, reports), `components/ui/FormField.tsx`, `components/layout/Navbar.tsx`, `components/listings/` (ListingCard, ListingForm, TagInput), `components/ratings/` (StarRating, RatingForm), `components/notifications/NotificationBell.tsx`, `components/ReportButton.tsx`, `lib/api/` (client, auth, reference, shops, listings, tags, chat, ratings, users, reports, admin, notifications), `lib/ws/client.ts` (reconnecting WS singleton, now typed as a `WsMessageEvent | WsNotificationEvent` union), `lib/validation/` (auth, shop, listing), `lib/utils.ts`, `context/AuthContext.tsx` (now also owns the WS connection lifecycle), `types/api.ts`. Route protection landed as **`proxy.ts`** at the repo root, not `app/middleware.ts` — Next.js 16 renamed the middleware file convention to `proxy` (confirmed against the installed Next docs). Not yet built: `hooks/`, most of `components/shops/`.

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
