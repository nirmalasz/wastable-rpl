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

All endpoints are mounted under `/api`. Implemented: auth (register, email verification, login, password reset, profile), listings (AI extract, create with moderation, edit, delete, compost referral), search (filters + conversational), claim/waitlist/pickup transactions, reviews, notifications, reports/moderation queue/appeals, and the 15-minute expiry/urgent job.

Without `GEMINI_API_KEY` the agents fall back to rule-based behaviour; without Redis the AI quota/cache falls back to process memory. Outside production, register / password-reset responses include `devVerificationToken` / `devResetToken` because no email is delivered yet (`lib/mailer.ts` only logs).

`npm run db:seed` creates demo accounts (`admin@`, `rina@`, `budi@wastable.app`, password `password123`) and sample listings. `tests/flow.test.ts` runs the full marketplace flow against the local database and is skipped when PostgreSQL is unreachable.

| Script                | What it does                                   |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Start with hot reload on http://localhost:4000 |
| `npm test`            | Run vitest                                     |
| `npm run db:generate` | Create a migration from `src/db/schema.ts`     |
| `npm run db:migrate`  | Apply migrations to `DATABASE_URL`             |
