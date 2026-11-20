# Deploying WASTABLE to Heroku

Two Heroku apps run the two Docker images; the database is on Neon.

| Piece    | Where                                      | Image / service                    |
| -------- | ------------------------------------------ | ---------------------------------- |
| API      | Heroku app, e.g. `wastable-api`            | `backend/Dockerfile`               |
| Web app  | Heroku app, e.g. `wastable-web`            | `frontend/Dockerfile`              |
| Database | Neon Postgres                              | migrations run on API startup      |
| Redis    | Optional: Heroku Key-Value Store / Upstash | falls back to memory when unset    |
| Photos   | S3-compatible bucket (Cloudflare R2)       | Heroku's disk is wiped on restarts |
| Email    | Any SMTP provider                          | needed for password reset          |

## 1. One-time setup

### Neon

Create a project and copy the **direct** connection string (not the `-pooler` host; the startup
migration uses a session lock that a transaction pooler breaks). It must end in
`?sslmode=require`.

### Heroku apps

On the Heroku dashboard: **New → Create new app**, once for the API and once for the web app.
The deploy workflow switches both apps to the container stack itself (the dashboard has no
setting for it), so no CLI is needed. Config vars go in each app's **Settings → Config Vars**.

Use a **Basic** (or larger) dyno for the API. Eco dynos sleep after 30 minutes without traffic,
which pauses the 15-minute job that expires listings and cancels stale claims.

Redis is optional. With one API dyno the in-memory fallback is fine. To add it:
`heroku addons:create heroku-redis:mini -a wastable-api` (sets `REDIS_URL` automatically),
or create a free Upstash database and set `REDIS_URL` to its `rediss://` URL.

### Photo bucket (Cloudflare R2, free tier)

1. R2 → Create bucket (e.g. `wastable-images`) → Settings → enable the public `r2.dev` URL
   (or connect a custom domain).
2. R2 → Manage API tokens → create a token with Object Read & Write on that bucket.

### API config vars

```bash
heroku config:set -a wastable-api \
  NODE_ENV=production \
  TRUST_PROXY=1 \
  DATABASE_URL='postgres://...neon.tech/neondb?sslmode=require' \
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")" \
  CORS_ORIGIN=https://wastable-web.herokuapp.com \
  PUBLIC_URL=https://wastable-api.herokuapp.com \
  AI_PROVIDER=gemini GEMINI_API_KEY=... \
  S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
  S3_BUCKET=wastable-images S3_REGION=auto \
  S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
  S3_PUBLIC_URL=https://pub-xxxx.r2.dev \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_USER=... SMTP_PASSWORD=... \
  MAIL_FROM='WASTABLE <no-reply@your-domain>' \
  EMAIL_VERIFICATION=off
```

Use the real `*.herokuapp.com` hostnames that `heroku create` printed (they may carry a suffix).
Set `EMAIL_VERIFICATION=on` once a test email arrives. The web app needs no config vars: its API
URL is baked in at build time.

### GitHub (for the deploy workflow)

Repository → Settings → Environments → `heroku` (the workflow's jobs run in this environment):

- Environment secret `HEROKU_API_KEY`: Heroku dashboard → Account settings → Applications →
  Authorizations → Create authorization (or `heroku authorizations:create -d "GitHub deploy"`)
- Environment variables (not secrets: the workflow reads them as `vars.*`) `HEROKU_API_APP=wastable-api`, `HEROKU_WEB_APP=wastable-web`,
  `NEXT_PUBLIC_API_URL=https://wastable-api.herokuapp.com/api`

## 2. Deploying

Actions → **Deploy to Heroku** → Run workflow (choose `both`, `api` or `web`). It builds each
image, pushes it to the Heroku registry and releases it. The API applies pending database
migrations when the new dyno boots.

From a laptop instead (Docker running, logged in with `heroku container:login`):

```bash
docker buildx build --platform linux/amd64 --provenance=false --load -f backend/Dockerfile \
  -t registry.heroku.com/wastable-api/web .
docker push registry.heroku.com/wastable-api/web
heroku container:release web -a wastable-api

docker buildx build --platform linux/amd64 --provenance=false --load -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://wastable-api.herokuapp.com/api \
  -t registry.heroku.com/wastable-web/web .
docker push registry.heroku.com/wastable-web/web
heroku container:release web -a wastable-web
```

## 3. After the first deploy

- Check `https://wastable-api.herokuapp.com/api/health/ready` returns `"database":"up"`.
- Register your own account in the web app, then make it an admin in the Neon SQL editor:
  `update users set role = 'ADMIN' where email = 'you@example.com';`
- Do **not** run `npm run db:seed` against production: it creates demo accounts with the
  password `password123`.
- Logs: `heroku logs --tail -a wastable-api`.
