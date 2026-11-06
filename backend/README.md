# @wastable/backend

Express 5 + TypeScript REST API for WASTABLE. The full endpoint reference is
[`openapi.yaml`](openapi.yaml).

```
src/
├─ app.ts            builds the Express app (used by server.ts and tests)
├─ server.ts         local entry point (node)
├─ config/env.ts     environment variables, validated with zod
├─ lib/              logger, HttpError, KV store (Redis or memory), storage, geocoding, mailer
├─ middleware/       auth guard, rate limits, validation, error handling
├─ modules/          one folder per domain: *.routes.ts (HTTP) + *.service.ts (shared logic)
├─ ai/               orchestrator, LLM providers (Groq, Gemini), agents, rule-based filter
└─ db/               Drizzle schema, client and seed (migrations are in ./drizzle)
```

All endpoints are mounted under `/api`:

| Module          | What it does                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `auth`          | Register, email verification, login, password reset, profile (`/users/me`)                                      |
| `listings`      | AI draft, create with moderation, edit, delete, public seller listings, compost referral, pin → address preview |
| `search`        | Filter search and conversational search                                                                         |
| `transactions`  | Claim, waitlist, complete or cancel; `/transactions/mine` with chat summaries                                   |
| `chat`          | Messages per trade (`/transactions/:id/messages`), polled by the frontend                                       |
| `cart`          | Listings saved to claim later                                                                                   |
| `reviews`       | Buyer and seller review each other after a completed trade                                                      |
| `notifications` | In-app notifications                                                                                            |
| `moderation`    | Reports, admin case queue, violations, appeals                                                                  |
| `uploads`       | Photo upload (checked by content, stored on disk)                                                               |
| `scheduler`     | 15-minute job: expire listings, flag urgent ones, time out stale claims                                         |

## Behaviour without external services

- **AI:** `AI_PROVIDER` picks Groq or Gemini. Without a key for it, the agents fall back to
  rule-based moderation, heuristic listing drafts and keyword search.
- **Redis:** without it, the AI quota and caches use process memory.
- **Email:** nothing is sent yet (`lib/mailer.ts` only logs). With `EMAIL_VERIFICATION=off`
  (the default) accounts are active immediately. Outside production, responses include
  `devVerificationToken` / `devResetToken` so those flows still work.
- **Geocoding:** `GEOCODER=nominatim` looks up the pickup address with OpenStreetMap, at most
  one request per second and cached. Failures return no address; nothing breaks.

## Privacy rules

Exact pickup coordinates and the street address are only ever returned to the listing's seller.
`toPublicListing` strips them from every public response, and `flow.test.ts` /
`chat-cart.test.ts` check it. Keep new endpoints going through `toPublicListing`.

## Database

After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new file in
`drizzle/`. Everyone else then runs `npm run db:migrate`. `npm run db:seed` creates demo
accounts (`admin@`, `rina@`, `budi@wastable.app`, password `password123`) and sample listings.

## Scripts

| Script                  | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | Start with hot reload on http://localhost:4000                 |
| `npm test`              | Run the test suite (see [docs/TESTING.md](../docs/TESTING.md)) |
| `npm run test:coverage` | Tests with a coverage report in `coverage/`                    |
| `npm run db:generate`   | Create a migration from `src/db/schema.ts`                     |
| `npm run db:migrate`    | Apply migrations to `DATABASE_URL`                             |
| `npm run db:seed`       | Load demo data                                                 |
