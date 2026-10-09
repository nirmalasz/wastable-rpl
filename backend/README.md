# @wastable/backend

Express 5 + TypeScript REST API for WASTABLE.

```
src/
├─ app.ts            builds the Express app (used by server.ts and tests)
├─ server.ts         local entry point (node)
├─ config/env.ts     environment variables, validated with zod
├─ lib/              logger, HttpError, Redis client, helpers
├─ middleware/       auth guard, validation, error handling
├─ modules/          one folder per domain: *.routes.ts → controller → service → repository
├─ ai/               orchestrator, Listing / Moderation / Discovery agents, rule-based filter
└─ db/               Drizzle schema + client (migrations go to ./drizzle)
```

All endpoints are mounted under `/api`. Planned endpoints currently answer **501 Not Implemented**; replace `notImplemented(...)` with real handlers as features are built.

| Script                | What it does                                   |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Start with hot reload on http://localhost:4000 |
| `npm test`            | Run vitest                                     |
| `npm run db:generate` | Create a migration from `src/db/schema.ts`     |
| `npm run db:migrate`  | Apply migrations to `DATABASE_URL`             |
