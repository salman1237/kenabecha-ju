# KenaBecha JU — Plan & Progress

A serial, phase-by-phase record of everything built, in the order it was numbered. Every phase below is complete unless marked otherwise. Phase numbers reflect the order they were *planned* in, not always the order they were *finished* in — a couple were completed out of sequence (Phase 34 shipped after Phase 39) because of how the work was regrouped along the way; each entry says so where it matters.

Original pre-implementation planning documents (the initial schema proposal, the folder-structure plan, and the Phase 9–13 design brief) are kept verbatim in the **Appendix** at the end, for historical reference. Everything above the appendix describes what was actually built.

---

## Phase 0 — Schema & folder structure design

Approved before any code was written, per `prompt.md`'s explicit request. Full text in the Appendix.

## Phase 1 — Project scaffolding

Next.js 16 (App Router/TS/Tailwind) + FastAPI, `docker-compose.yml` (dev) and `docker-compose.prod.yml` (Dokploy target). Commit `b41be16`.

## Phase 2 — Database models + initial migration

All tables from the Appendix schema, plus `pg_trgm` GIN indexes for search. Commit `88f414b`.

## Phase 3 — Auth

Commit `ad3431b`. Expanded beyond the original plan under explicit instruction: signup collects real JU student-verification fields (`student_id`, `registration_no`, `hall_id`, `department_id`, `session`, `batch` — the last server-computed and non-editable), and `phone` became required. New reference tables `halls` (21 rows) and `departments` (38 rows), seeded from juniv.edu. Email verification is OTP-based (6-digit, 10min expiry, attempt-limited) rather than a simple link/flag, and login is blocked until `is_verified`.

## Phase 4 — Listings CRUD

Commit `b2525b8`. Personal + shop-based listings, tag autocomplete/trending, image uploads, browse/search/filter. Shops CRUD was scoped in here too, since shop-based listings need an existing shop to attach to — shop *creation* shipped; shop *editing* did not (deleting and recreating was the workaround until Phase 39). The profile page (personal listings + shop cards) was deferred to Phase 6.

## Phase 5 — Chat

Commit `f0e9988`. WebSocket-pushed live delivery with REST-persisted history, per-listing conversations, owner inbox with shop filter tabs and unread badges. Offline-message email notification deferred to Phase 8.

## Phase 6 — Ratings

Commit `867f543`. Eligibility gated on sold/out_of_stock + an existing buyer conversation + not-already-rated; targets the shop or the seller depending on listing type. Also built the public profile page deferred from Phase 4, since ratings need somewhere to render: read-only page showing name, department, batch, bio, average rating, personal listings, shop cards, recent reviews.

## Phase 7 — Admin panel

Commit `fbc488a`. Reporting (any user, any target type) feeds an admin-only queue; resolving with dismiss/remove/warn/ban applies real side effects — remove soft-deletes the content, ban deactivates the user and revokes all sessions immediately. User/listing/shop moderation views and a stats dashboard.

## Phase 8 — Notifications

Commit `997d9a5`. In-app (WS-pushed live + REST list/mark-read) and email for all `NotificationType`s, plus the password-reset flow and a welcome email. Reset tokens are single-use and revoke every other active session on success. Message notifications email only when the recipient has no open WebSocket connection (reusing `manager.is_online`); every other type emails unconditionally. A shared `Navbar` was added specifically to give the notification bell one persistent home.

## Phase 9 — Design system foundation

Commit `71d771a`. shadcn/ui on **Base UI primitives, not Radix** — components compose via a `render` prop rather than Radix's `asChild`+`Slot`. Tailwind CSS-variable theming, dark/light toggle (`next-themes`), emerald/zinc palette with warning/info/success tokens, Framer Motion for animation. Base primitives installed (Button, Input, Select, Textarea, Card, Dialog, Dropdown Menu, Badge, Avatar, Skeleton, Sonner, Tabs); Navbar rebuilt as the proof-of-concept, rest of the app left untouched until Phase 13. (`shadcn init` silently overwrote `lib/utils.ts`, dropping the pre-existing `mediaUrl`/`formatPrice`/`CONDITION_LABELS` helpers — caught via a 500 on `/listings`, fixed by merging both back into one file. Worth remembering if `shadcn add`/`init` is ever re-run.)

## Phase 10 — Tiered authentication: Google OAuth + full JU signup

Commit `4e6705e`. Google one-click signup/login for buyers via the Identity Services ID-token flow (`gsi/client` → signed JWT credential → `POST /auth/google`, verified server-side with `google-auth`, no client secret or redirect dance) — JU fields made nullable on `users`, `profile_complete` computed from them. Selling (create shop/listing) gated behind a `get_seller` dependency covering both endpoints; incomplete profiles hit `/complete-profile`, which allows re-submission rather than a one-time fill-in. Signing in with Google using an email that already has a local account links `google_id` to the existing user rather than creating a second one.

## Phase 11 — Cart & orders, pickup/delivery fulfillment

Commit `01a213b`. Listings chose pickup (with address) or delivery at creation; `carts`/`cart_items`/`orders`/`order_items` added; checkout split by `(seller, shop, fulfillment_type)` into separate orders with no payment fields, re-validating availability at order time rather than trusting the cart. Simplified from the original 3-way `pickup/delivery/both` plan to a strict either/or per listing.

**Later removed.** The cart/order system was subsequently dropped in favor of chat-led deals only (migration `9f1c2b6a7d3e`, "remove cart and orders, add whatsapp_number") — orphaned `order_placed`/`order_status_changed` notification rows from this removal caused a live `/notifications` 500 discovered and fixed during Phase 39. `fulfillment_type` survived the removal and was later extended to `pickup | delivery | both` in Phase 37.

## Phase 12 — Public landing page

Commit `4eff70a`. Real homepage: hero + search, trending tags, newest listings, featured shops, "how it works," sign-up CTA — all public, built on the Phase 9 system with scroll-triggered fade-ins. Added `GET /shops` (public browse, didn't exist before). Fixed a real bug this surfaced: `/listings` never read `q`/`tags` from the URL at all (component-local state, no `useSearchParams`), so the landing page's search box and tag chips would have gone nowhere.

## Phase 13 — Full application redesign pass

Commit `c43a1af`. Every remaining page from Phases 3–8 retrofitted onto the Phase 9 system — consistent Card/Input/Label/Button/Badge/Table/Skeleton throughout, `confirm()` replaced with `AlertDialog` everywhere destructive, admin panel rebuilt on `Table`, Navbar gained a Sheet-based mobile hamburger. Responsive and z-index behavior came largely "for free" from consistent use of portal-rendered shadcn overlays (`Dialog`/`AlertDialog`/`Sheet`/`DropdownMenu` at `z-50`, sticky Navbar at `z-40`) rather than a hand-maintained numeric scale. **Closes the UI/UX redesign initiative (Phases 9–13).**

## Phase 14 — Glassmorphism redesign, i18n foundation, admin Top Products

Complete visual overhaul: green/teal gradient palette, glassmorphism utilities (`glass-card`, `glass-navbar`, `gradient-bg-hero`), Inter typography, Framer Motion micro-animations (`AnimatedButton`, `GradientCard`), the first pass of the bilingual Bangla/English `LanguageContext`, and `is_top` (migration `e8b9f0a1c2d3`) for admin-curated Top Products. Landing page revamped with Top Products, Latest Picks, Featured Shops, Categories, and How It Works sections.

---

## Phases 15–24 — Frontend gap closure

Driven by `gap_analysis.md`. Closes out the frontend gap-closure initiative in full.

### Phase 15 — Design system & motion foundation

Fixed `--font-sans` (was `Geist` while `layout.tsx` loaded Inter — Tailwind v4's `@theme inline` resolves at parse time, so it needs a literal family name, not `var()`). Added a two-layer soft-shadow scale, `scroll-behavior: smooth`, a global `:focus-visible` ring, and a `prefers-reduced-motion` block. `lib/motion.ts` centralizes the motion vocabulary (fade/slideUp/scaleIn/stagger/pageTransition/hoverLift + spring presets). New hooks `useMediaQuery`/`useIsMobile`/`useIsDesktop`, `useDebounce`, `useIntersectionObserver`; new `EmptyState`, `ErrorState`, `FieldError`, `SmartImage`. `Button` gained `loading`/`loadingText`. `MotionProvider` (`MotionConfig reducedMotion="user"`) + `PageTransition` wired into the root layout.

### Phase 16 — Footer & homepage completion

Migration `b9efc178bd30`. Built the missing `Footer` — the app had none at all, the landing page just ended. Three new homepage sections: `StatsSection` (count-up figures off `GET /public/stats`, skips the animation under `prefers-reduced-motion`), `ReviewsSection` (real testimonials off `GET /public/reviews`), `NewsletterSection` (backed by a real `newsletter_subscribers` table + `POST /public/newsletter`). Sections self-hide when they have no data rather than rendering placeholders.

### Phase 17 — Browse page overhaul

Rebuilt `/listings`: sticky desktop filter sidebar (`ListingFilters`), dual-thumb price range slider replacing two number inputs, grid/list view toggle, infinite scroll via `useIntersectionObserver` replacing manual pagination, collapsing to a `Sheet` below `lg`. Proper `EmptyState`/`ErrorState` replace bare `<p>` text. At the top of the slider the max-price filter drops entirely so the range reads "and above" rather than silently excluding pricier items.

### Phase 18 — Product detail page

Two-column layout with a sticky contact panel. `ImageGallery` with a fullscreen lightbox (click-to-zoom, arrow-key nav, Escape, body-scroll lock). Animated tabs (Description/Details/Reviews). New `Breadcrumbs`, `ShareButton` (native share sheet with clipboard fallback), `RatingSummary` with an animated star-distribution chart off `GET /listings/{id}/seller-reviews`, and a related-listings rail off `GET /listings/{id}/related` that tiers through same-shop → shared-tags → recent.

### Phase 19 — User dashboard

Migration `c4111ed45d6b`. Built the entire section from zero: `/dashboard` with Overview, My listings, Saved, and Settings. New `saved_listings` table + `/dashboard/{stats,activity,saved,saved/ids}` endpoints, `SaveButton` on every card. `ActivityChart` is hand-rolled SVG rather than a charting dependency.

### Phase 20 — Auth pages polish

New `AuthShell` split-screen layout, `PasswordInput` (visibility toggle), `PasswordStrength` (advisory only — the real rule stays server-side), `OtpInput` (six segmented boxes, auto-advance, paste-anywhere, `autoComplete="one-time-code"`). Verify-email auto-submits on the sixth digit.

### Phase 21 — Chat enhancements

Migration `d09a0a8ea5bc`. Message bubbles animate in and show read receipts via a new `read` WS event. Typing indicator via a bidirectional `typing` WS frame — the `/ws` endpoint now reads client frames and re-checks conversation membership on every one. Image attachments via `POST /conversations/{id}/attachments`. Also fixed a Phase 16 regression: the Footer made pages taller than the viewport, so the chat's `scrollIntoView` was scrolling the window instead of the message container.

### Phase 22 — Shop pages

Migration `2d9d01a15fef`. Storefront rebuilt: cover banner with overlapping logo, a stats row (`GET /shops/{slug}/stats`), Listings/Reviews tabs, and a follow button (`shop_follows` table). New `get_optional_user` dependency so the stats endpoint personalises `is_following` for logged-in viewers while still serving anonymous ones — `is_following` is `null` rather than `false` for anonymous visitors.

### Phase 23 — Admin dashboard (first pass)

New reusable `DataTable`: sortable headers, search (server or local, never both), CSV export (UTF-8 BOM for Excel), sticky headers, card fallback on mobile. Applied to users/listings/shops. Also fixed a real pre-existing bug: `onRemove` in three admin pages called an undefined `load()`, so every moderation action threw and the table silently never refreshed.

### Phase 24 — Performance & accessibility

Migrated `SmartImage` (and nearly every image) to `next/image` — measured 95% smaller on a real photo (451KB → 21KB). Required a real architectural fix: the optimizer runs server-side inside the frontend container, where `localhost:8000` is the frontend itself, not the API — media is now proxied same-origin via a Next rewrite to `INTERNAL_API_URL=http://backend:8000`. Added a skip-to-content link and bottom-sheet dialogs on mobile.

**Deliberately left out** of Phases 15–24: image-only chat previews, the listing-form blob previews and the lightbox still use raw `<img>` (object URLs and CSS-transform zoom don't survive the optimizer). Emoji picker, pull-to-refresh, keyboard shortcuts, search suggestions, context menus and virtualized lists were judged low-value at this scale and skipped.

---

## Phases 25–34 — System audit remediation

Driven by `improvement.md`, a full audit of `backend/app/` and `frontend/app/`, written *before* Phases 15–24 landed — so a large share of its findings were already resolved by the time this initiative started (verified rather than re-fixed). Two findings turned out not to be real and were excluded rather than "fixed" for show: `BUG-02` (the `ORDER BY` it asked for already existed) and `BUG-03` (`is_top` was already `NOT NULL DEFAULT false`).

### Phase 25 — Critical bugs & security hardening

**BUG-01** was a genuine production crash: `admin_remove_listing` passed `type=`/`user_id=` as keywords and omitted the required `email_subject`/`email_body`, so *every* admin listing removal raised `TypeError` before the commit — moderation was completely broken. Verified end-to-end after the fix (200, seller notified, listing 404s publicly). **BUG-05** `get_listing` now also checks `is_active`. **SEC-01** `get_settings()` refuses to start outside development with the placeholder JWT secret. **SEC-03** LIKE metacharacters are escaped via a shared `app/core/search.py` — `q=%` used to return every listing, now returns 0 — applied to all three search sites. **SEC-04** uploads validated by magic bytes, not client-supplied `content_type`; the sniffed type decides the stored extension. **SEC-05** superseded avatars/logos/covers are unlinked only after the replacement commits, with a `MEDIA_ROOT` containment check.

### Phase 26 — Rate limiting & WebSocket resilience

Migration `bc75b0879d9c`. **SEC-02** rate limiting on signup/login/google/verify-email/resend-otp/forgot-password/reset-password, backed by a `rate_limit_hits` table rather than process memory — prod runs `uvicorn --workers 4`, and an in-memory counter would give an attacker 4× the advertised limit. Hits commit immediately so a *failed* login still counts despite its rollback. Sliding window with `Retry-After`; `X-Forwarded-For` only honoured behind `TRUST_PROXY_HEADERS`. Verified: 10 bad logins pass, the 11th returns 429. **SEC-06** WebSocket heartbeat — server pings every 30s, reaps sockets silent for 90s (an uncleanly-dropped client previously stayed registered, leaking memory and keeping `is_online` true, which suppressed the offline-email path). **BUG-04** `/ws` copies the user id out instead of holding a detached ORM object. Also fixed **FE-BUG-04**: on close code 4401 the client used to reconnect forever against an expired cookie; it now refreshes the token once and retries.

### Phase 27 — Category system

Migration `6605a57ca25d`. Hierarchical `Category` model, 2-level taxonomy seeded, `category_id` added to `Listing` and wired through `BrowseFilters`/`ListingCreate`/`ListingUpdate`. Category dropdown on browse filters, category selector on the listing form, category breadcrumb on the detail page.

### Phase 28 — Search page & autocomplete

`GET /listings/suggestions` + a `NavbarSearch` autocomplete component, wired to redirect into `/listings` with query parameters rather than duplicating a separate search page.

### Phase 29 — Data-integrity & query-performance fixes

`DISTINCT ON` ordering fixed in chat, `is_active` validated everywhere it should be, shop pagination added (`/shops` was hard-capped at 6), N+1 rating queries batched, `usage_count` decremented when tags are replaced, image `sort_order` re-sequenced after delete, chat blocked on removed listings, explicit connection-pool settings.

### Phase 29a — Audit of Phases 27–29

Senior-engineer review of the Phase 27–29 work, in severity order: **1)** `next build` failed outright — a missing `Condition` import and a `GradientCard` extending `React.HTMLAttributes` while rendering a `motion.div` (handler signatures conflict); Turbopack dev doesn't typecheck, so both were invisible until a production build. **2)** 500 on an unknown `category_id` — added `category_service.ensure_exists`, now a 400. **3)** Navbar search did nothing while already on `/listings` — `searchParams` was only read in `useState` initializers, which don't re-run on client navigation. **4)** Search suggestions offered sold/removed listings — `status` wasn't filtered. **5)** `npm ci` had regressed to `npm install` in the frontend image, papering over a stale lockfile — regenerated and restored `npm ci`. **6)** Categories weren't actually adopted — optional everywhere, so listings were created uncategorised and every sidebar count read zero; now required client-side, still nullable server-side for pre-taxonomy listings.

### Phase 30 — View counts, listing expiry & promotion

Migration `87818c74aa4c`. **View counts** de-duplicated via `listing_views` keyed on `(listing_id, viewer_key, window_start)` — one view per viewer per UTC day, sellers excluded from their own listing's count, `view_count` denormalised for sort/browse. **Expiry**: new listings get `expires_at = now + 30 days`, a new `expired` status distinct from `removed`, an hourly sweep on the app lifespan flips lapsed listings (correctness doesn't depend on the sweep running — `browse_listings` also filters `expires_at`). Sellers see a warning from 7 days out and a Renew button. **Promotion**: `featured_until` gives time-boxed promotion separate from the permanent `is_top` flag, applied as a leading sort key everywhere so paging doesn't repeat featured items; admin-granted only, since self-service promotion means everyone is promoted and the ordering stops meaning anything.

### Phase 31 — i18n completion (Bangla + English)

**The foundation was broken, not just incomplete.** The old provider read `localStorage` in a `useState` initializer — server renders `en` (no `window`), client renders `bn`, so selecting Bangla failed hydration outright. Fixed by moving the locale to a **cookie**: the root layout reads it server-side, stamps `<html lang>` correctly, and passes it down as `initialLocale` — first paint is now already in the right language. Added Noto Sans Bengali (after Inter in the font stack, so fallback is per-glyph). ~280 keys extracted across the whole app, with `bn` typed as `Translations = typeof en` so a missing key is a compile error, not a blank string in production. `Intl` with `bn-BD` gives Bengali numerals and correct relative-time grammar, exposed pre-bound as `fmt.*` on the context. Backend responses now carry a stable `code` next to the English `detail`, translated client-side with a graceful fallback. Verified by rendering every route in Bangla and flagging *any* remaining Latin-script word, not just the strings that had been touched — caught breadcrumbs, stat tiles, tabs and the Share button still in English.

### Phase 32 — SEO, error boundaries, 404 & mobile bottom nav

Root metadata gains `metadataBase`, a title template, Open Graph and Twitter cards. Per-listing metadata comes from a server `layout.tsx` wrapper, since Client Components can't export `generateMetadata`; sold/expired listings are `noindex`. `Product` JSON-LD is emitted from that same server layout — putting it in the client page put it nowhere in the initial HTML, since the page shows a skeleton until data arrives. `sitemap.ts` swallows API failures (an empty sitemap beats a 500). `app/error.tsx` catches route-level throws with `unstable_retry()`; `app/global-error.tsx` covers a throw in the root layout itself and is self-contained/inline-styled since it replaces the layout entirely. Mobile bottom nav (Home/Search/Sell/Inbox/Profile), hidden from `md` up and suppressed on `/admin` and inside a chat thread. `/terms` and `/privacy` written against what the app actually does, not a template.

### Phase 33 — Backend test suite

`backend/tests/` was empty. **74 tests, all green**, against a **real Postgres**, not SQLite — the schema depends on native enums, `pg_trgm`, `ON CONFLICT ON CONSTRAINT` and `ILIKE … ESCAPE`, which SQLite would happily let through. A throwaway `kenabecha_test` database is migrated with `alembic upgrade head` once per session, so tests exercise the schema that actually ships. Isolation via **savepoints, not truncation** — the service layer commits constantly, which would end a plain outer transaction; binding each test's session with `join_transaction_mode="create_savepoint"` turns commits into savepoint releases. **Mutation-checked**: three fixed defects were deliberately reintroduced and each turned exactly the corresponding test red and nothing else, then the suite was verified green again after reverting.

### An unrelated live bug, found while verifying Phase 39

`GET /notifications` was returning 500 — `LookupError: 'order_placed' is not among the defined enum values`. Removing the cart/orders feature (Phase 11's later removal) dropped those values from the Python `NotificationType` but left rows in the table still carrying them; SQLAlchemy raises while *loading* such a row, so one orphan broke the bell for that account entirely, silently. Migration `3690eedd48d7` deletes the orphaned rows — deleting rather than remapping, since they point at orders that can no longer be opened.

### Phase 34 — DevOps: production compose, CI/CD, backups

*(Completed after Phase 39, chronologically — grouped here by its planned number.)*

`entrypoint.sh` now runs `alembic upgrade head` before uvicorn binds (`set -e`, so a failed migration stops the container rather than serving a half-migrated schema) — previously **nothing ran migrations on deploy at all**, the biggest gap on the list despite not being named on it. `/health` was a stub returning `{"status": "ok"}` unconditionally; it now queries the database and returns 503 when that fails, both paths tested. A routing error was caught before shipping: the first Traefik config published only the frontend, but the browser calls the API directly for every request and for the chat WebSocket — corrected to frontend on `APP_DOMAIN`, API on `API_DOMAIN`. CI (GitHub Actions) runs `alembic upgrade head` from empty, `alembic check` for drift, the full test suite against a real Postgres service, `tsc --noEmit` and `next build`; only a green push to `main` POSTs Dokploy's deploy webhook and polls `$API_URL/health` until the new version answers. A nightly `pg_dump` service writes to `.part` and renames only on success; the restore path was actually tested end-to-end, reproducing 23 listings, 10 users and 4 shops exactly from a dump. JSON logs in production only, tagged with a request id that's honoured from and echoed back to an inbound `X-Forwarded-For`/proxy header.

---

## Phases 35–39 — Navigation, shop presentation & listing management

A second frontend pass, closing gaps found after Phases 15–24 shipped: the navbar held one link, shop cards were bare text in a box, fulfillment was forced either/or, and both the listing and shop edit pages were missing most of their own controls.

### Phase 35 — Navigation shell & shops browse page

Browse Listings, Browse Shops, Sell Item, Inbox and My Shops became first-class navbar destinations (account-only items stayed in the avatar dropdown); Sell/Inbox/My Shops render only when signed in. **The avatar was a real bug, not a style choice** — the trigger always rendered `full_name.charAt(0)`; `avatar_url` was fetched and stored but never read. Extracted into a `UserAvatar` component so image and initial-fallback can't drift apart again. Fixed a breakpoint gap where the inline nav hid below `lg` but the drawer trigger was `sm:hidden`, leaving no navigation at all between `sm` and `lg`. `/shops` didn't exist as a route at all — shops were reachable only from the six on the landing page; built as a full browse page with search and three sort orders (unrated shops sort last, not as zero, under "Highest rated").

### Phase 36 — Shop card & homepage layout rhythm

**A correction to the audit**: it claimed follower counts were already returned by the API — they weren't, `ShopOut` only carried listing count and ratings. Added properly with a single `IN (…) GROUP BY` (`get_shops_follower_counts`) rather than one query per card. The card gained a cover band with the logo straddling its edge, type chip, description, and a footer with listing/follower counts; a shop with no cover gets a brand gradient instead of an empty grey rectangle. **The grid was a bug, not a preference** — `md:grid-cols-6` meant two shops each occupied one-sixth of the container; now `1 / 2 / 3` columns. Section padding standardised to `py-14 sm:py-16` throughout.

### Phase 37 — Fulfillment: pickup *and* delivery

Migration `8f3b25a0c9ef` adds `both` to `FulfillmentType` (hand-written — Alembic doesn't diff enum values; downgrade raises `NotImplementedError` rather than guessing what to do with rows already set to `both`). The rule that matters: `both` includes pickup, so it still needs an address — encoded once as `OFFERS_PICKUP = {pickup, both}` and shared by create and update so the two paths can't drift. The detail page now renders both lines for `both` rather than picking one. 5 tests; suite reached 79.

### Phase 38 — Listing form & edit page rebuild

**The edit page could not edit most of a listing** — photo management, shop selection and stock were all gated on `mode === "create"`; photo controls lived on the *public* detail page instead as a bare "Manage photos: Remove #1" row. Rebuilt into six labelled sections (Sell as · Photos · What are you selling? · Pricing · Stock · Fulfillment · Tags). New `POST /listings/{id}/images/reorder` takes the full ordering and rejects a partial list, for the same reason every other reorder endpoint in this codebase does. `ListingPhotoManager` applies upload/delete/move/promote-to-cover immediately rather than on submit, since they already do server-side. Stock now round-trips through the form for shop listings. Status actions (mark sold, renew, delete) live in their own section with their own endpoints rather than being smuggled into Save.

### Phase 39 — Shop dashboard rebuild

**The logo could not be changed while editing** — the collapsed row rendered `ShopLogoPicker`, the edit view rendered `ShopCoverPicker` and the text fields; opening Edit therefore *removed* the only control that could change the logo. Both pickers now live in the edit view under a Logo & cover section. Structure matches the Phase 38 listing form: two labelled sections, a proper card in the collapsed state showing type/listing count/follower count. Closed several translation gaps the Phase 31 sweep missed because they lived inside a conditionally-rendered form. Also fixed the `/notifications` 500 described above, discovered while verifying this phase.

---

## Admin panel (Phases 40–45)

Requested: role management for moderators, and full admin control over site content, categories, navigation and moderation workflow. Before this initiative the admin API covered only stats, user activate/deactivate, listing remove/set-top, shop remove, and report resolution — two roles with no middle ground, 422 translation keys compiled into the JS bundle, categories frozen in a migration, and no record of who did what.

### Phase 40 — Roles: moderators

`moderator` added to the `user_role` enum (migration `ac73d6d3bc52`, hand-written for the same reason as every other enum-value migration in this project). Two permission dependencies: `get_current_staff` (admin **or** moderator — reports, removing listings/shops) and `get_current_admin` (admin only — user management, role changes, site content). **Two rails, both tested**: no self-promotion (a user cannot change their own role, placed on the operation itself so it survives who's allowed to call it), and no last-admin demotion/deactivation (the one mistake with no route back through the product short of a database shell — inactive admins don't count as cover, since they can't log in). Demotion revokes sessions immediately. 13 tests; suite reached 105.

### Phase 41 — Audit log

An `audit_log` table (migration `bc8039bd9e11`) recording actor, action, target and a JSON detail blob, written by every privileged endpoint, admin-only reads with filtering. **The actor is snapshotted, not referenced** — `actor_email`/`actor_role` are copied in at write time, since reading through the relationship would turn a deleted account's whole history into anonymous rows. **The target has no foreign key**, for the same reason. **Entries share the action's transaction** — `record()` is synchronous and doesn't commit, so a rejected action leaves nothing behind and a successful one can't end up unrecorded. **Append-only** — no update/delete endpoint exists, and a test asserts `DELETE`/`PATCH` against an entry return 404/405. A real ordering bug surfaced here: two entries in one transaction shared a timestamp because the inherited `created_at` default was `now()` (transaction start time in Postgres, not wall clock) — fixed with `clock_timestamp()` (migration `46c7b654c1b7`), which also exposed that `alembic check` doesn't compare server defaults unless told to (`compare_server_default=True` now set in `env.py`). 11 tests; suite reached 116.

### Phase 42 — Site content management → modular landing-page sections

Started as translation overrides for the marketing copy, then widened mid-phase to full section management: reorder, hide, and delete, not just retitle. The landing page is assembled from a `page_sections` table (migration `3f18e879d84e`) rather than JSX. **Section types are code; section instances are data** — a ten-member `SectionType` enum, each with its own React component; an admin manages instances, not new types (the alternative, free-form blocks with a rich-text editor, is a page builder and a much bigger product). **Copy is an override, not content** — `settings` is JSONB holding only the keys an admin changed, per locale (`{"title": {"en": "…", "bn": "…"}}`); an absent key/locale/empty string all fall through to the bundled translation, so an empty `settings` renders exactly what the site shipped with. New sections start hidden and last; `PATCH` replaces `settings` rather than merging (so a cleared field stays cleared); reorder demands every section exactly once; hiding preserves position; deletion is hard but the audit entry snapshots what was lost; the page renders per request with a hard-coded fallback so an API blip can't blank the homepage. Two bugs caught only in live verification: `onSelect` on a menu item typechecks but silently never fires on Base UI, and an empty-state guard on the categories section dropped its heading from the server-rendered HTML. Also fixed here: the admin layout gated on `role === "admin"` outright, locking Phase 40's moderators out of screens the backend already authorised them for; and the test suite was attempting to send live email through the dev container's real SMTP credentials, failing four unrelated tests. 24 tests; suite reached 140.

### Phase 43 — Category management

Full admin CRUD over the taxonomy — create, rename, move, reorder, hide, delete, at both levels, all audited. **The first admin surface where the content points at real stock**, which shapes everything: `listings.category_id` is `ON DELETE SET NULL` (a delete would silently uncategorise real listings) and `categories.parent_id` is `ON DELETE CASCADE` (deleting a parent would take its children, and their listings, with it) — neither fails loudly on its own. So a category holding listings can't be deleted without a destination (409 with the count, `?move_to=` reassigns), a category with subcategories can't be deleted at all, and listings can't be moved into the category being deleted. Hiding is the reversible option: it mirrors the page-section flag, cascades to children (they're only reachable through the parent), but a parent's listing count still includes hidden children's listings since browsing the parent matches every descendant. Hidden categories stay resolvable by slug, and `ensure_exists` accepts a hidden category when it's the id a listing already had — otherwise retiring a category would make every listing inside it permanently uneditable. Renaming deliberately leaves the slug alone, since it's the URL. 33 tests; suite reached 173.

### Phase 44 — Navigation management

Raised as a bug report: "footer items disappeared after Phase 42, and neither footer nor navbar is customizable from admin." Two separate, real problems. **The footer was shipping invisible** — every block in it was server-rendered with inline `opacity: 0`, waiting on Framer Motion to hydrate and an `IntersectionObserver` to fire before restoring it; any interruption left the entire footer invisible with no error anywhere. Site chrome at the bottom of a page gains nothing from an entrance animation, so it no longer has one — fixed and shipped ahead of the feature. **The feature**: navbar and footer links are now data, managed at `/admin/navigation` — add, rename per-locale, reorder, hide, delete, scope to signed-in/signed-out. Labels follow the Phase 42 override pattern (`translation_key` + per-locale override); sign-in visibility rules moved from JSX into a `visibility` column on the link. Controls (search box, bell, theme/language toggles) are not links — they're functional components that can only be switched off, via a generic `site_settings` table whose missing keys default to on. Navigation is fetched once server-side in the root layout with a hard-coded fallback that mirrors the seed — verified by stopping the backend outright and confirming the navbar and footer still rendered in full. 27 tests; suite reached 200.

### Phase 45 — Admin dashboard, bulk moderation & announcements

A dashboard worth opening: each headline count paired with how many arrived inside a switchable 7/30/90-day window, a three-series daily activity chart (hand-drawn SVG — not worth a charting dependency for three polylines), and the most-viewed active listings. Gaps in the series are zero-filled, not omitted, so a quiet day doesn't make the chart lie by omission; days bucket on Dhaka time, not UTC, since everyone using the site is on campus. **Bulk moderation** puts every selected item through the same single-item function the one-at-a-time flow uses — a bulk `UPDATE` would be faster but would skip the audit entry, the seller's notification, and the email, quietly turning "remove 20" into a different operation from doing it 20 times. Items are independent: one bad id doesn't roll back the rest, and the response names what failed. **A scheduled announcement banner**, in the `site_settings` table Phase 44 introduced — scheduling evaluated server-side (a wrong device clock shouldn't show a maintenance notice early), its version bumps only when the wording changes so dismissing one notice doesn't silence the next, and an empty message is never published even when switched on. The banner reads localStorage via `useSyncExternalStore` rather than an effect, so it's present in the server HTML — applying the Phase 44 footer lesson directly. 31 tests; suite reached 231.

---

## Phases 46+ — Audit remediation (from `AUDIT_REPORT.md`, 2026-08-07)

A third-party audit report landed in the repo claiming two critical secret leaks and a dozen missing features. Verified against the actual code before acting on any of it — roughly half the report did not hold up: the two "critical" findings were false (neither `.env.local` nor `.env.prod` has ever been tracked by git), and seven "missing" features (OTP input, password toggle, navbar search, price slider, reduced-motion handling, CI/CD, `robots.ts`) were already built in Phases 15–34. The corrected, re-verified findings are in `AUDIT_REPORT.md`; the phases below are the real, actionable subset.

**Not a phase, but the actual highest-priority open item:** real VPS root credentials and a live Dokploy API key were pasted into chat earlier in this project. Neither was committed to the repo, but both need rotating — that's a manual action outside what a code phase can do.

### Phase 46 — Production correctness & security fixes

A batch of small, independent, low-risk fixes — none requires an architectural decision, so they ship together:

- **`TRUST_PROXY_HEADERS` unset in production.** Confirmed in the live `.env.prod`: it's absent, defaulting to `False`, while production sits behind Traefik. Every rate-limited endpoint is currently bucketing all visitors together by Traefik's container IP — one user's limit is everyone's limit. Set it to `true` in `.env.prod` and document it in `.env.prod.example` with the reason (Traefik, not optional).
- **No rate limit on chat.** `POST /conversations/{id}/messages` and `.../attachments` have none, unlike every auth endpoint — add `rate_limit("send_message", ...)` to both.
- **`LoginRequest.password` has no `max_length`.** `SignupRequest.password` two lines away correctly caps at 128; login doesn't, which is a CPU-exhaustion path through argon2's deliberately expensive hashing. Match the cap.
- **`contact_seller` always returns `last_message=None`/`unread_count=0`.** Even for an existing conversation with real history. `chat_service.get_last_message`/`count_unread` already exist and are used exactly this way by `list_conversations` a few lines below — wire them into `contact_seller` too.
- **API docs public in production.** `/docs` and `/openapi.json` both return 200 on the live API right now. Condition them off when `ENV == "production"`.
- **No SMTP timeout.** Confirmed this does *not* block the event loop (Starlette runs sync background tasks via `run_in_threadpool`, verified by reading its source) — but an indefinitely hanging connection still ties up a shared thread-pool worker. Add `timeout=15`.
- **Backend container runs as root.** Add a non-root user in the `prod` Docker stage; verify the upload path still works under it before shipping.

### Phase 47 — Chat delivery across worker processes

Production runs 4 Uvicorn workers; `ConnectionManager`'s connection registry is a plain in-memory dict, one per worker process with no shared state. When a conversation's two participants land their WebSocket connections on different worker processes — which happens essentially at random — a live message from one never reaches the other's socket. It's still saved correctly and shows up on next load; only the *live* push fails, silently.

Two options, not one, and they don't ship together:
- **Immediate mitigation:** `--workers 1`. Five-minute fix, correctness restored immediately, and at current traffic a single worker is unlikely to be the bottleneck — the backend does little CPU-bound work.
- **Real fix:** Redis pub/sub so `send_to_user` broadcasts to every worker, not just the one holding the socket. Real infrastructure — a new service in both compose files, a new dependency, every `send_to_user` call site touched, and the natural place to also fix Phase 46's rate-limiter race condition (§`PERF-01` in the audit) with an atomic `INCR` instead of the current check-then-insert.

Ship the mitigation now; scope Redis separately once chat volume actually justifies the added infrastructure.

### Phase 48 — Frontend test coverage

Zero `*.test.ts(x)` files exist anywhere under `frontend/`, against a 231-test, mutation-checked backend suite. Not "add tests" in the abstract — start with the places that have actually broken in this project's own history, since those are the parts a test would have caught something real:

- The deduplicated in-flight `/auth/refresh` logic in `AuthContext` (built specifically because concurrent refreshes were revoking each other's token families).
- The WebSocket reconnect-on-4401 logic from Phase 26 (previously reconnected forever against an expired cookie).
- The admin bulk-action and reorder flows from Phases 42–45, where mutation testing on the backend found several real guard bugs — the frontend side of those same flows (partial-order submission, bulk-selection state) has no coverage at all.

### Phase 49 — Server-side auth guard for protected routes

`proxy.ts` (Next 16's `middleware.ts` equivalent — it exists, despite the audit's initial "missing" claim) currently only guards one direction: redirecting an already-authenticated visitor away from `/login`/`/signup`. Protected pages (`/dashboard`, `/inbox`, `/admin`, `/complete-profile`) still rely entirely on a client-side check after render — a flash of loading UI before the redirect fires, plus API calls made and then discarded. Not a security hole (every backend endpoint authenticates independently), just avoidable waste. Extend the same file's matcher to cover the protected paths and redirect server-side when `access_token` is absent.

### Phase 50 — Dependency hygiene

- **`sharp`/libvips has high-severity CVEs** (`npm audit`), fixable only by bumping Next.js past the currently pinned `16.2.12` to `16.3.0` — outside the declared range, so this needs a real upgrade-and-verify pass (full test/build/typecheck, plus manually re-checking `next/image` rendering across avatars/logos/listing photos, since that pipeline has had real bugs before in Phase 24), not a blind `npm audit fix --force`.
- **`ecdsa`, pulled in transitively by `python-jose`, carries an unfixed timing-attack CVE.** Not currently exploitable — this app signs JWTs with `HS256` only, never touching the ECDSA code path — but `python-jose` is a less actively maintained library than `PyJWT`, which wouldn't pull in `ecdsa` at all for HS256 usage. Low priority; fold into a future pass through `core/security.py` rather than a dedicated phase.

### Judgment calls raised by the audit, deliberately not scheduled as phases

- **Password policy is length-only (`min_length=8`).** Real, but NIST 800-63B explicitly recommends against forced composition rules (they push users toward predictable patterns) in favor of length plus a breach-list check. If this changes, a HaveIBeenPwned-style k-anonymity check is the better upgrade — worth a decision, not a reflex.
- **Expiry sweep runs hourly rather than 6-hourly.** Genuinely negligible — `browse_listings` already filters `expires_at` independently of the sweep, so correctness never depends on its cadence.
- **Off-host backups still don't exist.** Already honestly documented as a known gap in the Phase 34 compose file itself; re-confirmed still true, not newly discovered.

---

## Phases 51–52 — AI shopping assistant & shop posts (planned, not yet built)

Two features requested by studying a reference app (`Bostro-Bangla`, a Next.js/MongoDB multi-vendor marketplace) for its floating AI chat widget and its seller-authored "posts" feature, then designing KenaBecha-specific versions rather than porting either as-is. Both phases below are **plans, not implementations** — following the project's established pattern, each ships as its own phase, built and verified before moving to the next, with confirmation between them.

### What the reference app actually does, and where its patterns don't fit here

**AI assistant.** A floating widget (bottom-right, Zustand store persisted to `sessionStorage` — not tied to an account, doesn't survive closing the tab) posts each message plus the last 10 turns to a route that stuffs up to 200 products into the system prompt as a plain-text list, asks OpenAI for strict JSON (`{message, products: [slugs]}`), and renders the reply as a chat bubble plus small product cards. Real strengths worth keeping: the session-scoped, not-account-tied privacy stance; the "only recommend what's in the catalog, never invent" rule; the structured-output contract. Real weaknesses, corrected in the plan below: the whole catalog is re-dumped into the prompt on *every* message (expensive, and stale within its cache window) instead of the model calling a real search function; despite requesting `stream: true`, the client just buffers the full response and parses it once at the end, so streaming buys nothing; and there's no rate limiting at all on a per-message paid-API endpoint.

**Posts.** Seller-authored blog articles (title, one cover image, freeform paragraphs) with no connection to any specific product, moderated pending → published/rejected by an admin, editing resubmits to pending. This is a content-marketing feature — "5 ways to style a denim jacket" — not a product feature. **The request here was explicitly different**: "post feature is for the shop owners, shop owners can post their products." What's designed below keeps the sound *mechanism* (seller authors → moderation queue → public feed, edit resubmits) but replaces the *content model* — a KenaBecha post is anchored to real listings from the shop, not disconnected editorial writing, and it plugs into machinery Bostro-Bangla doesn't have at all: a follower graph (`shop_follows`, Phase 22) to actually route posts to people who asked to see them, and a notification system to tell those followers when one goes up.

### Phase 51 — Floating AI shopping assistant

**Grounded in the real catalog via tool calls, not a stuffed prompt.** Rather than dumping listings as text on every turn, the model is given callable tools backed by the *existing* search machinery: `search_listings` wraps `listing_service.browse_listings` / `BrowseFilters` (Phase 17's filters, Phase 27's categories) directly — the same query that already excludes sold/expired/inactive-seller listings (Phase 25/29/30's guards) — so the assistant can never recommend something a human browsing `/listings` wouldn't also see, and nothing needs re-syncing into a prompt cache. A second tool, `get_categories`, lets it ground category names instead of guessing. This costs a bit more latency (a couple of tool round-trips) in exchange for the assistant always being live-correct and not burning tokens re-describing 200 listings for a message that just says "hi."

**Real token streaming, not buffer-then-parse.** The reference technically streams but the client accumulates the whole response before touching it, so the user sees nothing until the full JSON is complete — no better than a plain request/response, with all the added complexity of a stream. Here: two SSE event types over the existing WebSocket-adjacent infra pattern — `delta` events carry the assistant's prose token-by-token (rendered as it arrives, matching what users expect from any modern chat UI), and one final `listings` event carries the recommended listing ids once the model has finished calling tools and settled on an answer. The frontend renders prose incrementally and only resolves the listing cards at the end.

**Bilingual by construction, not left to chance.** KenaBecha already has a real locale system (Phase 31) — cookie-driven, ~280 keys, `bn-BD` number formatting. The assistant reads the visitor's current locale and is instructed to reply in it explicitly (matching the visitor's own message language if they code-switch), rather than the reference's "Banglish is welcome" free-for-all. Recommended listings render through the **existing `ListingCard` component**, unmodified — it already does locale-aware price formatting (`fmt.price`), status badges (sold/out-of-stock), and save-button wiring; the reference app's bespoke mini-card does none of that (hardcoded `BDT ${price.toFixed(0)}`, no locale awareness at all).

**Discovery, not a fulfillment shortcut.** KenaBecha's actual transaction path is chat-negotiated, in-person, audit-trailed. The assistant's job ends at "here's what matches, and here's the listing" — every recommended card's call to action is the same "Contact Seller" flow that already exists (Phase 5), never a phone/WhatsApp number recited from listing data. This is a deliberate guardrail, not an oversight: reciting contact details would let a visitor route around the in-app messaging this whole platform's trust model (reports, audit log, moderation) is built on.

**Rate-limited from day one**, unlike the reference. A paid LLM call per message is a real cost and abuse surface; reuses the existing `rate_limit` dependency (Phase 26) exactly like every auth endpoint already does — per-identity, sliding window, `Retry-After`. Also capped: history sent to the model stays at the last 10 turns (matching the reference's own sensible limit), and a hard per-conversation message cap prevents a single open tab from an unbounded token bill.

**Admin-tunable without a deploy**, extending the Phase 44/45 pattern rather than inventing a new one: the system prompt's tone/rules and an on/off switch live in the existing generic `site_settings` table, editable from the admin panel — the same mechanism already used for navbar controls and the announcement banner.

**New external dependency**: an LLM API key, same category of setup as `GOOGLE_CLIENT_ID` or SMTP credentials before it — needs a decision on provider before this phase starts (OpenAI directly, or an OpenAI-compatible endpoint so the choice isn't locked in). Backend gets a new `openai`-SDK dependency pointed at a configurable base URL/model rather than hardcoding a single vendor.

**UI**: floating button bottom-right, built on this project's actual design language (glass/emerald, Framer Motion, `MotionConfig reducedMotion="user"` from Phase 15 — not reimplemented) rather than the reference's plain white card. Positioned to clear the mobile bottom nav's reserved space (Phase 32) rather than overlapping it, which the reference app doesn't have to account for since it has no bottom nav. Bilingual placeholder text and empty-state copy through the existing message catalogue, like everything else user-facing.

**Deliberately kept from the reference, not reinvented**: session-scoped history in `sessionStorage`, not persisted server-side or tied to an account — genuinely the right privacy stance for a "just ask a shopping question" widget, and it means no new database table, no retention policy to write, and nothing an admin can browse through. The strict "never invent a listing" rule stays as a hard requirement on the system prompt regardless of tool-calling.

### Phase 52 — Shop posts: product-centric, not editorial

**Data model.** A `shop_posts` table: `shop_id` (FK), caption (free text — written once by the seller in whichever language they choose, same as listing titles/descriptions today; no Phase 42-style translation-override system, because this is user-generated content, not site copy), 1–6 images (reusing `media_service.save_image` exactly as listings and shop logos already do — same magic-byte validation from Phase 25, same `MEDIA_ROOT` containment), a slug (for a real, shareable detail URL), **`linked_listing_ids`** (zero to a few of the shop's *own* real, active listings — validated server-side at creation that each id actually belongs to the posting shop), status (`pending`/`published`/`rejected`, mirroring the reference's moderation states), `created_at`. Editing an already-published or rejected post resubmits it to `pending` — the one mechanism worth keeping verbatim from the reference, for the same reason it gave there: a silently-changed live post under its old approval is exactly the kind of gap a moderation system exists to close.

**Where it appears.** A new "Posts" tab on the shop storefront (Phase 22), alongside the existing Listings/Reviews tabs — extending a pattern already there rather than adding new top-level navigation. A site-wide feed, ordered **followed shops first, then recent from everyone else** — powered by `shop_follows` (Phase 22), which the reference app has no equivalent of at all; its posts are just reverse-chronological across every vendor with no personalization possible. A linked listing embedded in a post renders through `ListingCard`, so a listing that's since sold or expired shows its real status badge automatically rather than the post silently pointing at broken or misleading data.

**Notifications.** Publishing a post from a shop notifies its followers — a new `NotificationType.shop_new_post`, wired through the existing `notification_service.notify` the same way every other notification type already is (Phase 8). This is the actual payoff of tying posts to the follow graph: a follower finds out a shop they care about has something new, in-app and by email exactly like every other notification here — something the reference app structurally cannot do.

**Moderation reuses this project's admin machinery rather than building a parallel one.** Approve/reject/unpublish/delete all go through `audit_service.record` like every privileged action since Phase 41 — "who approved this post?" has to be answerable here exactly like "who removed this listing?" already is. The moderation queue is built on the existing `DataTable` + `BulkBar` pattern from Phase 45, so an admin can select and approve/reject several posts at once instead of one row at a time, matching how listing/shop bulk moderation already works rather than shipping posts as the one moderation screen that's still one-at-a-time.

**Deliberately scoped down from where this could go.** No comments, no likes/reactions, no scheduling, no analytics in this phase — consistent with how disciplined this project has been about scope elsewhere (Phase 42 explicitly excluded a rich-text page builder for the same reason). A post's job is: announce, link to the real listing, let a follower act on it via the same Contact Seller flow everything else uses. Engagement features are a legitimate later phase once there's real usage to justify the added moderation surface (comment spam is its own problem), not a v1 requirement.

**Frontend**: `PostComposer` for sellers (image upload reusing the existing `ImageUpload`-equivalent component, a listing picker scoped to that shop's own active listings, caption field), a public post detail page and feed reusing `ListingCard` for any linked listings, and an admin `/admin/posts` moderation screen following the exact shape of `/admin/listings` and `/admin/shops` — same table, same bulk bar, same audit trail, so an admin who already knows how to moderate a listing already knows how to moderate a post.

---

## Phase 53 — Seller-controlled listing status (implemented)

Raised as a direct question: can a seller currently mark something sold, flag it out of stock, reorder their listings, or pause/reactivate one? Checked against the actual code rather than assumed:

| Ask | Current state |
|---|---|
| Mark sold | Exists (`POST /listings/{id}/mark-sold`), but it's one-way — nothing ever sets a listing back from `sold` to `active`. |
| Flag out of stock | Only exists *indirectly*. `quantity` hitting `0` auto-flips a **shop** listing to `out_of_stock`, and rising above `0` flips it back — there is no manual toggle, and personal listings (no `quantity` concept) have no out-of-stock state at all. |
| Reorder listings | Doesn't exist. Only listing *photos* have a seller-controlled position (Phase 38); the listings themselves have no display order beyond whatever a buyer's sort picks. |
| Activate/deactivate | Doesn't exist as anything reversible. The only "deactivate" today is permanent soft-delete. |

**Also raised in the same conversation, and it turns out to be the same problem**: remove the `quantity` field from the listing form. `quantity` currently has exactly one remaining job in this codebase — driving the automatic out-of-stock flip above. (It had a second job once, decrementing on checkout, but that entire cart/order system was removed after Phase 11; nothing has read or written `quantity` for any other reason since.) Pull the field from the form today with nothing to replace it, and every shop owner permanently loses the ability to signal out-of-stock — not "until this phase ships," but for good, since nothing else in the app would ever move a listing's status again except sold and delete. So the removal is scoped into this same phase rather than done in isolation: the manual toggle below ships in the same breath as the field that used to fake it.

### What ships

**`mark_out_of_stock` / `mark_available` — explicit, symmetric, works for every listing.** Two new endpoints alongside the existing `mark-sold`, mirroring its shape exactly (`get_owned_listing` ownership check, a status-transition guard, an audit-free simple state change — matching that `mark-sold` itself isn't audited either, since it's the seller acting on their own listing, not a privileged admin action). `out_of_stock → active` and `active → out_of_stock` are the only two legal transitions this action performs; it does not touch `sold`, `removed`, or `expired`. This replaces `quantity` as the *only* out-of-stock mechanism, and unlike the old one, it works for personal listings too — a real gap the quantity-only version had, since a personal listing can run out just as easily as a shop's.

**`relist` — undoes `mark-sold` and the pause below.** The one genuinely missing piece today: once sold, a listing is stuck sold forever, even if the sale fell through. `relist` moves `sold → active` or `paused → active` (see below), refreshing `expires_at` from the moment of relisting rather than leaving a stale expiry from months earlier — the same reasoning Phase 30's `renew_listing` already uses, so this is that function's sibling, not a new pattern.

**A new `paused` status — the reversible deactivate/activate toggle.** Added as a `ListingStatus` enum value (hand-written `ALTER TYPE`, the same pattern used for `expired` in Phase 30 and `both` in Phase 37 — Alembic doesn't diff enum values). Chosen over a separate boolean column deliberately: `browse_listings` already filters on `status == active` with zero extra work, so a listing a seller pauses drops out of public browse for free, with no new WHERE clause to keep in sync everywhere status is checked (the seller-reviews endpoint, the related-listings rail, the sitemap, the category listing counts — all the places Phase 25–30 already had to get this exactly right once). `active → paused` and `paused → active` (via `relist`, above) are the only transitions; pausing a `sold` or `removed` listing is refused, matching the same forward-only discipline this project's other status machines already enforce (Phase 37's fulfillment `both`, Phase 45's bulk actions).

**Manual display order for a shop's own listings.** A `sort_order` column on `Listing`, meaningful only for shop listings (personal listings have nothing to reorder against — a seller with three or four personal items scattered across time has never asked for this, and adding it there would be scope with no requester). New listings append to the end of the shop's own order, matching every other reorder endpoint already in this codebase (Phase 38's image reorder, Phase 42's section reorder, Phase 43's category reorder, Phase 44's nav-link reorder) — same shape and same interaction: up/down arrow buttons, not drag-and-drop, matching the pattern every one of those screens already established rather than introducing a new interaction paradigm nothing else in the app uses. The endpoint demands every one of the shop's listing ids exactly once, and a partial list is refused rather than silently leaving stale positions and duplicate `sort_order`s. The shop's public storefront defaults to this manual order; a buyer picking "Newest" or "Price" from the existing sort control overrides it exactly like it already overrides "newest" today — this is an additional sort option, not a replacement for the ones that exist.

**Restock requests — closes the loop from a buyer noticing something's gone to a seller knowing to bring it back.** Extended into this phase rather than left for later, since it's a direct consequence of the out-of-stock toggle above: once out-of-stock is real and manual, "a buyer wants it back" becomes a real, answerable question instead of a hypothetical one.

Scoped to **shop listings only** — restocking is an inventory concept a shop can actually act on (order more, make more); a personal listing going "out of stock" is closer to a seller-initiated pause with nothing to meaningfully restock, and Phase 53's own out-of-stock toggle already gives a personal seller a `paused`-adjacent way to signal that without this feature's added surface. Easy to lift the restriction later if a real use case shows up; not assumed here.

A new `listing_restock_requests` table: `listing_id` (FK cascade — no reason for a request to outlive the listing it's about), `buyer_id` (FK cascade), `created_at`, `fulfilled_at` (nullable). The uniqueness constraint is **partial**, not blanket — `unique(listing_id, buyer_id) WHERE fulfilled_at IS NULL` — so a buyer can't queue up two pending requests for the same listing, but *can* request again the next time it goes out of stock after being restocked once already; a flat unique constraint would have permanently locked them out of ever asking twice. Requesting your own listing is refused, the same `buyer_id != seller_id` discipline `conversations` already enforces.

**The payoff is automatic, not a second manual step.** When a seller calls `mark_available` (above) on a listing that has pending requests, every requester is notified in the same action — one `notification_service.notify` call per requester (not a bulk UPDATE with no trace, for the same reason Phase 45's bulk moderation actions go one-by-one through the real function rather than a shortcut), each request's `fulfilled_at` stamped, so a second out-of-stock cycle on the same listing starts everyone with a clean slate rather than silently notifying nobody because a stale row was still "used." `relist` (which resolves `paused`, not `out_of_stock`) does **not** trigger this — a paused listing was never publicly visible for a buyer to have requested against in the first place, so there is nothing to fulfill on that path. Deleting a listing clears its pending requests too — but explicitly, not via the FK's `ON DELETE CASCADE`, since listing deletion in this app is a soft delete (`deleted_at`, never a real row removal), so that cascade would never actually fire. There is no restock to announce for a listing that no longer exists, and a soft-deleted listing can never reach `mark_available` again to answer them itself (`get_listing` 404s on it), so leaving a pending row behind would just sit inert forever rather than being cleaned up.

**What the seller actually sees is a count, not a name list** — matching the precedent Phase 22 already set for `shop_follows`: a shop's stats show a follower *count*, never who's following, and restock interest gets the same treatment for the same reason. "My listings" and the shop inventory view show a small badge on any out-of-stock row — "3 want this back" — enough for a seller to prioritize what to restock first without this turning into a second inbox to manage.

**Buyer-facing.** On the listing detail page, when a shop listing's status is `out_of_stock`, a "Notify me when back in stock" button appears in the seller-action area alongside (not instead of — a buyer might still want to ask a question) the existing Chat with seller CTA. Modeled directly on `SaveButton`'s (Phase 19) optimistic toggle pattern: unrequested → filled/"requested" state on click, with the already-requested state read off the listing payload the same way `is_following` already rides along on shop data for Phase 22 — `has_pending_restock_request: bool | null` on `ListingOut`, `null` for a signed-out visitor (who gets prompted to log in on click, same gate as Contact Seller and every other intent-to-act control in this app), `true`/`false` for a signed-in one.

**Frontend**: the listing form's Stock section (title, hint, the `quantity` number input) is removed entirely — `ListingFormValues`/`listingSchema` drop the field, and the create/edit payload stops sending it. The status-actions section on the edit page (Phase 38 — currently Mark sold / Renew / Delete) gains Mark out of stock / Mark available (toggling by current status) and Relist (shown only when `sold` or `paused`). "My listings" (Phase 19's dashboard) gains a shop selector it didn't have before — it previously only merged every source into one flat, filterable-by-status grid with no way to look at a single shop's own order — and switches to a reorderable list (arrow buttons, matching the pattern above) whenever one specific shop is selected with no status filter active; a status filter or "personal"/"all" narrows back to the original grid, since reordering a filtered-down subset can't be expressed to an endpoint that demands every listing in the shop. Any out-of-stock listing anywhere in that view carries the restock-request count badge described above.

**Backend surface**: `POST /listings/{id}/mark-out-of-stock`, `POST /listings/{id}/mark-available`, `POST /listings/{id}/relist`, `POST /listings/{id}/pause`, `POST /listings/{id}/reorder` (shop-scoped, full-list-required), `POST /listings/{id}/restock-request` (create, buyer-facing, shop listings + `out_of_stock` only), `DELETE /listings/{id}/restock-request` (let a buyer withdraw one — no reason to force a request to stay pending if they've changed their mind). Migration adds `paused` to the enum, `sort_order` to `listings`, and the new `listing_restock_requests` table; `sort_order` is backfilled by shop in creation order so nothing visibly reshuffles the day this ships — the same "seed reproduces the current order exactly" discipline Phase 42's and Phase 44's seed migrations already followed. New `NotificationType.restock_available`, wired through the existing `notification_service.notify` exactly like every other type since Phase 8.

### What's deliberately not in this phase

No re-introduction of `quantity`-as-inventory-count in any form — the removal above is final, not a placeholder for a future stock-tracking feature; if real inventory counts (more than one of the same item) are ever wanted, that's a materially bigger feature (decrementing on a real transaction, which this app doesn't have) and a phase of its own, not a side effect of this one. No bulk status actions on this screen in v1, even though Phase 45 built exactly that pattern for admin moderation — a seller pausing or marking out-of-stock is normally a one-item, in-the-moment action; worth adding later only if real usage shows sellers doing this to several listings at once. No named list of who requested a restock, matching the follower-count precedent. No restock requests on personal listings, per the scoping above.

**A real correction, found while building rather than assumed away: listing deletion in this app is a soft delete** (`deleted_at`, `is_active = False` — the row never actually leaves the table), so the FK's `ON DELETE CASCADE` on `listing_restock_requests` never fires the way the original plan text claimed ("cascades them away with it"). Caught by a failing test, not a review: `delete_listing` now explicitly clears any pending requests itself, since a soft-deleted listing can never reach `mark_available` again to answer them on its own and a row left behind would sit inert forever.

**`sort_order` also needed a real "manual" sort option on `browse_listings` itself**, not just on `list_my_listings` — the shop storefront page (Phase 22) renders through the same public browse endpoint everything else does, so the manual order had to be reachable there too. Added as `sort=manual`, ordered after the existing `featured_first` promotion key like every other sort option, and wired as the storefront's default fetch; it was not made the *global* browse default, since a manual order only means something within one shop.

**The migration backfills `sort_order` from each shop's existing newest-first order** (`ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY created_at DESC)`), verified directly against the seeded data before shipping — nothing about any shop's current display order changes on the day this lands.

29 tests: out-of-stock toggling both directions and its guards, relist undoing sold and paused with a refreshed expiry, pause and its guard, a paused listing dropping out of public browse for free, reorder with ownership and partial-list rejection, new listings appending to the end of a shop's order, quantity confirmed absent from every response, and the full restock-request lifecycle — creation scoped to shop-and-out-of-stock-only, self-requests refused, duplicate-pending refused via the partial index, withdrawal, the anonymous-sees-null case, fulfillment notifying every requester and stamping `fulfilled_at`, a fulfilled request not blocking a fresh one next cycle, `relist` never touching restock requests (proven by reaching past the API to construct the one state combination the API itself can't produce), cascade-on-delete via the explicit cleanup above, and the seller-facing count staying a count. Suite reached 260. Mutation-tested: skipping the duplicate-request check, accepting a partial reorder, skipping fulfillment inside `mark_available`, and accepting any status in `relist` each fail between one and five tests. Verified live end to end with a real seller/buyer/shop: a buyer's restock click, the seller's count badge, marking available, and the resulting notification row were each confirmed against the running stack, not just the test suite — including catching that the compact reorder-row badge intentionally shows a bare count rather than the word "restock," which a first verification pass flagged as a false negative before closer inspection.

---

## Phase 54 — Real category pickers for listings and shops (implemented)

Raised directly, five related complaints in one message: creating a shop required *typing* a category by hand; shop creation had no cover-photo upload option at all; the listing form forced picking a subcategory specifically rather than letting a top-level category stand on its own; the same rigidity applied to the (soon to exist) shop category field; and neither picker offered an "Other" escape hatch with a conditionally-shown text box. Checked against the actual code before touching anything:

| Ask | Found |
|---|---|
| Shop category should be picked, not typed | `shop_type` was a plain `<Input>` on both the create and edit shop forms — free text, entirely unconnected to the real `categories` taxonomy from Phase 27/43. |
| Cover photo on shop creation | `uploadShopCover` already existed as an API client function and `Shop.cover_url` already existed as a column — the backend support was there. The create form's submit handler simply never called it, only `uploadShopLogo`; cover upload was reachable only from the edit view, after the shop already existed. |
| Listing category forces a subcategory | The listing form's `<select>` rendered every subcategory as an `<option>`, grouped under its parent as a non-selectable `<optgroup>` label — a top-level category was never itself a choice. The backend never enforced this: `category_service.ensure_exists` accepts any active category id regardless of depth, so the restriction was pure frontend UI, not a rule worth having. |
| Same flexibility on the shop page | Blocked on the shop category picker above existing at all. |
| "Other", typed name shown only when selected | Neither form had this in any form. |

### What ships

**Listing form.** The category `<select>` is now flat: each top-level category is itself a selectable option, with its children listed indented underneath — picking "Electronics" and stopping there is a real, complete choice instead of a dead end that demands a subcategory next. An "Other" option is appended last; choosing it reveals a text input and hides again the moment anything else is picked. That text goes into `custom_category`, a new nullable column on `Listing` — set instead of `category_id`, never alongside it. Both `ListingCreate` and `ListingUpdate` enforce the exclusivity themselves (a validator clears `category_id` whenever `custom_category` is present) rather than trusting whichever field the client happened to send last. Deliberately *not* wired into the curated `categories` table itself: that taxonomy is admin-managed by design (see `category_service`'s own docstrings on why), and letting any seller's typed text become a permanent row would pollute the sidebar and browse taxonomy for everyone with one-off names. The listing detail page's breadcrumb and its JSON-LD `category` field both fall back to `custom_category` when there's no real category to show.

**Shop create + edit forms.** The free-text `shop_type` input is replaced with the same flattened parent/child select plus "Other," in a new shared `CategorySelectOptions` component so the option-list logic isn't written three times across the listing form and the two shop forms. `shop_type` itself stays exactly what it always was — a plain string column, no migration — because a shop is a single flat label, not a two-level classification; the select's value is a category id (or the "Other" sentinel) purely for picking from, resolved back to a display name (or the typed custom text) at submit time via a small `categoryNameById`/`categoryIdByName` lookup. Opening the edit form on a shop whose `shop_type` already happens to match a real category's name pre-selects that category rather than always parking it in "Other," so upgrading an existing shop doesn't visually reset something that already lines up.

**Cover photo on shop creation.** The create form gains a second file input next to Logo, uploaded via the already-existing `uploadShopCover` right after the shop is created — same sequencing, same non-blocking failure toast as the logo upload it sits beside, so a failed image never rolls back the shop itself.

**Backend surface:** one migration, `custom_category` (nullable `VARCHAR(100)`) added to `listings`, added to `ListingCreate`/`ListingUpdate`/`ListingOut`. No schema change to `shops` — `shop_type` needed nothing new, since the picker constrains what the frontend *sends*, not what the column *accepts*.

### What's deliberately not in this phase

No new `category_id` FK on `Shop` — that would make a shop a real two-level citizen of the taxonomy, which nobody asked for and which the storefront/admin surfaces aren't built to browse by; today's single flat label, now picked instead of typed, closes the actual complaint. No moderation or review queue for `custom_category` text — it carries the same trust level as every other free-text field a signed-in seller already controls directly (title, description, tags), and nothing about it is more exposed than those.

### Verification

115 existing listing/shop/category backend tests pass unchanged; the new migration applies cleanly on top of Phase 53's. Frontend typecheck and lint are clean on every touched file. No browser-automation tooling (Playwright/chromium-cli) is installed in this environment, so end-to-end verification was done directly against the running dev stack's API instead of a UI click-through: logged in as the existing `playwright.tester` fixture account, created a listing with a **top-level category and no subcategory** (previously impossible through the form) and confirmed it saved and returned correctly; created a listing with `custom_category` set and `category_id` omitted and confirmed `category` came back null with the typed name attached; sent both `category_id` and `custom_category` on the same request and confirmed the mutual-exclusivity validator wins in `custom_category`'s favor, matching what the form itself would never do but the API shouldn't trust blindly either way; and `PATCH`ed the test account's shop with a category-derived `shop_type` string, confirming it round-trips exactly like the old free-text value did. All test data created during this check was deleted and the shop's original `shop_type` restored afterward. Separately confirmed via the frontend dev server's own logs that `/shops/dashboard` and `/listings/new` both compile and serve `200` with the new components in place, with no console/build errors.

---

## Phases 55–59 — Live-site bug reports (planned, not yet built)

Six items reported together from the deployed site (`kenabechaju.deshlet.com`), not the dev stack — three screenshots plus four written complaints/questions. Each was traced to a real cause in the code before being turned into a phase; nothing here is a guess written up as a plan. Following the project's own rule for this kind of batch: plan every item first, confirm, then build one phase at a time rather than all at once.

### Phase 55 — Photo-change controls are invisible until you happen to hover (implemented)

**The report, with screenshots.** On "My Shops," the shop's logo circle shows the word "Change" sitting on top of it (screenshot 1) with no explanation of what it is. On the shop edit view, the same complaint from the other direction: "logo & cover photo change section is not properly visible" (screenshot 2) — i.e. it's *there*, but nothing about it reads as an editable, clickable thing.

**Root cause.** Both `ShopLogoPicker` and `ShopCoverPicker` (`frontend/app/shops/dashboard/page.tsx`) render their "Change" label as a `bg-black/50` overlay that's `opacity-0` by default and only reaches `opacity-100` via `group-hover`. That's the entire affordance — no icon, no border, no persistent hint that the image is interactive. Two real problems follow from that single design: it depends on a mouse, so it's undiscoverable by definition on the touch devices most students are actually using; and even with a mouse, a 48px circle that silently turns into black-with-white-text the instant a cursor drifts near it reads as a glitch to anyone who hasn't already learned the convention — which is exactly what screenshot 1 is.

**What shipped.** The hover-reveal overlay is gone. `ShopLogoPicker` now shows a small always-visible camera badge in the logo circle's bottom-right corner (a bordered dot, `size-5`); `ShopCoverPicker` shows a persistent "Camera icon + Change cover" pill in the cover banner's bottom-right corner. Both components are shared between the collapsed shop row and the edit view's `FormSection`, so fixing them once fixes both places the report named. No hover state to discover, nothing that depends on a mouse. Verified: typecheck and lint clean, `/shops/dashboard` compiles and serves 200 against the running dev stack.

### Phase 56 — "Add listing" from a shop still opens on Personal listing (implemented)

**The report, with a screenshot.** Clicking **Add listing** from "DeshLet-The Meat Codex" correctly lands on `/listings/new?shop_id=<that shop's id>` (screenshot 3's URL bar confirms the id arrives), but the "Sell as" dropdown still shows **Personal listing** selected. This exact bug was already fixed once, before Phase 53 — and per the report, the fix hasn't actually held.

**Root cause, re-diagnosed rather than re-assumed.** The existing fix (`ListingForm.tsx`) does this inside the data-loading `.then()`:

```ts
Promise.all([getMyShops(), getCategories()]).then(([shopsRes, catsRes]) => {
  setShops(shopsRes);
  setCategories(catsRes);
  if (mode === "create" && defaultShopId) {
    setValue("shop_id", defaultShopId);   // <- runs here
  }
});
```

The comment above it correctly diagnoses the *original* bug (a native `<select>` can't select a value with no matching `<option>` yet) but the fix has the same bug shifted by one tick: `setValue` runs synchronously, in the same callback as `setShops`. React batches that state update and doesn't actually insert the new `<option>` elements into the DOM until it commits the next render — which happens *after* this callback returns. So `setValue` still fires before its own `<option>` exists, for the same reason as before, and the browser still falls back to whatever was already selected (index 0, "Personal listing").

**What shipped.** The data-fetch effect now only fetches and calls `setShops`/`setCategories`; the `setValue("shop_id", defaultShopId)` call moved into its own `useEffect` keyed on `[shops, mode, defaultShopId, setValue]`. Effects run strictly after React commits the DOM for the render that produced them — the one guarantee the original fix needed and didn't have, since a plain callback inside `.then()` runs in the same tick as the `setShops` call, one render too early. Honest note on verification: this environment has no browser-automation tool and no frontend test framework installed (zero `*.test.ts(x)` files exist at all — that gap is Phase 48, still open), so this was verified by tracing React's actual commit/effect ordering against the code rather than by watching the select visually update. That's a real limitation given this exact bug was already "fixed" once and reported broken again — flagging it plainly rather than re-claiming a confidence level the tooling here can't back up.

### Phase 57 — Drag-and-drop reordering, replacing arrow buttons (implemented)

**The ask.** Every reorder screen this project has (listing photos — Phase 38, a shop's own listing order — Phase 53, admin sections/categories/nav-links — Phases 42–44) uses up/down arrow buttons, a deliberate choice at the time to reuse one interaction pattern everywhere rather than introduce drag-and-drop for just one screen. Directly requested now: real drag-and-drop instead.

**What shipped.** A shared primitive, `components/ui/sortable-list.tsx` (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` — pointer- and keyboard-accessible, unlike a raw HTML5 drag API, which matters since these lists already have to stay usable on the touch devices most of this app's traffic comes from): `SortableList` wraps a `DndContext`/`SortableContext` pair and turns a drag into the same `nextIds: string[]` shape every reorder endpoint already expects; `SortableItem` wraps one row (`<li>` by default, `as="div"`/`as="section"` for the two spots that need something else); `DragHandle` is a separate drag-activator button rather than making the whole row draggable, so clicking a title link or a toggle inside a row is never mistaken for the start of a drag. Retrofitted onto all five existing arrow-button screens — same endpoints, same full-list-required contract each already had (Phase 38/42/43/44/53's `reorder` calls take every id, not a delta), so this changes the *input method* only, never the ownership/validation rules already enforced server-side:

- **Listing photos** (`ListingPhotoManager`) — grid strategy (`rectSortingStrategy`), handle in each tile's corner.
- **A shop's own listing order** (`dashboard/listings`) — vertical list.
- **Admin landing-page sections** — vertical list.
- **Admin categories** — the trickiest one, because reordering is scoped per *sibling group* (`reorderCategories(parentId, ids)` takes one parent's children, or the top level — never a mix), while the on-screen list interleaves parents and children visually. Solved with nested `SortableList`s: one outer context for the top-level parents, and one inner context per parent for just its own children, wrapped in a `display:contents` grouping `<div>` so the nesting doesn't add extra boxes to the flex layout. A drag is contained to whichever context it started in, so it's structurally impossible to drag a child into the top-level order or vice versa.
- **Admin navigation** — two independent reorder scopes on one screen: links within any single menu, and the footer columns' own order. Each gets its own `SortableList`.

Arrow buttons stay everywhere, unchanged, as the keyboard/screen-reader path — dragging alone is a worse experience for both than what already existed, so this is purely an added input method wired to the same `onReorder`/`move` logic the arrows already call.

**Verification.** Typecheck and lint are clean across every touched file (`sortable-list.tsx` plus all five retrofitted screens) — one real lint catch along the way: the drag-handle's context object mixed a ref-setter with plain data, which tripped the React Compiler's ref-safety rule as a false positive on the *other* fields in the same object; destructuring the context first instead of accessing `ctx.field` inline resolved it cleanly. All five pages compile and serve `200` against the running dev stack with nothing in the console/build logs. Same honest limitation as Phase 56: no browser-automation tool is available in this environment, so the actual pointer-drag gesture itself wasn't exercised end-to-end — verified against `@dnd-kit`'s documented API and the same code-level scrutiny as the rest of this phase, not a live click-through.

### Phase 58 — Chat messages don't arrive live; only after a reload (implemented)

**The report.** A sent message shows up for the other side only after they refresh the page — the WebSocket path isn't delivering it live.

**Root cause, found in the actual deployed configuration, not assumed.** The push logic itself is correct: `POST /conversations/{id}/messages` calls `manager.send_to_user(message.receiver_id, {"type": "message", ...})` (`app/routers/chat.py`), and `ConnectionManager` (`app/websocket/manager.py`) tracks live sockets keyed by user id. The bug is that this registry is a **plain in-process Python dict** — and the production `Dockerfile` runs the backend as `uvicorn ... --workers 4`. Four separate OS processes means four separate, unsynchronized copies of `ConnectionManager._connections`. A user's live socket is registered in whichever worker Traefik happened to route their WebSocket upgrade to; the very next `POST /messages` from the other party can land on any of the other three workers, whose in-memory registry has never heard of that socket — so `send_to_user` iterates an empty set and silently does nothing. A page reload works because it goes through the database, which every worker shares; only the live push is worker-local. This is invisible in dev (`docker-compose.yml` runs a single `--reload` process, so there's only ever one registry) and only shows up under the production process count — exactly matching what was reported from the live site and not from local testing.

**What shipped.** Redis pub/sub, the real fix rather than the `--workers 1` fallback — this app's worker count exists for a reason and the fix shouldn't trade it away to get correctness. `ConnectionManager` (`app/websocket/manager.py`) keeps its existing per-process `_connections` dict exactly as before — that's still what a socket is actually held in — but `send_to_user` no longer writes to it directly. Instead it publishes `{"user_id", "data"}` onto one shared Redis channel (`ws:broadcast`), and every worker process (there's no special-casing for "am I the one holding this socket" — every process just subscribes and checks its own registry on every message) runs a listener task that delivers locally whenever the published `user_id` happens to be one it's holding. A process that isn't holding that user's socket just no-ops. If Redis is unreachable at startup, `send_to_user` falls back to local-only delivery rather than the app failing to boot — a Redis outage degrades chat back to today's bug rather than taking the whole API down with it.

New infrastructure: a `redis:7-alpine` service in both `docker-compose.yml` (dev, with a named volume and healthcheck, `backend` now `depends_on` it the same way it already does `db`) and `docker-compose.prod.yml` (prod, no volume — it holds nothing but pub/sub channels — and no exposed port, since nothing outside the compose network ever needs to reach it directly). `REDIS_URL` is a new `Settings` field defaulting to `redis://redis:6379/0`, which is also what `docker-compose.prod.yml` hardcodes directly in the backend's environment block — same reasoning `DATABASE_URL` already isn't a Dokploy-configurable secret: it's an internal container-network address, not something that varies per deployment, so it doesn't need an entry in `.env.prod.example`. The `redis` Python package (`redis.asyncio`) is a new backend dependency. The pub/sub listener starts and stops in `main.py`'s lifespan, right alongside the existing heartbeat task — which also means it's automatically excluded from the test suite exactly the way the heartbeat already was (`ASGITransport` never runs the app lifespan), so no test changes or test-environment Redis were needed.

**Verification — the most rigorous of this batch, because this bug had already burned a "looks fixed" claim once before (Phase 47 diagnosed the identical issue and was apparently never actually shipped).** Backend: all 260 tests pass unchanged. Then two live round-trips against the real running stack, not just reasoning about the code:
1. Single-process: opened a real WebSocket as one user (via the `websockets` library), sent a real message as the other user through the normal REST endpoint, and confirmed the live `type: "message"` frame arrived — proving the pub/sub plumbing itself works end to end.
2. **The test that actually matters**: launched a second backend instance with `--workers 3` (mirroring production's `--workers 4`, just fewer to keep the test fast), reachable over the compose network, and repeated the same round trip **12 times with a fresh WebSocket connection each time** — cheap enough that the OS's connection load-balancing (`SO_REUSEPORT`) would have scattered those 12 sockets across all 3 worker processes if left to chance, largely independently of which worker happened to handle each REST send. All 12 delivered live. If the fix were still process-local only, the odds of all 12 independent trials coincidentally landing on the same worker as their matching REST call are on the order of 1 in 170,000 — this is about as close to a definitive live-environment proof as this setup can produce without a browser. The multi-worker instance and all test messages were removed afterward.

### Phase 59 — No way to review a shop, and "Featured" vs "Top" isn't explained anywhere

**Reviews.** A `RatingForm` genuinely exists and is wired into the listing detail page — but only when `GET /listings/{id}/rating-eligibility` returns `can_rate: true`, which `rating_service.check_eligibility` restricts to: the listing is `sold` or `out_of_stock`, the viewer isn't the seller, the viewer has an existing conversation on that listing (i.e. actually messaged about it), and they haven't rated it already. That's a deliberate real-transaction gate, not a bug — but it means a rating can only ever be left from the *listing* page, after messaging and a completed sale, and there is no path to it from the *shop* page at all: `app/shops/[slug]/page.tsx`'s Reviews tab only lists existing reviews, with no button, link, or hint pointing back to "go rate a purchase to leave one." A buyer who finishes a trade and goes looking for "review this shop" on the shop's own page finds nothing, which is the actual gap in the report — not that rating is broken, but that it's undiscoverable from the one place a buyer would naturally look for it.

**What ships.** The shop page's Reviews tab, when a viewer has at least one eligible-to-rate listing from that shop, surfaces a direct link into the relevant listing's rating prompt instead of silently having nothing there for them — closing the discovery gap without loosening `check_eligibility`'s real-transaction requirement, which stays exactly as strict as it is today.

**Featured vs. Top**, answered directly since it's a real, reasonable question and not a bug: `is_featured` is a **time-boxed, seller-facing promotion** — `featured_until` is a real deadline (`ListingFeatureIn.days`, 1–90), computed live (`is_featured = featured_until > now`), and it outranks Top wherever both could show (`FeaturedBadge` wins over `TopBadge` in `ListingCard`). `is_top` is the opposite on every axis: **permanent, admin-only, and not something a seller can set** — `toggle_listing_top` is an admin action (`app/routers/admin.py`), used for a curated "Top pick" designation that feeds the homepage's Top Products section. In short: Featured is "this seller boosted this listing for a while," Top is "an admin has vouched for this one, indefinitely." Neither label explains itself in the UI today, which is worth a one-line tooltip on each badge — folded into this phase as a small addition alongside the review-discovery fix above, rather than earning a phase of its own.

---

## Phase 60 — Admin-editable site branding, and mobile navbar fixes (implemented)

Three items from one message: admins should be able to change the logo/contact email/WhatsApp/social links without a deploy; the footer's "Source on GitHub" link needed to go; and a broader ask to make the whole system responsive, which started with two mobile screenshots (an inbox view and the homepage hero) as evidence.

### Site branding, extending the existing SiteSetting mechanism

`SiteSetting` (Phase 44) already exists as a generic key→JSON-blob table, used for `navbar_controls` and the announcement banner — "missing keys take their default, so an empty row is a fully working site" was already the established rule. This phase adds a third key, `site_info` (`logo_url`, `contact_email`, `whatsapp_number`, `social_links`), following the exact same shape: a service pair (`get_site_info`/`set_site_info`, mirroring `get_navbar_controls`/`set_navbar_controls`), bundled into the existing public `GET /navigation` payload alongside the other two (one round trip for all site chrome, same reasoning as before), and an admin editor added to the existing `/admin/navigation` page rather than a new screen — it's the same SiteSetting-backed data the rest of that page already manages. Logo upload reuses `media_service.save_image` exactly like shop logos do, under its own `site` subdirectory. `Navbar` and `Footer` both swap in the uploaded logo in place of the hard-coded "K" badge when one is set, and Footer's social row is now built from `social_links` (any admin-named platform, with a small icon lookup and a generic globe fallback for unrecognised names) plus `contact_email`/`whatsapp_number` as their own entries — none of it hard-coded anymore.

**The "Source on GitHub" link is removed from the footer outright** — publicly linking a production consumer site to its own source repo was never asked for and isn't something to keep by default.

### Mobile chrome bugs, found from two screenshots

Both screenshots turned out to point at the same category of problem: the global navbar chrome — not any individual page — breaking under phone widths.

**The notification bell's dropdown rendered off the left edge of the screen**, with the word "Notifications" itself clipped. Root cause: it's a hand-rolled `absolute right-0 ... w-80` panel, not built on the shared Base UI `DropdownMenu` primitive every *other* dropdown in the app uses (the account menu sitting right next to it, for one) — so it never got the automatic viewport-collision handling that primitive provides. `right-0` anchors the panel's right edge to the *button's own box*, not the viewport; since the bell sits well left of the true right edge (the avatar and menu button are further right still), a fixed 320px-wide panel anchored that way runs off the left side of a ~375–390px phone screen. Fixed by making the panel `fixed inset-x-3 top-16` (viewport-clamped, can't overflow either edge) below `sm`, and only the original `absolute right-0 w-80` anchor from `sm` up, where there's room for it. Rebuilding it on the `DropdownMenu` primitive instead was considered and is probably the more correct long-term fix (real focus trapping, no manual click-outside listener) — not done here because the panel's content (a scrollable feed of linked/clickable notification rows) doesn't map cleanly onto `DropdownMenu`'s roving-focus menu-item semantics, and swapping the interaction model was a bigger change than this specific bug needed.

**The navbar's wordmark visually overlapped the language switcher** ("KenaBecha J[globe]বাংলা" in the screenshot, the "U" swallowed). Root cause: logo + wordmark on the left, and five controls on the right (language toggle, theme toggle, notification bell, avatar menu, hamburger menu) simply don't fit a ~375px viewport with nothing given up — nothing was set to shrink or hide, so the `whitespace-nowrap` wordmark ran into its neighbour instead of wrapping or being clipped. Fixed two ways: the language toggle drops its text label below `sm` (icon-only — the toggle still works identically, it just doesn't spend ~50px of a crowded row on a label that's pure convenience), and the wordmark gets `truncate` plus `min-w-0` up its flex ancestry as a graceful-degradation floor, so if the row is ever this tight again the text ellipsizes instead of visually overlapping something else.

**Noticed but deliberately not touched**: the signed-in navbar renders *both* an avatar dropdown menu and a hamburger sheet, and for a signed-in mobile visitor their contents mostly overlap (Dashboard/Profile/Inbox/My Shops/Sell/Logout appear in both). Dropping the hamburger for signed-in users looked like an easy further win, but the hamburger's link list (`primaryLinks`) is admin-configurable through the same navigation menus this project already lets an admin edit — an admin could have added a link there that isn't one of the avatar menu's fixed items, and removing the hamburger outright risked silently hiding it on mobile with no way back short of a code change. Worth a real look, not a decision made in passing here.

**Also noticed, and judged not to be a bug**: the homepage's trending-tags row sits partly behind the fixed mobile bottom nav at first paint, in the second screenshot. This is genuinely how a `position: fixed` bottom bar behaves everywhere it's used (Instagram, Twitter, this app's own admin-excluded pages) — it always covers the bottom ~56px of whatever's currently in the viewport, and a small scroll clears it. The root layout already reserves space for it at the very end of the document (`<div className="h-14 md:hidden" />` before the footer), which is the one place a fixed bar can permanently hide unreachable content; mid-page content briefly sitting behind it on first paint isn't that same problem and "fixing" it would mean padding every section against a bar that's only ever near the bottom transiently. Left alone.

### What's still open

The user flagged four areas as having mobile issues: browse/listing pages, shop pages & forms, inbox/chat, and the admin panel. Only the navbar/notification-bell chrome (shared by all of them) was diagnosed and fixed here, from the two screenshots actually provided. The admin panel's own tab bar was checked and is already fine (`overflow-x-auto` + `shrink-0` on the tabs, so it scrolls horizontally rather than breaking) — but nothing inside individual admin screens, the chat window, or listing/shop forms has been audited yet; that needs the same evidence-first treatment as this phase rather than a guess-and-fix pass across dozens of pages. Real screenshots of specific broken screens are the fastest path there, same as the last two rounds of bug reports in this document.

---

## Notable deviations & judgment calls not covered above

A handful of decisions that don't map to a single phase above, or that add context the phase entries didn't have room for:

- **No self-serve path to become an admin**, by design — `role` isn't settable via signup or any user-facing endpoint. The first admin was promoted directly in the database; `ADMIN_EMAILS` (env-driven, one-way) exists to make this repeatable without a shell.
- **"Warn user" remains a status-only resolution** — it records `resolved_warned` and a note but doesn't notify the user, since `NotificationType` has no "warned" variant and the spec never named one. "Ban" does have a real side effect (deactivation + session revocation), because that's a moderation action, not a notification.
- **Admin listing/shop views intentionally show removed/soft-deleted content**, unlike every public browse endpoint — a moderation dashboard needs full visibility.
- **Tag filtering on browse is ANY-match, not AND** — a listing matches if it has at least one selected tag.
- **Image validation was originally MIME-type-only**; magic-byte sniffing landed later, in Phase 25 (`SEC-04`).
- **Average ratings are computed on read** (`AVG`/`COUNT`), not denormalised — simplest correct approach at this scale, worth revisiting only if rating volume ever made per-request aggregation a bottleneck.
- **Reading the locale cookie in the root layout (Phase 31) opts every route into dynamic rendering.** Since every page was already a Client Component fetching at runtime, the static output was only ever an empty shell — correct first-paint language was judged worth more than caching that shell.
- **Anonymous visitors trigger two 401s from `/auth/me` on every page load.** Harmless (it's how the client detects "signed out") and noisy in the dev console. Not yet silenced.
- **The expiry sweeper (Phase 30) starts in every worker's lifespan**, so production runs four copies of it hourly. The UPDATE is idempotent, so this is wasteful rather than harmful — not worth a leader-election mechanism for a 30-day job.

---

## Appendix — Original planning documents

The material below was written *before* implementation began and is kept verbatim as a historical record. Where it disagrees with the phase log above, the phase log is what actually shipped.

### A1 — Original schema & folder-structure plan (2026-08-01, approved before Phase 1)

`prompt.md` specifies a full marketplace web app (Next.js + FastAPI + Postgres, Docker/Dokploy deployment) for JU students to buy/sell used items and run small shops. The spec explicitly asked for schema + folder structure to be proposed and confirmed before any scaffolding code was written.

**Decisions confirmed with the user at the time:**
- Project name: **KenaBecha JU**.
- Media storage: local Docker volume for both dev and prod (S3-compatible storage deferred).
- Google OAuth: deferred to a later increment; `auth_provider`/`google_id` columns included on `users` from day one so no migration rework was needed when it landed (Phase 10).

**Schema conventions:** UUID PKs (app-generated), `created_at`/`updated_at` TIMESTAMPTZ on all mutable tables, soft-delete (`deleted_at`, `is_active`) on `users`/`shops`/`listings` only, native Postgres ENUMs except where free text made more sense (`shops.shop_type`, `tags.name`).

**Tables as originally proposed** (see the phase log above for what actually shipped and where it diverged — most notably `users` gained JU-verification columns in Phase 3, `carts`/`orders` were added in Phase 11 and removed after, and `categories`/`page_sections`/`nav_menus`/`nav_links`/`site_settings`/`audit_log` were added much later in Phases 27 and 40–45):

- **`users`** — id, email (unique), hashed_password (nullable), full_name, avatar_url, phone, bio, role (user/admin), auth_provider (local/google), google_id, is_active, is_verified, timestamps.
- **`shops`** — id, owner_id (FK), shop_name, slug (unique), description, shop_type, logo_url, cover_url, is_active, timestamps.
- **`listings`** — id, seller_id (FK, required), shop_id (FK, nullable), title, description, price, price_type (fixed/negotiable/free), condition, quantity, status (active/sold/out_of_stock/removed), timestamps. GIN trigram index on title/description for keyword search.
- **`listing_images`** — id, listing_id (FK cascade), image_url, sort_order.
- **`tags`** — id, name, normalized_name (unique), usage_count. GIN trigram on normalized_name.
- **`listing_tags`** — join table, composite PK, cascade delete both sides.
- **`conversations`** — id, listing_id, buyer_id, seller_id, shop_id, last_message_at. `unique(listing_id, buyer_id)`; `check(buyer_id != seller_id)`.
- **`messages`** — id, conversation_id (FK cascade), sender_id, receiver_id, content, read_at (null = unread).
- **`ratings`** — id, listing_id, rater_id, target_type (shop/user), target_shop_id/target_user_id (polymorphic via two nullable FKs + discriminator + CHECK), stars (1–5), review_text. `unique(listing_id, rater_id)`.
- **`reports`** — id, reporter_id, target_type (listing/shop/user), target FKs (same polymorphic pattern), reason_code, note, status, resolved_by, resolved_at, resolution_note.
- **`notifications`** — id, user_id, type, title, body, link_url, related FKs, is_read.
- **`refresh_tokens`** — id, user_id (FK cascade), token_hash (unique), issued_at, expires_at, revoked_at, replaced_by_token_id (rotation chain), user_agent, ip_address.
- **`auth_tokens`** — id, user_id (FK cascade), token_hash (unique), purpose (password_reset/email_verification), expires_at, used_at.

**Backend folder structure, as proposed:**

```
backend/
  app/
    main.py                    # FastAPI instance, router registration, CORS, exception handlers
    core/                      # config.py, security.py, dependencies.py, exceptions.py, logging.py
    db/                        # base.py, session.py
    models/                    # SQLAlchemy ORM models
    schemas/                   # Pydantic DTOs
    routers/                   # auth, users, shops, listings, tags, chat, ws, ratings, reports, admin, notifications
    services/                  # business logic per domain
    websocket/                 # manager.py, handlers.py
    tasks/                     # BackgroundTasks senders
    seed/                      # seed.py + factories.py
  alembic/
  tests/
  Dockerfile                   # multi-stage: dev / prod
```

`tasks/` was never split out separately in practice — email sends are queued inline at each call site via `background_tasks.add_task`. `seed/` was never built; a documented manual-promotion step (`ADMIN_EMAILS` / a direct `UPDATE`) covers the one case that mattered.

**Frontend folder structure, as proposed:**

```
frontend/
  app/
    layout.tsx, page.tsx, middleware.ts
    (auth)/login, signup
    listings/ (browse, new, [id], [id]/edit)
    shops/ ([slug], dashboard)
    profile/ ([id], settings)
    inbox/
    admin/
  components/                  # ui/, listings/, shops/, chat/, ratings/, admin/, notifications/, layout/
  lib/
    api/                       # typed fetch client, credentials:'include'
    ws/client.ts
    validation/                # zod schemas
  hooks/
  context/AuthContext.tsx
  types/api.ts
  Dockerfile
```

Route protection ended up as **`proxy.ts`** at the repo root rather than `app/middleware.ts` — Next.js 16 renamed the middleware file convention to `proxy`.

**Docker/Dokploy, as proposed:** `docker-compose.yml` for local dev (bind-mounted source, `--reload`/`next dev`); `docker-compose.prod.yml` targeting Dokploy with slim prod images, no bind mounts, code baked in, Postgres and media each on a named volume, secrets via Dokploy's environment UI. Built as described; the frontend's prod target additionally uses `output: "standalone"`.

### A2 — Phase 9+ design brief (2026-08-01, written before Phases 9–13)

Written per explicit request to plan the redesign, tiered-auth and cart/order work in detail before building any of it. Restored the original spec's minimal/Google-first signup vision (scoped to buyers only — sellers kept the full JU-verification requirement from Phase 3) and was an explicit, deliberate reprioritization of visual polish above the original "usability over flourish" guidance.

**Design system spec, as locked in before Phase 9:**
- **Stack:** shadcn/ui (Tailwind-native) + `next-themes` for flash-free theme switching + Framer Motion, layered on Tailwind's `transition-*`/`animate-*` for simple hover/focus states.
- **Palette** — Light: `--background #fff`, `--foreground zinc-950`, `--primary emerald-600`, `--destructive red-600`, `--warning amber-500`, `--info blue-500`. Dark: `--background zinc-950`, `--foreground zinc-50`, `--primary emerald-500` (brightened for contrast), equivalent destructive/warning/info shifted lighter. Every token ships with a paired `-foreground` value.
- **Scales:** a documented spacing/typography/radius scale, and a planned explicit z-index scale (navbar 40 / dropdown 50 / drawer 60 / modal 100 / toast 200) — superseded in practice by consistently using portal-rendered shadcn overlays, which sort themselves out without a hand-maintained numeric scale (see Phase 13).

**Phases 9–13, as planned:** design system foundation → tiered auth (Google OAuth + full JU signup) → cart & orders with pickup/delivery fulfillment → public landing page → full application redesign pass. See the phase log above for what actually shipped; the cart/order system from this plan was later removed entirely (noted under Phase 11).
