# KenaBecha JU

Marketplace web app for Jahangirnagar University students to buy/sell used items and run small shops.

- `/frontend` — Next.js (App Router, TypeScript, Tailwind)
- `/backend` — FastAPI (Python 3.12), REST + WebSocket
- PostgreSQL via Docker

## Local development

1. Copy env files (already done if you just cloned a fresh scaffold; regenerate if needed):
   ```
   cp backend/.env.example backend/.env
   cp frontend/.env.local.example frontend/.env.local
   ```
2. Start everything:
   ```
   docker compose up --build
   ```
3. Frontend: http://localhost:3000 — Backend: http://localhost:8000 — API docs: http://localhost:8000/docs

## Production (Dokploy)

`docker-compose.prod.yml` builds the same Dockerfiles' `prod` targets (no bind mounts, code baked into the image). Set the variables listed in `.env.prod.example` via Dokploy's environment variable UI, not committed files.
