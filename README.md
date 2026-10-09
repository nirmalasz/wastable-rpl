# WASTABLE

Peer-to-peer surplus food redistribution platform (Group 8). Students and households can buy, exchange, or give away surplus food. Agentic AI (Listing, Moderation, and Discovery agents) helps with listing, safety, and search.

| Part     | Stack                                                             | Folder                                                 |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4                  | [`frontend/`](frontend)                                |
| Backend  | Express 5, TypeScript, Drizzle ORM, PostgreSQL, Redis, Gemini API | [`backend/`](backend)                                  |
| CI       | GitHub Actions: lint, typecheck, test, build                      | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

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

# 4. Create the database tables
npm run db:generate -w backend
npm run db:migrate -w backend

# 5. Run frontend (http://localhost:3000) and backend (http://localhost:4000/api) together
npm run dev
```

The home page shows **API status: connected** when the frontend can reach the backend.

## Useful scripts (run from the repo root)

| Command                               | Description                        |
| ------------------------------------- | ---------------------------------- |
| `npm run dev`                         | Frontend + backend with hot reload |
| `npm run dev:web` / `npm run dev:api` | Run only one side                  |
| `npm run lint`                        | ESLint in both apps                |
| `npm run typecheck`                   | TypeScript checks in both apps     |
| `npm test`                            | Backend tests (vitest + supertest) |
| `npm run build`                       | Production builds                  |
| `npm run format`                      | Format all files with Prettier     |
| `npm run db:up` / `npm run db:down`   | Start / stop PostgreSQL + Redis    |

## Project structure

```
.
├─ frontend/                Next.js app (App Router)
├─ backend/                 Express API
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
