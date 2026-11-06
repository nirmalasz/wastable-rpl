# @wastable/frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. The UI follows the WASTABLE Figma
prototype; brand colours and fonts are tokens in `src/app/globals.css`.

```
src/
├─ app/          routes: feed, listing detail/edit/new, profile, public profiles (users/[id]),
│                chat, cart, dashboard, notifications, admin, auth pages
├─ components/   shared UI (header and sidebar, Button, Card, Avatar, ImageUpload, ...)
├─ features/     one folder per feature: auth, cart, chat, listings, profile, reviews, search, ...
├─ lib/          api-client (fetch wrapper for the Express API), types, formatting, local storage
└─ test/         shared test setup and fakes
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` if the API is not on
`http://localhost:4000/api`.

Data comes from the API through `lib/api-client.ts` (`api()`), usually via the `useApi` hook or
`useAuth().call` for signed-in requests. Chat and the notification badges poll the API; there
is no websocket.

## Scripts

| Script                  | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `npm run dev`           | Start on http://localhost:3000                      |
| `npm run build`         | Production build                                    |
| `npm test`              | Unit and component tests (Vitest + Testing Library) |
| `npm run test:watch`    | Re-run tests on save                                |
| `npm run test:coverage` | Tests with a coverage report in `coverage/`         |

Tests sit next to the code they test (`listing-card.test.tsx`). See
[docs/TESTING.md](../docs/TESTING.md) for the fakes in `src/test/` and how to write new tests.
