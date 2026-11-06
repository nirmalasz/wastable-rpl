# WASTABLE

Peer-to-peer surplus food redistribution platform (Group 8). Students and households can buy, exchange, or give away surplus food. Agentic AI (Listing, Moderation, and Discovery agents) helps with listing, safety, and search.

| Part     | Stack                                                                 | Folder                                                 |
| -------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4                      | [`frontend/`](frontend)                                |
| Backend  | Express 5, TypeScript, Drizzle ORM, PostgreSQL, Redis, Groq or Gemini | [`backend/`](backend)                                  |
| CI       | GitHub Actions: lint, typecheck, test, build                          | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

## Requirements

- Node.js 24 (see `.nvmrc`; 22 also works)
- Docker Desktop (for local PostgreSQL + Redis)

## Getting started

```bash
# 1. Install everything (one install for both apps – npm workspaces)
npm install

# 2. Environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Start PostgreSQL + Redis
npm run db:up

# 4. Create the database tables (migrations are committed; run this after every pull)
npm run db:migrate -w backend
npm run db:seed -w backend        # optional: demo accounts and listings

# 5. Run frontend (http://localhost:3000) and backend (http://localhost:4000/api) together
npm run dev
```

The home page shows **API status: connected** when the frontend can reach the backend.

## Useful scripts (run from the repo root)

| Command                               | Description                         |
| ------------------------------------- | ----------------------------------- |
| `npm run dev`                         | Frontend + backend with hot reload  |
| `npm run dev:web` / `npm run dev:api` | Run only one side                   |
| `npm run lint`                        | ESLint in both apps                 |
| `npm run typecheck`                   | TypeScript checks in both apps      |
| `npm test`                            | Backend and frontend tests (Vitest) |
| `npm run build`                       | Production builds                   |
| `npm run format`                      | Format all files with Prettier      |
| `npm run db:up` / `npm run db:down`   | Start / stop PostgreSQL + Redis     |
| `npm run test:coverage -w <app>`      | Tests with a coverage report        |

## Testing

`npm test` runs both suites. The backend's integration tests need PostgreSQL (`npm run db:up`
and `npm run db:migrate -w backend`); without it they are skipped locally and fail in CI.
See [docs/TESTING.md](docs/TESTING.md) for what is covered, how to write tests, and
troubleshooting (including the npm lockfile issue that breaks Vitest).

## Configuration

Everything lives in `backend/.env`; [`backend/.env.example`](backend/.env.example) documents
each setting. The ones you are most likely to change:

| Setting              | Default              | Meaning                                                              |
| -------------------- | -------------------- | -------------------------------------------------------------------- |
| `AI_PROVIDER`        | `gemini`             | `groq` or `gemini`. Without a key the app uses rule-based fallbacks. |
| `GROQ_MODEL`         | `openai/gpt-oss-20b` | Smallest Groq model that handles our prompts reliably.               |
| `EMAIL_VERIFICATION` | `off`                | `on` requires verified email; keep `off` until SMTP is set up.       |
| `GEOCODER`           | `nominatim`          | Pin → street address via OpenStreetMap (free); `off` to disable.     |

## Project structure

```
.
├─ frontend/                Next.js app (App Router)
├─ backend/                 Express API
├─ docs/                    Project documentation (TESTING.md)
├─ .github/workflows/ci.yml CI pipeline
├─ docker-compose.yml       PostgreSQL 17 + Redis 7 for development
└─ package.json             npm workspaces + shared scripts
```

## Branching and CI

- `main` – stable, protected; `develop` – integration branch.
- Work on `feature/<name>` branches and open a pull request into `develop`.
- CI runs on every push and pull request to `main` and `develop`: lint, typecheck, test, and build for both apps, plus a Prettier check. Merge only when CI is green.

## Notes

- Never commit `.env` files; only the `.env.example` templates are tracked.
- Deployment (Cloudflare Workers via OpenNext for the frontend and Wrangler for the API) will be added as a separate workflow later.
