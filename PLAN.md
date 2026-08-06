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
- [x] **Phase 29 — Data-integrity & query-performance fixes.** Completed (Fixes for `DISTINCT ON` order in chat, `is_active` validation everywhere, shop pagination & N+1 ratings, tags usage_count decrement, image sort_order reordering, and deleted media cleanup).
- [x] **Phase 29a — Audit of Phases 27–29.** Reviewed the Phase 27–29 work and fixed six defects it introduced or left open: two TypeScript errors that broke `next build` entirely, an unhandled FK violation returning 500 on an unknown `category_id`, navbar search silently not applying when already on `/listings`, search suggestions offering sold/removed listings, `npm install` replacing `npm ci` in the frontend image, and the category field being optional so every sidebar count stayed at zero.
- [x] **Phase 30 — View counts, listing expiry & promotion.** Migration `87818c74aa4c`. De-duplicated view counting via a `listing_views` table (once per viewer per day, sellers excluded from their own counts), 30-day listing expiry with an hourly sweep task and an owner-facing Renew action, and admin-granted time-boxed promotion that floats a listing to the top of every browse ordering.
- [x] **Phase 31 — i18n completion (Bangla + English).** Moved the locale from localStorage to a cookie so the server renders the right language on first paint — the old approach failed hydration outright whenever Bangla was selected. Added Noto Sans Bengali, locale-aware number/currency/date/relative-time formatting with Bengali numerals, a ~280-key message catalogue with key parity enforced by the type system, and machine-readable error codes from the API so backend errors are shown in the user's language.
- [x] **Phase 32 — SEO, error boundaries, 404 & mobile bottom nav.** Full metadata with per-listing Open Graph and schema.org Product data, `sitemap.xml`, `robots.txt`, route-level and global error boundaries, a custom 404, a thumb-reachable mobile bottom nav, and real Terms/Privacy pages wired into the footer's previously dead links.
- [x] **Phase 33 — Backend test suite.** 74 tests against a real Postgres, covering auth, listing lifecycle, expiry/renewal, view counting, promotion, search escaping, categories, chat eligibility, rate limiting and upload validation — with the suite mutation-checked to confirm it actually fails on the bugs it claims to cover.
- [x] **Phase 35 — Navigation shell & shops browse page.** Browse Listings / Browse Shops / Sell Item / Inbox / My Shops are now top-level navbar destinations with active states, the avatar renders the user's actual photo, and `/shops` exists with search and sorting.
- [x] **Phase 36 — Shop card & homepage layout rhythm.** Shop cards now carry a cover band, logo, type, description, rating and listing/follower counts; the 6-column grid that stranded two cards is gone, section padding is uniform, and the mobile header no longer wraps to two rows.
- [x] **Phase 37 — Fulfillment: pickup *and* delivery.** Migration `8f3b25a0c9ef` adds `both` to the enum; the address stays required whenever pickup is on offer, and the listing page shows both options rather than picking one.
- [x] **Phase 38 — Listing form & edit page rebuild.** The form is grouped into labelled sections, and the edit page now carries everything: photo add/remove/reorder with cover selection, stock for shop listings, and status actions. Editing controls are off the public listing page.
- [x] **Phase 39 — Shop dashboard rebuild.** The shop logo is editable from the edit view (it previously vanished when you opened it), the form is grouped into Logo & cover / Shop details, and the page's untranslated English is gone. Also fixed a live 500 on `/notifications` caused by rows left behind by the removed orders feature.
- [x] **Phase 34 — DevOps: production compose, CI/CD, backups.** Migrations now run on deploy, `/health` actually checks the database, both app containers have health checks, Traefik routes the site and the API, GitHub Actions gates deploys on the full test suite before calling Dokploy's webhook, nightly `pg_dump` with a verified restore procedure, and JSON logs with request ids in production.

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

### Phase 29a — Audit of Phases 27–29
Senior-engineer review of the Phase 27–29 implementation. Findings, in severity order:

1. **`next build` failed outright** — `ListingForm.tsx` used `Condition` as a type without importing it, and `GradientCard.tsx` extended `React.HTMLAttributes` while rendering a `motion.div`, whose drag/animation handler signatures conflict. Turbopack dev doesn't typecheck, so both were invisible until a production build. `GradientCard` now extends `HTMLMotionProps<"div">` rather than `Omit`-ing conflicting handlers one at a time.
2. **500 on an unknown `category_id`** — the id went straight to the insert and surfaced the `ForeignKeyViolationError`. Added `category_service.ensure_exists`, called from both create and update; a bad id is now a 400.
3. **Navbar search did nothing on `/listings`** — the page read `searchParams` only in `useState` initializers, which don't re-run on a client-side navigation, so searching from the navbar while already on the browse page changed the URL and nothing else. Now synced via an effect keyed on the param values.
4. **Suggestions offered unavailable listings** — `get_search_suggestions` filtered `is_active`/`deleted_at` but not `status`, so sold and removed titles were suggested; picking one returned no results, since browse *does* filter on status. Also excluded deactivated sellers, and moved de-duplication before the limit so it returns a full set of suggestions.
5. **`npm ci` → `npm install` in the frontend image** — a reproducibility regression papering over an out-of-sync lockfile (missing sharp's `@emnapi/*` optional deps). Regenerated the lockfile inside the Linux container and restored `npm ci`.
6. **Categories weren't actually adopted** — optional in the schema, the Zod validator, and the form, so listings were created uncategorised and every sidebar count stayed at zero. Now required client-side; still nullable on the API, since listings predating the taxonomy legitimately have no category.

### Phase 30 — View counts, listing expiry & promotion
FEAT-04, FEAT-05, FEAT-07.

**FEAT-04 — view counts.** A raw hit counter would just measure refreshes, so views are de-duplicated in a `listing_views` table keyed on `(listing_id, viewer_key, window_start)` — one view per viewer per UTC day. `viewer_key` is the user id when signed in, otherwise a salted hash of IP + user-agent, so both kinds of viewer share one column and the de-duplication is enforced by a unique constraint rather than a read-then-write race across the four prod workers. Sellers viewing their own listing don't count. `listings.view_count` is denormalised off that table so browse and sorting never aggregate. Only the detail route records — `/related` and `/seller-reviews` also load listings, and counting those would inflate the number with traffic the seller never received.

**FEAT-07 — expiry.** New listings get `expires_at = now + 30 days`, and a new `expired` status distinct from `removed` so the dashboard can offer Renew rather than reading as a takedown. An hourly sweep task on the app lifespan (same shape as the WS heartbeat, no scheduler dependency) flips lapsed listings. Correctness doesn't depend on it: `browse_listings` also filters on `expires_at`, so a lapsed listing stops appearing whether or not the sweep has run. The migration backfills existing listings with a full window measured from the migration rather than from `created_at`, which would have expired most of the catalogue on first sweep. Sellers see a warning from 7 days out and a Renew button.

**FEAT-05 — promotion.** `featured_until` gives a time-boxed promotion separate from the permanent `is_top` flag. Applied as a leading sort key in every ordering rather than as a prepended list, so paging doesn't repeat featured items on each page. Admin-granted, not seller-set: there's no payment integration, and self-service promotion means everyone is promoted and the ordering stops meaning anything.

### Phase 31 — i18n completion
I18N-01→04 — the `LanguageContext` and `messages/{en,bn}.ts` existed but covered only the landing page.

**The foundation was broken, not just incomplete.** The old provider read `localStorage` in a `useState` initializer. That runs on the server (no `window`, so `en`) and again on the client (`bn`), so selecting Bangla failed hydration outright — React reported `Hydration failed because the server rendered text didn't match the client` and threw away the server tree. `<html lang>` also stayed `"en"` regardless of language, which misinforms screen readers and search engines. Both are fixed by moving the locale to a **cookie**: the root layout reads it server-side, stamps the right `lang`, and passes it to the provider as `initialLocale`. First paint is now already in the right language — no mismatch, and no flash of English.

**I18N-01 — font.** Inter has no Bengali coverage, so Bangla was falling back to whatever the OS supplied. Added Noto Sans Bengali via `next/font`, placed *after* Inter in the stack: font fallback is per-glyph, so Latin keeps using Inter and only Bengali codepoints fall through. Loaded in both locales, since student-written shop names and listing titles contain Bangla even in English mode.

**I18N-02 — extraction.** ~280 keys across nav, browse, listing detail, the listing form, the seller dashboard, auth, shops, inbox, profile, footer, and condition/status labels. `bn` is typed as `Translations` (= `typeof en`), so a missing or misspelled key is a compile error rather than a blank string in production.

**I18N-03 — formatting.** `Intl` with the `bn-BD` locale gives Bengali numerals (০১২৩৪৫৬৭৮৯), Bangla month names, and correct relative-time grammar. The formatters are exposed pre-bound to the active locale as `fmt.*` on the context, so call sites can't forget to thread the locale through — the usual cause of a stray English numeral on an otherwise Bangla page.

**Coverage.** Verified by rendering every major route in Bangla and flagging *any* remaining Latin-script word rather than only checking the strings I'd changed — the narrower check passed while breadcrumbs, stat tiles, tabs and the Share button were still English. All application strings are now translated. What remains Latin is database content: category names, hall and department names, and user-written listing titles and reviews. Translating those needs bilingual columns in the reference tables, which is a data/schema change rather than a frontend one.

**I18N-04 — backend error codes.** Responses now carry a stable `code` next to the English `detail`, via an `AppError` subclass and a dedicated exception handler. `translateApiError` maps code → translated string, falling back to the server's `detail` for unknown codes and to a network message for non-API failures, so an error can never render blank. Deliberately additive: plain `HTTPException` is unchanged and simply has no code, so raise sites migrate one at a time instead of in a flag day.

### Phase 32 — SEO, error boundaries, 404 & mobile bottom nav
FE-BUG-02, FE-BUG-03, FE-FEAT-16, FE-FEAT-17, FEAT-14 (legal pages).

**FE-FEAT-17 — SEO.** Root metadata gains `metadataBase` (without it Next warns and social crawlers, which never resolve relative URLs, get nothing), a title template, description, keywords, Open Graph and Twitter cards. Per-listing metadata comes from a thin **server** `layout.tsx` wrapping the client page, since Client Components cannot export `generateMetadata` — each listing now gets a real title, price-led description and OG image when shared on WhatsApp or Facebook. Sold and expired listings are marked `noindex` so they stop accumulating search traffic for something nobody can buy.

schema.org `Product` JSON-LD is emitted from that same server layout, **not** from the page. Rendering it in the client page put it nowhere in the initial HTML: the page shows a skeleton until its data arrives, so a crawler reading the server response saw no structured data at all. Verified by parsing the raw HTML rather than the live DOM.

`sitemap.ts` lists static routes plus the newest listings and shops, revalidating hourly, and swallows API failures — an empty-but-valid sitemap beats a 500, which crawlers read as a site-wide problem. `robots.ts` disallows the signed-in surfaces; `/inbox` in particular holds private conversations that must never be indexed if an auth check is ever loosened.

**FE-BUG-02 — error boundaries.** `app/error.tsx` catches route-level throws, keeping the navbar, footer and a way out instead of a white screen; it uses `unstable_retry()` rather than `reset()`, since a transient API failure needs a re-fetch, not just a cleared error state. `app/global-error.tsx` covers a throw in the root layout itself — it *replaces* the layout, so it gets no provider, no theme and no `globals.css`, and is therefore self-contained and inline-styled (its English text is a constraint, not an oversight).

**FE-BUG-03 — 404.** `not-found.tsx` shares the same shell, translated, with routes back to Home and Browse.

**FE-FEAT-16 — mobile bottom nav.** Home / Search / Sell / Inbox / Profile, fixed and thumb-reachable, hidden from `md` up where the navbar already shows everything. Suppressed on `/admin` and inside a chat thread, where it would sit on top of the message composer. A spacer reserves its height so it never covers the end of a page, and it respects `env(safe-area-inset-bottom)` for the iOS home indicator.

**FEAT-14 — legal pages.** `/terms` and `/privacy`, written against what this code actually does rather than from a template: the privacy page documents the salted-hash view counting, the 30-day listing expiry, exactly which profile fields are public (phone and WhatsApp are, deliberately), and that no payments are processed. The footer's Safety tips / Community rules links previously pointed at `/listings` — a dead end — and now reach the relevant sections.

**Trade-off carried over from Phase 31.** Reading the locale cookie in the root layout opts every route into dynamic rendering; routes that built as `○ (Static)` are now `ƒ`. Since every page is a Client Component fetching at runtime, the static output was only ever an empty shell, and correct first-paint language plus a working `lang` attribute is worth more than caching that shell. Worth revisiting if static delivery ever matters.

### Phase 33 — Backend test suite
FEAT-16 — `backend/tests/` was empty; zero coverage.

**74 tests, all green.** Split across auth (10), listings (30), search and categories (15), and guards — chat, rate limiting, uploads (19).

**Real Postgres, not SQLite.** The schema depends on native enums, `pg_trgm` indexes, `ON CONFLICT ON CONSTRAINT` and `ILIKE … ESCAPE`, so a SQLite stand-in would happily pass things production would reject. A throwaway `kenabecha_test` database is dropped, recreated and brought up with `alembic upgrade head` once per session — migrations rather than `metadata.create_all()`, so the tests exercise the schema that actually ships and inherit the seed data (halls, departments, categories) the API needs.

**Isolation by savepoint, not truncation.** The service layer commits constantly, which would end a plain outer transaction and leak state between tests. Binding each test's session with `join_transaction_mode="create_savepoint"` turns those commits into savepoint releases, so one rollback undoes everything — including rate-limit counters, which would otherwise bleed across tests and cause spurious 429s.

**What the harness taught us.** Three fixture bugs were worth the comments they now carry: the session must set `expire_on_commit=False` to match `app.db.session`, or every response serialisation dies with `MissingGreenlet`; `profile_complete` is a derived property, not a column, so it can't be forced; and Alembic's `env.py` calls `asyncio.run()`, which won't nest inside the fixture's loop and needs a worker thread. Fixtures that don't mirror the app's own configuration test a different application.

**Mutation-checked.** A passing suite proves nothing by itself, so three fixed defects were deliberately reintroduced — the suggestion status filter, the `category_id` validation, and the seller view-count exclusion. Each turned exactly the corresponding test red (4 failures, 70 passes) and nothing else, then the source was restored and the suite verified green again. That's the evidence the tests have teeth.

**Packaging.** The dev group moved from a PEP 735 `[dependency-groups]` — which needs pip ≥ 25.1, and the image ships 25.0 — to an optional-dependency extra installed only in the Dockerfile's `dev` stage. Verified by building the prod target and confirming `pytest` and `httpx` are absent while `fastapi` is present.

### Phase 39 — Shop dashboard rebuild

**The logo could not be changed while editing — reported from use, and worse than "missing".** The collapsed row and the edit view were mutually exclusive branches: the row rendered `ShopLogoPicker`, the edit view rendered `ShopCoverPicker` and the text fields. Opening Edit therefore *removed* the only control that could change the logo. Both pickers now live in the edit view, under a `Logo & cover` section, which is where a seller looks for them.

**Structure.** The page was a `max-w-2xl` column of unstyled inputs whose shape changed as you used it. The edit view is now two labelled sections — Logo & cover, Shop details — matching the listing form from Phase 38, and the collapsed row is a proper card showing type, active-listing count and follower count with Add listing / Edit / Delete actions.

**Translation gaps closed.** `Category`, `Description`, `Saving…`, `Save`, `Cancel`, `Uncategorized`, `active listing(s)`, `Add listing`, `Edit`, `Delete` and the delete-confirmation title were all still English. The Phase 31 sweep missed them because they sit inside a conditionally-rendered form that the audit script never opened — a reminder that a static text sweep only sees what is currently on screen.

### An unrelated live bug, found while verifying this phase

The browser console showed `Failed to fetch` on every dashboard load. It was not caused by this work: `GET /notifications` was returning **500**.

```
LookupError: 'order_placed' is not among the defined enum values.
Enum name: notification_type.
```

Removing the cart/orders feature earlier in the project dropped `order_placed` and `order_status_changed` from the Python `NotificationType`, but left seven rows in the table still carrying those values. SQLAlchemy raises while *loading* such a row, so a single orphan broke the notification bell for that account entirely — and it would have kept doing so silently, because the bell swallows its own errors.

Migration `3690eedd48d7` deletes them. Deleting is right rather than remapping: they point at orders that can no longer be opened, so there is nothing meaningful left to show. The Postgres enum keeps the labels, since dropping a value means recreating the type for no benefit. `/notifications` now returns 200 and the console is clean.

### Phase 34 — DevOps: production compose, CI/CD, backups

**DEVOPS-05 was already done.** Migration `0ad5c47e1b70` runs `CREATE EXTENSION IF NOT EXISTS pg_trgm`; the improvement.md item was stale. Recorded rather than re-solved.

**The biggest gap wasn't on the list: nothing ran migrations on deploy.** New code shipped against an un-migrated database 500s on every request touching a new column, and it looks like an application bug rather than a missed step. Four migrations landed in the preceding phases alone. `entrypoint.sh` now runs `alembic upgrade head` before uvicorn binds, with `set -e` so a failed migration stops the container starting — a half-migrated schema is worse than being briefly down — and `exec "$@"` so uvicorn becomes PID 1 and receives Docker's stop signals.

**`/health` was a stub returning `{"status": "ok"}` unconditionally** — worse than useless as a health check, since the process answers while Postgres is unreachable, so Docker keeps the container "healthy" and Traefik keeps routing to an instance that 500s. It now queries the database and returns 503 when that fails. Both outcomes are tested, the failure path by injecting a session that raises.

**A routing error caught before it shipped.** The first version of the Traefik labels published only the frontend, keeping the backend internal and routing `/media` through it. That would have broken the site completely: the browser calls the API directly for every request *and* for the chat WebSocket via `NEXT_PUBLIC_API_URL`. Meanwhile `/media` never needed a route at all — Next already proxies it over the container network (Phase 24), which is what keeps image URLs same-origin for the optimizer. Corrected to frontend on `APP_DOMAIN`, API on `API_DOMAIN`, no media route.

**CI/CD (DEVOPS-02), gated.** GitHub Actions runs `alembic upgrade head` from empty, `alembic check` for model/migration drift, the 85-test suite against a real Postgres 16 service, then `npm ci`, `tsc --noEmit` and `next build`. Only on a green push to `main` does it POST Dokploy's deploy webhook, then poll `$API_URL/health` until the new version answers — Dokploy returns as soon as the build is queued, so without the poll a green job would say nothing about whether the site came back. `concurrency` cancels superseded runs so two deploys can't race and land the older commit last.

**Backups (DEVOPS-03), with a restore that was actually tested.** A `db_backup` service dumps nightly to a named volume, writing to `.part` and renaming only on success so an interrupted run never leaves a file that looks usable. Retention is `BACKUP_KEEP_DAYS`. The restore was verified end to end rather than documented from memory: a dump of the live database restored into a scratch database reproduced 23 listings, 10 users, 4 shops and the Alembic version exactly. DEPLOYMENT.md is explicit that a dump on the same VPS is not off-host backup.

**Structured logging (DEVOPS-04).** JSON in production only — one object per line, so a traceback is one searchable event rather than twenty unrelated lines — and the readable format kept in development, where a human is doing the reading. A `RequestIdMiddleware` tags every line from a request, honours an inbound `X-Request-ID` so a proxy's id carries through, and echoes it on the response so the value in a user's network tab matches the logs. That matters here specifically because prod runs four uvicorn workers interleaving output.

**Noted, not fixed.** The expiry sweeper starts in every worker's lifespan, so production runs four copies hourly. The UPDATE is idempotent, so this is wasteful rather than harmful — not worth a leader-election mechanism for a 30-day job.

**What could not be verified from here.** The GitHub Actions workflow is syntax-valid and its job graph was checked, but a workflow only proves itself on a real push. Dokploy's webhook and the Traefik labels likewise need the actual VPS. The compose file resolves correctly and every rule was inspected, but the deploy itself is unproven until it runs.

### Navigation (Phase 35)

- **Only one link is actually in the navbar.** `Navbar.tsx` renders a single desktop link — Browse Listings. Inbox, Sell Item, My Shops and Dashboard exist only inside the avatar dropdown, so the app's primary actions are two clicks deep and invisible until you know to look.
- **The avatar is never shown.** The trigger always renders `user.full_name.charAt(0)` — a gradient circle with a letter. `user.avatar_url` is fetched, stored and used elsewhere, but the navbar ignores it, so a user who uploaded a photo still sees an initial.
- **There is no shops browse page.** `app/shops/` contains only `[slug]` and `dashboard`. Shops are reachable only from the six on the landing page. This is the same gap FE-FEAT-05 records, and it's why the Phase 32 sitemap had to drop `/shops` after it was found pointing crawlers at a 404. "Browse Shops" needs somewhere to go.

### Shop card and page rhythm (Phase 36)

- **The card is a bordered box.** Centered logo, name, type, rating, count — no cover image, no follower count, no hierarchy, and hover is a border-colour change. `Shop` already carries `cover_url` and the API already returns follower counts, so the data for a richer card is there and unused.
- **A grid bug, not a taste problem.** The Featured Shops grid is `grid-cols-2 sm:grid-cols-3 md:grid-cols-6`. With two shops each card is one sixth of a 1152px container, so two small cards sit against a wall of empty space. The column count needs to respond to how many shops there actually are.
- **Inconsistent vertical rhythm.** Landing sections mix `py-10`, `py-16`, `py-20` and `py-32` with no pattern, and headings use ad-hoc `mt-1`/`mb-6`. The result reads as uneven rather than deliberate.

### Fulfillment (Phase 37)

`FulfillmentType` is `pickup | delivery` — mutually exclusive. In reality a seller often offers both, and today they must pick one and explain the other in the description. Adding `both` touches the enum (migration), the create/update validators, the detail page's contact block, the card, the form, translations and tests. `pickup_address` becomes required for `pickup` **and** `both`.

### Listing form and edit page (Phase 38)

- **The edit page cannot edit most of the listing.** `ListingForm` gates several blocks on `mode === "create"`, so editing offers no photo management, no shop selection and no status control. Photo management instead lives on the public **detail** page as a bare "Manage photos: Remove #1" row — an editing control on a viewing surface.
- **No status control anywhere in the form.** Marking sold or out of stock is only possible from the detail page.
- **The form is one flat column.** Twelve fields in a single ungrouped stack inside a `max-w-lg` card, so pricing, photos, fulfillment and tags all read at the same weight.

### Shop dashboard (Phase 39)

- A `max-w-2xl` column of unstyled inputs with create, edit and logo/cover upload toggled inline, so the page changes shape as you use it.
- Leftover untranslated English (`Category`, `Description`, `e.g. Food, Jewelry, Electronics`) that the Phase 31 sweep missed because they sit inside a conditionally-rendered form.

### Noted, not scheduled

Anonymous visitors trigger two `401`s from `/auth/me` on every page load. Harmless — it's how the client detects "signed out" — but it's the noise behind the dev overlay's issue badge, and worth silencing later by treating 401 as an expected outcome rather than an error.

---

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

### Phase 35 — Navigation shell & shops browse page

**Navbar.** The desktop nav held exactly one link. Browse Listings, Browse Shops, Sell Item, Inbox and My Shops are now first-class destinations, with the account-only items (Dashboard, Profile, Admin, Log out) left in the avatar dropdown where they belong. Sell / Inbox / My Shops render only when signed in, since all three require an account.

Active state is a prefix match with one deliberate exception: `/shops` must not light up on `/shops/dashboard`, because Browse Shops and My Shops are two different destinations sitting side by side in the same nav.

**The avatar was a real bug, not a style choice.** The trigger always rendered `user.full_name.charAt(0)`; `avatar_url` was fetched and stored but never read, so anyone who uploaded a photo still saw a letter. Extracted into a `UserAvatar` component so the image and its initial-fallback can't drift apart again. Verified by setting an avatar on a test account and confirming a real `<img>` renders through `next/image` with `naturalWidth > 0`, then reverting the data.

**Breakpoint fix.** The inline links hide below `lg`, but the drawer trigger was `sm:hidden` — between `sm` and `lg` there would have been no navigation at all. Both now switch at `lg`. Signed-out visitors also get a drawer, which they previously did not: without it Browse Shops was unreachable on a phone until you logged in.

**`/shops`.** The route simply didn't exist — shops were reachable only from the six on the landing page. Now a full browse page with name/type search and three sort orders. Unrated shops sort *last* under "Highest rated" rather than as zero, so a brand-new shop isn't ranked below a badly-reviewed one. Filtering is client-side because the API returns the whole list and a single campus stays small; if that changes it should move to query parameters rather than growing a larger client-side sort.

With the route real, `/shops` goes back into `sitemap.ts` — Phase 32 had to remove it after catching it advertising a 404 — and joins the footer's marketplace column.

### Phase 36 — Shop card & homepage layout rhythm

**A correction to the audit.** It claimed follower counts were already returned by the API. They were not — `ShopOut` carried only listing count and ratings, and followers came solely from the per-shop `/shops/{slug}/stats` endpoint. Showing them on a grid of cards would therefore have meant one request per card.

Rather than drop the number, it was added properly: `get_shops_follower_counts` does a single `IN (…) GROUP BY`, mirroring `get_shops_rating_summaries` from Phase 29, and is wired into both list endpoints and the single-shop route. Verified from the query log that one `/shops` request issues exactly one `shop_follows` query covering every shop, not one per shop.

**The card.** Was a centred stack of plain text in a bordered box. Now a cover band with the logo straddling its edge (the standard storefront cue), name, type chip, two-line description, rating, and a footer with listing and follower counts. `cover_url` already existed on the model and was rendered nowhere. A shop with no cover gets a brand gradient rather than an empty grey rectangle, so it still reads as designed rather than broken.

**The grid was a bug, not a preference.** `md:grid-cols-6` meant two shops each occupied one sixth of a 1152px container — two small cards against a wall of empty space, which is what the screenshot showed. Now `1 / 2 / 3` columns, which suits cards of this weight and degrades sensibly at any shop count.

**Rhythm.** Content sections mixed `py-10` and `py-16` with no pattern, and headings used ad-hoc `mt-1` / `mb-6`. All content sections are now `py-14 sm:py-16`, sub-headings a consistent `mt-1.5 text-sm`, and section headings a consistent `mb-8`.

**Mobile header.** At 390px the wordmark broke after "KenaBecha" and doubled the header height. With `whitespace-nowrap` and a responsive size the header is a single row at every width — measured 57px at 390 and 768, 61px at 1500.

### Phase 37 — Fulfillment: pickup *and* delivery

`FulfillmentType` was `pickup | delivery`, mutually exclusive, so a seller who offered both had to pick one and explain the other in the description — where nothing can filter or display it.

**Migration `8f3b25a0c9ef`.** Alembic does not diff enum values, so `ALTER TYPE fulfillment_type ADD VALUE` is hand-written, as it was for `expired` in Phase 30. The downgrade deliberately raises `NotImplementedError`: Postgres cannot drop a value from an enum, and reversing this means rebuilding the type *and* deciding what happens to rows already set to `both` — a data question rather than a schema one, so it is left to whoever needs it rather than guessed at.

**The rule that matters: `both` includes pickup, so it still needs an address.** Encoded once as `OFFERS_PICKUP = {pickup, both}` and used by both the create validator and the update path, so the two cannot drift. The update path keeps validating the *merged* state rather than the payload, since a partial update may change the fulfilment kind without touching the address — switching a delivery-only listing to `both` is correctly rejected until an address is supplied.

**Display.** The listing page previously branched: pickup *or* delivery. For `both` it now renders both lines, which is the entire point — the buyer chooses. The details tab's address row shows whenever pickup is on offer, and the card reads the label from translations rather than capitalising the raw enum value.

**Coverage.** Five tests: creating with `both`, `both` without an address rejected, delivery-only clearing a supplied address, switching to `both` without an address rejected, and switching with one accepted. Suite now 79 passing. Verified in the browser that the address field appears for `both`, hides for `delivery`, and that a `both` listing renders both the pickup address and the delivery note.

### Phase 38 — Listing form & edit page rebuild

**The edit page could not edit most of a listing.** `ListingForm` gated blocks on `mode === "create"`, so editing offered no photos, no shop selection and no stock. Photo management lived on the *public* listing page as a "Manage photos: Remove #1" row — an editing control on a viewing surface — and marking something sold was only possible from there too.

**Sections.** Twelve fields in one ungrouped column became six labelled sections (Sell as · Photos · What are you selling? · Pricing · Stock · How the buyer gets it · Tags), each with a one-line explanation. Related fields sit side by side on desktop, and the submit button is sticky so it stays reachable on a form this tall.

**A new endpoint was needed.** The first image is the cover everywhere it appears, and there was no way to choose it — only append and delete existed. `POST /listings/{id}/images/reorder` takes the full ordering and **rejects a partial list**: accepting one would leave the omitted images at stale positions and produce duplicate `sort_order`s. Four tests cover reordering, partial lists, foreign image ids, and ownership.

**Photo management, in the right place.** `ListingPhotoManager` handles upload, delete, move, and promote-to-cover. These apply immediately rather than on submit, because they already do server-side — a Save button that appeared to defer them would be lying, so the section says so instead. Verified in the browser: upload took a listing from 1 to 3 images, promote-to-cover returned 200, delete returned 204 and left `sort_order` contiguous from 0. The browser assertion for promote-to-cover was weak (the first tile always shows the badge), so the identity change was confirmed separately against the API — the cover id genuinely changes.

**Stock.** Shop listings have a quantity that drives `out_of_stock`, and it was not editable anywhere. It now round-trips through the form, for shop listings only, since a personal listing is always a single item.

**Status actions.** Mark sold, Renew and Delete live in their own section rather than being smuggled into Save, because they take effect at once and have their own endpoints. Delete sits in a bordered danger area behind a confirmation.

**A stale-cache trap worth recording.** After the rewrite the edit route returned 404 while the file was plainly present and the production build had listed it. `docker compose restart frontend` did not clear it; the container had to be recreated with its anonymous `.next` volume removed (`docker compose rm -sfv frontend`). Worth reaching for whenever a route exists on disk but 404s.

---

## Admin panel plan (Phases 40–44)

Requested: role management for moderators, and admin control over the landing page, navbar and footer. What follows is the design, the trade-offs, and what is deliberately excluded.

### Where the admin panel stands today

| Area | Today |
|---|---|
| API | stats, users (activate/deactivate only), listings (remove, set top), shops (remove), reports (resolve) |
| Roles | `user` and `admin`. No middle ground — moderating anything requires full admin |
| Site copy | 422 translation keys compiled into the JS bundle at build time. Changing a headline needs a code change and a redeploy |
| Categories | seeded by migration `6605a57ca25d`. Adding one means writing a migration |
| Accountability | none. Nothing records who removed a listing or banned a user |

### Phase 40 — Roles: moderators

A `moderator` value on the existing enum, plus a split in the permission dependencies:

- `get_current_staff` — admin **or** moderator. Guards the moderation surface: reports, removing listings and shops.
- `get_current_admin` — admin only. Keeps user management, role changes and site content.

The point of the split is that moderation and administration are different jobs. A moderator should be able to act on a reported listing without also being able to grant themselves permissions or rewrite the homepage.

**Two rails, both tested:**

- **No self-promotion.** A user cannot change their own role, so a moderator who reaches the endpoint cannot escalate.
- **No last-admin demotion.** Demoting or deactivating the final admin is refused. Otherwise a single mis-click locks everyone out of the panel permanently — recoverable only with a database shell, which is the exact problem `ADMIN_EMAILS` was added to solve.

`ADMIN_EMAILS` continues to promote to admin and remains one-way.

### Phase 40 — Roles: moderators (implemented)

`moderator` added to the `user_role` enum (migration `ac73d6d3bc52`, hand-written as Alembic does not diff enum values; the downgrade raises rather than guessing what to do with anyone holding the role).

**The split.** `get_current_staff` (admin **or** moderator) is the router-level guard on `/admin`, covering reports, listings and shops. `get_current_admin` is applied individually to user listing, activation and role changes. A moderator can act on a reported listing without gaining the ability to grant permissions or edit the site.

**Rail 1 — nobody changes their own role, or deactivates themselves.** Placed on the *operation*, not on who may call it: the endpoint is admin-only today, but the guard should survive that changing. Without it, anyone reaching the endpoint escalates and the split is decorative.

**Rail 2 — the last active admin is protected.** Demoting or deactivating them is refused. This is the one mistake with no route back through the product: with no admin left nobody can reach the panel, and recovery means a shell on the database — the exact problem `ADMIN_EMAILS` was added to solve. Inactive admins deliberately do not count as cover, since they cannot log in.

**Demotion revokes sessions**, so a removed permission applies immediately rather than lasting until the current access token expires.

**A fixture bug surfaced while testing.** `make_user(role="admin")` left the attribute as a plain `str`, so `role.is_staff` raised — a row loaded from the database yields a `UserRole`. The fixture now coerces, since a helper that produces a shape the application never sees is worse than no helper.

13 tests cover the split in both directions and every rail, including that an inactive admin does not satisfy the "another admin exists" check. Suite 105. Verified in the browser: role select per row, own row shows "You" rather than controls that would only 400, and a promote/revert round-trip returned 200 both ways.

### Phase 41 — Audit log

**Deliberately before moderators get used in anger.** The moment removal powers belong to more than one person, "who deleted this shop?" becomes a question the system must be able to answer.

An `audit_log` table recording actor, action, target type and id, a small JSON detail blob, and timestamp. Written by the privileged endpoints, exposed read-only in the admin panel with filtering by actor and action.

Append-only, and not deletable through the UI — an audit trail an admin can quietly edit is not an audit trail.

### Phase 41 — Audit log (implemented)

An `audit_log` table recording actor, action, target and a JSON detail blob, written by every privileged endpoint and readable by admins only.

**Three design decisions, each load-bearing:**

- **The actor is snapshotted, not referenced.** `actor_id` is `ON DELETE SET NULL`, but `actor_email` and `actor_role` are copied in at write time. Reading the actor through the relationship would mean a deleted account turned all of its history into anonymous rows — an audit trail has to describe the past, not the present.
- **The target has no foreign key.** Targets get removed; the entry describing the removal must outlive them. A cascade here would delete exactly the records most worth keeping.
- **Entries share the action's transaction.** `record()` is deliberately synchronous and does not commit. A rejected role change or a 403 leaves nothing behind, and a successful action cannot end up unrecorded. Both directions are tested.

**Append-only.** There is no update or delete endpoint, and a test asserts that `DELETE`/`PATCH` against an entry return 404 or 405 — so if a future change ever adds one, it fails loudly. A trail an admin can quietly edit is not a trail.

**A real ordering bug, found by a failing test.** Two entries written in one transaction shared a timestamp, because the inherited `created_at` default is `now()` — which in Postgres is the *transaction* start time, not the wall clock. An audit log that cannot say which of two actions came first is a poor one, so `audit_log.created_at` now defaults to `clock_timestamp()`.

**And a blind spot that bug exposed.** The migration to fix it autogenerated as `pass`, because Alembic does not compare server defaults unless told to — which also meant the `alembic check` drift guard in CI would never have caught it. `compare_server_default=True` is now set in `alembic/env.py`, so a model and its table can no longer disagree about a default while CI reports clean.

11 tests: written on success, absent on failure and on 403, survives deletion of both actor and target, admin-only reads, filtering, ordering, and the append-only assertion. Suite 116.

### Phase 42 — Site content management

The largest piece, and the one with a real architectural decision.

**Store overrides, not content.** The bundled translations stay as the source of defaults; the database holds only the keys an admin has changed, per locale. Merged over the defaults when the app loads.

The alternative — moving all copy into the database — was rejected: it makes an empty or unreachable database a blank website, turns 422 keys into a data-migration problem, and loses the type-checked key parity between English and Bangla that the current catalogue enforces at compile time.

With overrides:

- an empty table means the site renders exactly as it does now;
- an admin edits only what they care about;
- "reset to default" is a delete, not a restore;
- a typo in a key name cannot blank out a page.

**Scope: the marketing surface only** — `hero`, `sections`, `howItWorks`, `cta`, `footer`, `nav`. Roughly 60 keys of the 422. The remaining 360 are UI mechanics (field labels, validation messages, error codes) where editing invites breakage for no benefit. Both languages are editable side by side, since a change to only one leaves the other silently stale.

**Delivery.** Fetched server-side in the root layout and merged into the language provider, so every existing `t.*` call site keeps working untouched — no page rewrites. Cached with a short revalidation window; the app is already dynamically rendered because of the locale cookie, so nothing is lost.

**Excluded for now:** rich text, image uploads, and section reordering. Each turns this into a page builder. Text first; revisit once it is actually in use.

### Phase 42 — Site content management (implemented, scope widened)

The plan above deliberately excluded reordering. That exclusion was overruled: the requirement became that every section be modular — reorderable, editable, hideable and removable. So the unit of management is the **section**, not the translation key, and the landing page is now assembled from a `page_sections` table rather than from JSX.

**Section types are code; section instances are data.** `SectionType` is a ten-member enum, each with a React component that knows how to fetch and render its own content. An admin adds, removes, reorders, hides and retitles *instances*; they cannot invent a type with no component to render it. The alternative — free-form blocks and a rich-text editor — is a page builder and a much larger product. This keeps every section's data typed and correct while still letting the page be rearranged without a deploy.

**The override principle survives intact**, just relocated. `settings` is a JSONB blob holding only the keys an admin has changed, stored per locale: `{"title": {"en": "…", "bn": "…"}}`. An absent key, an absent locale, or an empty string all fall through to the bundled translation — so an empty `settings` renders exactly what the site shipped with, and editing English cannot silently leave Bangla stale. Verified live in both directions: an English-only override leaves the Bangla page showing its bundled Bangla, not a blank heading.

**The defaults live in one place.** `lib/sectionCopy.ts` maps each section type to its bundled strings, and both the renderer and the admin editor read from it — the editor shows them as input placeholders, so an admin can see exactly what they are about to replace. Two copies of that answer would have drifted within a phase.

**Decisions worth recording:**

- **A migration seeds today's exact ten sections, in today's order, with empty settings.** The whole point is that the change is invisible on the day it lands. A test asserts that list, so if it ever drifts, an existing site was silently rearranged by a deploy.
- **New sections start hidden and last.** Adding one must not change the live homepage before the admin has written its copy.
- **`PATCH` replaces `settings` rather than merging.** Merging would make clearing a field impossible — an admin who deletes the text they added would find it still on the page.
- **Reorder requires every section exactly once**, mirroring image reordering. A partial list leaves the omitted rows at stale positions and produces duplicate `sort_order`s, after which the page renders in an arbitrary order — a silent corruption, so it is a loud 400.
- **Hiding preserves position.** Hide-then-show returns a section to where it was, which is what makes hiding the safe, reversible option next to deleting.
- **Delete is hard, not soft.** There is nothing to keep: content is generated by the component, and the type can be re-added at any time. What is kept is the audit entry, which snapshots the settings — the only remaining answer to "what did that section say?".
- **The page renders per request with a hard-coded fallback.** If the API is unreachable the ten default sections render anyway. Without that, one API blip turns the homepage into a blank screen — a far worse failure than a slightly stale arrangement.
- **Each section fetches its own data**, so a section that is switched off costs nothing; its request is never made. This is the main reason the page was split up rather than kept as one component with nine effects.
- **`CtaSection` hides itself from signed-in users regardless of the admin's setting.** Asking a member to sign up is noise.

**Two bugs caught in verification, neither by the type checker.** `onSelect` on a menu item typechecks — it is a real DOM attribute — but this project is on Base UI, not Radix, so the handler would simply never have fired. And adding an empty-state guard to the categories section, which the original did not have, dropped its heading from the server-rendered HTML; it now distinguishes "not fetched yet" from "genuinely empty" so crawlers still see it.

**Also fixed here:** the admin layout gated on `role === "admin"` outright, so the moderators added in Phase 40 could not reach the listing and shop screens the backend already authorised them for. Tabs are now filtered by role and a directly-typed admin-only URL is refused, rather than rendering a page that 403s on every request.

**And a defect the suite was hiding:** four unrelated tests were failing because the dev container's real Gmail SMTP credentials made them attempt to send live email. `SMTP_HOST` is now forced empty in `conftest`, so `send_email` takes its logging branch. Tests must never send real mail — and would have, to fake addresses, had the authentication succeeded.

24 tests: the seed, public visibility and ordering, admin-only access (moderators explicitly refused), replace-not-merge, per-locale storage, add/duplicate-key/unknown-type/delete/re-add, reorder with its two rejection cases, position preserved across hiding, and the audit trail including that a refused reorder records nothing. Suite 140, all passing. Mutation-tested: dropping the `active_only` filter and accepting a partial reorder each fail six tests.

### Phase 43 — Category management

The taxonomy is currently frozen in a migration, so adding a category means writing code. Admin CRUD, with the constraints the model already implies: two levels only, slugs unique and auto-derived, and a category holding listings cannot be deleted — it must be merged into another or emptied first, since `ondelete=SET NULL` would otherwise silently uncategorise real stock.

### Phase 43 — Category management (implemented)

Full admin CRUD over the taxonomy: create, rename, move, reorder, hide and delete, at both levels, all audited.

**This is the first admin surface where the content points at real stock**, and that shapes everything. Two foreign keys make a careless delete quiet rather than loud:

- `listings.category_id` is `ON DELETE SET NULL`, so deleting a category *succeeds* and leaves its listings uncategorised.
- `categories.parent_id` is `ON DELETE CASCADE`, so deleting a parent takes its children — and their listings — with it.

Neither fails with an error an admin would see. So:

- **A category holding listings cannot be deleted without a destination.** The API answers 409 with the count; `?move_to=` reassigns them first. The count deliberately includes sold and removed listings, because "what breaks if I delete this?" is a different question from "what can a visitor browse?".
- **A category with subcategories cannot be deleted at all.** Move or delete them first. Refusing is predictable; cascading through a subtree an admin may not have expanded is not.
- **Listings cannot be moved into the category being deleted.** A self-referential `move_to` would have satisfied the guard and then orphaned everything anyway.
- **One test states the property directly** rather than the mechanism: after every refused delete, no listing is left with a null category. It is the assertion that would survive a rewrite of all the others.

**Hiding is the reversible option, and the one to reach for.** `categories.is_active` mirrors the page-section flag: hiding removes a category from browsing without touching a single listing. Hiding a parent hides its children too — they are only reachable through it in the navigation, so leaving them visible would strand them. But a parent's listing count still includes hidden children's listings, because browsing a parent matches every descendant; a count that skipped them would promise fewer listings than the page then shows.

**Retired categories stay resolvable by slug.** Hiding takes a category out of navigation, not out of existence, so listings already filed under it remain browsable. This also surfaced a bug the flag would otherwise have introduced: `ensure_exists` now refuses a hidden category for anything new, but accepts it when it is the id the listing already had — saving any field resubmits the category, so a blanket refusal would have made every listing in a retired category permanently uneditable.

**Renaming leaves the slug alone.** The slug is the URL — every inbound link, bookmark and crawler index. Silently repointing all of it because someone fixed a typo in a label is a surprising cost for a cosmetic change, so changing the address is available but has to be asked for, with the consequence spelled out in the dialog.

**The two-level limit is enforced from both directions.** A category cannot be nested under a child, and a category that has children cannot itself be nested. `descendant_ids` only looks one level down, so a third level would not error — it would silently make a whole branch unbrowsable.

**Also in scope:** reordering is per level (the top level, or one parent's children), and demands every sibling exactly once, for the same reason sections and images do. `icon: null` clears an icon while an absent `icon` leaves it, which JSON alone cannot express — the router derives explicit flags from `model_fields_set`.

33 tests: the shipped taxonomy intact after the migration, admin-only access with moderators explicitly refused, slug derivation and collisions, both depth rules, moves and promotions, hiding and its cascade to children and to listing counts, the editable-when-retired case, per-level reordering with its rejections, all four delete refusals, and the audit trail including that a refused delete records nothing. Suite 173. Mutation-tested: removing the listing guard, the children guard, the depth guard, or the retired-category check each fails between one and seven tests.

### Phase 44 — Admin dashboard & moderation tooling

- A dashboard worth opening: signups, listings and messages over time, pending report count, most-viewed listings.
- Bulk actions on the moderation tables, which currently force one-at-a-time work.
- A site-wide announcement banner (maintenance notices, term dates), dismissible and scheduled — reusing the Phase 42 override mechanism rather than inventing a second one.

### Sequencing

Roles before audit log would mean handing out moderation powers with no record of their use, so 40 and 41 ship together in that order. 42 is independent and the most visible. 43 and 44 are additive and can be dropped or deferred without affecting the rest.

Estimated: 40 and 41 are small; 42 is the substantial one; 43 and 44 are moderate.

