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
