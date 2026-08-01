# Project: KenaBecha JU

I'm building "KenaBecha JU" — a full-scale marketplace web application for Jahangirnagar University students to buy and sell used items, and for small student businesses to list their products. It's inspired by an informal Facebook group called "Buy and Sell JU" and aims to bring that experience into a proper, searchable, organized web platform.

## Environment / Deployment Context
- I have Docker running locally already — use it for local development (docker-compose).
- I already own a VPS with Dokploy installed on it — the project should be structured so it deploys cleanly to Dokploy (which is Docker Compose based). Include a production-ready docker-compose.yml (or separate Dockerfiles per service that Dokploy can build from) alongside the local dev compose setup.

## Tech Stack
- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Backend:** FastAPI (Python 3.12), REST API + WebSocket endpoints
- **Database:** PostgreSQL, using SQLAlchemy (async) + Alembic for migrations
- **Auth:** JWT (access + refresh tokens) issued by FastAPI, consumed by Next.js via httpOnly cookies
- **Real-time chat:** Native FastAPI WebSocket support
- **Deployment target:** Self-hosted VPS via Dokploy (Docker Compose based)

## Repo Structure
Monorepo with two top-level folders:
- `/frontend` — Next.js app
- `/backend` — FastAPI app
- Root-level `docker-compose.yml` for local dev (postgres + backend + frontend)
- A production-oriented compose/Dockerfile setup Dokploy can consume directly

Work incrementally. Propose a plan and confirm with me before generating large amounts of code. Build in logical, testable chunks — don't scaffold everything in one shot.

## Core Data Model Concept: Users, Shops & Listings

A user can:
- Sell personal used items directly under their own profile (no shop needed)
- Create and own **multiple shops** (e.g. a "Food" shop and a separate "Jewelry" shop), each shop being its own mini-storefront with its own identity and rating

**Key tables:**
- `users` — base profile (name, email, avatar, phone, bio, etc.)
- `shops` — id, owner_id (FK → users), shop_name, description, shop_type/category (free text), logo/cover image, created_at
- `listings` — seller_id (FK → users, always required), shop_id (nullable FK → shops)
  - `shop_id = null` → personal/used-item listing, tied to the user directly
  - `shop_id` set → listing belongs to that specific shop
- `ratings` — attached to a **shop** for shop-based listings, or directly to the **user** for personal used-item listings (see Ratings section)

## Core Features

### 1. Authentication
- Open signup/login via email+password and Google OAuth (no university-only restriction)
- JWT access + refresh token flow, with secure httpOnly cookie storage on the frontend
- Password hashing with bcrypt/argon2
- Basic profile: name, avatar image, phone (optional), bio, member-since date
- Protected routes/middleware on both frontend and backend
- Minimal signup: just email/password or Google OAuth. Phone, bio, avatar, and shop creation happen later from profile settings — don't force these at signup.

### 2. Listings
- Create listing with: title, description, price (numeric, or flagged as "negotiable"/"free"), multiple images, custom tags, optional shop_id (post as personal or under one of your shops)
- **Condition field:** required and shown for personal/used-item listings (new / used-like new / used-good / used-fair). For shop-based listings, condition is hidden/defaults to "New" since shops are listing their own products.
- **Quantity/stock (optional):** shop listings can optionally set a quantity (shops may sell multiples of the same product); personal listings default to quantity 1 (one-off item)
- Tag system: users type free-text tags when posting; backend provides an autocomplete/suggestion endpoint that searches existing tags to reduce duplicates (e.g. "Book" vs "books")
- Owner can edit/delete/mark listing as sold (or "out of stock" for shop listings with quantity 0)
- Browse/search page with filters: tag(s), price range, condition, keyword search (title/description), sort by newest/price
- Listing detail page: image gallery/carousel, full description, seller context (shop name/logo + shop rating if it's a shop listing, or seller name/avatar + personal rating if personal), "Contact Seller" button that opens/starts a chat

### 3. Shops & Storefronts
- Users manage their shops from a "My Shops" dashboard: create/edit/delete shops
- Each shop has its own dedicated storefront page: banner/logo, description, category, all active listings from that shop, and the shop's own average rating
- User's main profile page shows: their personal listings (used items) in one section, plus a card per owned shop below it (mini-storefront preview: shop name, logo, listing count) linking to each shop's full storefront page

### 4. Real-time Chat (WebSocket)
- FastAPI WebSocket endpoint — connections are per authenticated **user** (shops don't have independent logins)
- Conversations scoped per listing: `conversations` table with `listing_id`, `buyer_id`, `seller_id` (the owning user), and `shop_id` (nullable, inherited from the listing for display purposes)
- **Chat context display:** if the listing belongs to a shop, the chat header shows the shop's name/logo (buyer feels like they're messaging the shop); if it's a personal listing, the chat header shows the seller's personal name/avatar
- **Owner's inbox:** all conversations land in one inbox (since it's all the same user account underneath), but each conversation is tagged with its shop (or "Personal") so the owner can filter the inbox by shop (e.g. "Show only Food Shop messages")
- Persist all messages in PostgreSQL (sender, receiver, listing_id, content, timestamp, read/unread status)
- Connection manager to track active WebSocket connections; deliver live messages to online users, and let offline users see missed messages on reconnect/next load
- Frontend: inbox/conversation list (with shop tag, last message preview, unread indicator) and a chat window with live updates, no page refresh needed

### 5. Ratings (per-shop / per-personal-seller)
- After a transaction (buyer can rate once the listing is marked "sold"/"out of stock" and they were the one who messaged about it), buyer can leave 1-5 star rating + optional short review text
- **For shop listings:** rating attaches to the shop, shown on that shop's storefront page (average rating across all that shop's transactions)
- **For personal listings:** rating attaches to the seller's user profile directly, shown on their profile page
- Enforce one rating per buyer per listing/transaction (unique constraint)

### 6. Custom Tags/Categories
- No fixed category dropdown — tags are freely created by users when posting a listing
- Autocomplete endpoint returns matching existing tags as the user types
- Browse/homepage shows trending/popular tags (most-used tags) as quick filters

### 7. Admin Panel
- Role-based access (user vs admin) enforced on backend
- Admin routes (e.g. under `/admin` on frontend, protected by role check) to:
  - View/search/manage all users (view, deactivate/ban)
  - View/manage/remove any listing or shop
  - View a queue of reported listings/shops/users and resolve reports (dismiss / remove content / warn or ban user)
  - Basic stats dashboard: total users, total shops, total active listings, total messages sent, reports pending
- Reporting system: any user can report a listing, a shop, or another user (reason + optional note), which lands in the admin queue

### 8. Notifications
- **Email:** via FastAPI BackgroundTasks + SMTP (or a transactional email provider) for: new message received (if user is offline), new rating received, listing/shop reported/removed, account-related emails (welcome, password reset)
- **In-app:** notifications table in PostgreSQL + REST endpoint to fetch/mark-as-read; bell icon with unread count dropdown on frontend, updated live via the existing WebSocket connection where possible

### 9. No Payment Integration
- Do NOT build any payment/checkout flow. The platform only facilitates discovery and contact between buyer and seller — they meet in person to complete the transaction and exchange payment outside the platform.

## Non-functional Requirements
- Fully mobile-responsive UI (majority of users will be on phones)
- Clean, minimal, fast UI — prioritize usability and load speed over visual flourish
- Pydantic models for all request/response validation on the backend; matching form validation (e.g. zod + react-hook-form) on the frontend
- Consistent error handling and user-friendly error messages throughout
- Environment-based config (.env for both frontend and backend) — no secrets hardcoded
- Seed script to populate the database with realistic dummy data (users, multiple shops per some users, personal listings, shop listings, tags, sample conversations, ratings) for local development and testing
- Write basic API documentation (FastAPI gives you Swagger/OpenAPI for free — make sure routes have proper descriptions/tags)

## What I want from you first (in order)
1. Propose the full PostgreSQL schema — all tables, columns, relationships (especially users ↔ shops ↔ listings, conversations ↔ messages ↔ shop context, ratings on shop vs user, and notifications). Show this as a schema diagram or table list for me to review before writing any migration code.
2. Propose the backend folder structure (routers, models, schemas, services, websocket manager, etc.) and the frontend folder structure (app router layout, components, hooks, api client).
3. Wait for my confirmation on both before scaffolding the project.
4. Once confirmed, start with: project scaffolding → database models/migrations → auth (signup/login/JWT) → listings CRUD (personal + shop-based). We'll layer chat (with shop context), ratings, admin panel, and notifications after that foundation is working and tested.