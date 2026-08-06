# Deploying KenaBecha JU to a VPS with Dokploy

Push to `main` → GitHub Actions runs the tests → if they pass, Dokploy rebuilds and restarts on the VPS.

A red build never reaches the server.

```
push to main
    │
    ▼
GitHub Actions
    backend   alembic upgrade head · alembic check · pytest (85)
    frontend  npm ci · tsc --noEmit · next build
    │
    │  (only if every check passed)
    ▼
POST $DOKPLOY_DEPLOY_WEBHOOK
    │
    ▼
Dokploy pulls, rebuilds, restarts
    │
    ▼
CI polls $API_URL/health until it answers
```

---

## Prerequisites

- A VPS running **Docker** with **Dokploy** installed (`curl -sSL https://dokploy.com/install.sh | sh`).
  Dokploy needs plain Docker — it does **not** run on a cPanel/WHM shared-hosting box.
- Two DNS **A records** pointing at the VPS IP, both created *before* the first deploy so
  Let's Encrypt can issue certificates:

  | Record | Points to | Serves |
  |---|---|---|
  | `kenabechaju.deshlet.com` | `144.79.249.226` | the site (frontend) |
  | `api.kenabechaju.deshlet.com` | `144.79.249.226` | the API (backend + WebSocket) |

  Both are in place and propagated. Note the apex `deshlet.com` points at a
  *different* host (`103.112.62.102`, the cPanel box) and is deliberately left
  alone — this deployment uses subdomains only.

  The API needs its own hostname because the browser calls it directly — for every
  request and for the chat WebSocket. It is not proxied through the frontend.

---

## 1. Create the application in Dokploy

1. **Project → Create Project**, name it `kenabecha`.
2. **Create Service → Compose**.
3. Source: **GitHub** → your repository → branch `main`.
4. Compose file path: `docker-compose.prod.yml`.
5. Save. Don't deploy yet — set the environment first.

## 2. Set the environment

Paste the contents of [`.env.prod.example`](.env.prod.example) into Dokploy's
**Environment** tab and fill in real values. The ones that must change:

| Variable | Notes |
|---|---|
| `APP_DOMAIN` | `kenabechaju.deshlet.com` — no scheme, no trailing slash |
| `API_DOMAIN` | `api.kenabechaju.deshlet.com` |
| `POSTGRES_PASSWORD` | generate: `openssl rand -base64 32` |
| `JWT_SECRET_KEY` | generate: `openssl rand -hex 32`. The app **refuses to start** in production with the placeholder value |
| `CORS_ORIGINS` | JSON array: `["https://kenabechaju.deshlet.com"]` |
| `NEXT_PUBLIC_API_URL` | `https://api.kenabechaju.deshlet.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://kenabechaju.deshlet.com` — must match `APP_DOMAIN` |
| `FRONTEND_URL` | `https://kenabechaju.deshlet.com` — used in email links |

> `NEXT_PUBLIC_*` values are **baked into the frontend image at build time**, not read at
> runtime. Changing one requires a rebuild, not just a restart.

## 3. First deploy

Click **Deploy**. On the first run Dokploy will build both images, then:

- the backend entrypoint runs `alembic upgrade head` before uvicorn binds, so the
  schema is always current — including `CREATE EXTENSION pg_trgm`, which the search
  indexes depend on;
- Traefik requests certificates for both hostnames;
- `db_backup` starts its nightly `pg_dump` loop.

Check it came up:

```bash
curl -fsS https://api.kenabechaju.deshlet.com/health     # {"status":"ok"}
curl -fsSI https://kenabechaju.deshlet.com | head -1     # HTTP/2 200
```

`/health` queries the database, so a 200 means the backend can actually serve — not
merely that the process is alive.

---

## 4. Wire up automatic deploys

### a. Get the deploy webhook from Dokploy

In the application → **Deployments** tab → copy the **Webhook URL**. It looks like
`https://<your-dokploy-host>/api/deploy/<token>`. Treat it as a secret: anyone holding
it can trigger a deploy.

### b. Add two GitHub secrets

Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `DOKPLOY_DEPLOY_WEBHOOK` | the webhook URL from step (a) |
| `API_URL` | `https://api.kenabechaju.deshlet.com` — optional; enables the post-deploy health check |

Set these in GitHub's UI only. Never commit them, and never paste them into chat or an issue.

### c. Disable Dokploy's own auto-deploy

If Dokploy's GitHub auto-deploy is enabled, **turn it off**. Otherwise it redeploys on
push *in parallel with* CI, and an untested commit reaches production anyway — which
defeats the point of gating.

That's it. The next push to `main` runs the checks and deploys itself.

---

## Backups

`db_backup` writes a gzipped `pg_dump` to the `db_backups` volume once a day and
deletes anything older than `BACKUP_KEEP_DAYS` (default 7). The dump is written to a
`.part` file and renamed only on success, so a partial file from an interrupted run is
never mistaken for a usable backup.

**This is not off-host backup.** A dump on the same VPS dies with the VPS. It covers the
common case — bad migration, accidental delete — not disk failure. For real safety, copy
the volume elsewhere:

```bash
# On the VPS, from any host with docker access:
docker run --rm -v kenabecha_db_backups:/b -v "$PWD":/out alpine \
  tar czf /out/kenabecha-backups.tar.gz -C /b .
```

### Restoring

Verified working: a dump taken from a live database restored into a scratch database
reproduced every row and the Alembic version.

```bash
# 1. Pick a backup
docker run --rm -v kenabecha_db_backups:/b alpine ls -lh /b

# 2. Stop the app so nothing writes mid-restore (leave db running)
docker compose -f docker-compose.prod.yml stop backend frontend

# 3. Restore into a fresh database, then swap it in
docker compose -f docker-compose.prod.yml exec db \
  psql -U kenabecha -d postgres -c "CREATE DATABASE kenabecha_restore"

docker run --rm -v kenabecha_db_backups:/b --network <project>_default \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres:16-alpine \
  sh -c "gunzip -c /b/kenabecha-YYYYMMDD-HHMMSS.sql.gz | psql -h db -U kenabecha -d kenabecha_restore"

# 4. Verify before switching — count what you expect to see
docker compose -f docker-compose.prod.yml exec db \
  psql -U kenabecha -d kenabecha_restore -c "SELECT count(*) FROM listings"

# 5. Swap
docker compose -f docker-compose.prod.yml exec db psql -U kenabecha -d postgres \
  -c "ALTER DATABASE kenabecha RENAME TO kenabecha_old" \
  -c "ALTER DATABASE kenabecha_restore RENAME TO kenabecha"

docker compose -f docker-compose.prod.yml start backend frontend
```

Keep `kenabecha_old` until you're satisfied, then drop it.

---

## Troubleshooting

**Certificates don't issue.** DNS must resolve to the VPS *before* deploying. Check with
`dig +short kenabechaju.deshlet.com`. Traefik retries, so fixing DNS and redeploying is enough.

**Site loads but nothing appears — empty listings, failed logins.** The browser can't
reach the API. Check `NEXT_PUBLIC_API_URL` matches `API_DOMAIN` exactly (scheme
included), that `https://api.kenabechaju.deshlet.com/health` answers, and that `CORS_ORIGINS`
contains the site origin.

**Backend restarts in a loop.** Check the logs for the migration step — the entrypoint
exits on a failed migration by design, because serving against a half-migrated schema is
worse than being down. Also confirm `JWT_SECRET_KEY` isn't the placeholder; the app
refuses to start with it when `ENV=production`.

**Changed a `NEXT_PUBLIC_*` value and nothing happened.** Those are build-time. Redeploy
rather than restart.

**Logs are unreadable JSON.** That's deliberate in production — one object per line, with
a `request_id` tying together every line from a single request. Read them with
`docker compose logs backend | jq -r '.message'`, or filter one request with
`jq 'select(.request_id=="abc123")'`.
