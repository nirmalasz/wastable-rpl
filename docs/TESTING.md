# Testing

WASTABLE has two test suites, both on [Vitest](https://vitest.dev):

| Suite    | Where                      | Runs in | What it covers                                                         |
| -------- | -------------------------- | ------- | ---------------------------------------------------------------------- |
| Backend  | `backend/tests/`           | Node    | API routes end to end (supertest + real PostgreSQL), AI layer, helpers |
| Frontend | `frontend/src/**/*.test.*` | jsdom   | Pure logic, React components and hooks (Testing Library)               |

## Running the tests

From the repository root:

```bash
npm test                          # both suites
npm run test -w backend           # backend only (~25 s)
npm run test -w frontend          # frontend only (~10 s)
npm run test:watch -w frontend    # re-run on save
npm run test:coverage -w backend  # coverage summary + HTML report in backend/coverage/
npm run test:coverage -w frontend # same, in frontend/coverage/
```

The backend's integration tests need PostgreSQL with the current migrations:

```bash
npm run db:up                     # Postgres + Redis from docker-compose.yml
npm run db:migrate -w backend
```

Without a database those files are **skipped** on your machine (the rest still runs). In CI a
missing database is an **error** instead, so the suite can never pass by silently skipping.

## What is covered

Coverage on 6 Nov 2026:

| Suite    | Tests | Statements | Lines |
| -------- | ----- | ---------- | ----- |
| Backend  | 61    | 80%        | 85%   |
| Frontend | 43    | 23%        | 22%   |

- **Backend:** every route has at least one test. The DB-backed files are `flow.test.ts`
  (register → list → claim → complete → review, waitlist, moderation and appeals, password
  reset, scheduler), `security.test.ts` (privacy, upload checks, rate limits, suspension) and
  `chat-cart.test.ts` (chat, cart, and endpoints the flow does not reach). Unit tests cover
  crypto, validation messages, the rule-based moderation filter, the AI orchestrator and Groq
  adapter, and reverse geocoding.
- **Frontend:** formatting, pricing (`offerOf`, `priceLabel`), the API client, the local-storage
  store, the cart store, the listing card's cart button, the reviews UI (stars, rating bars,
  role labels, filter) and the edit-profile modal's unsaved-changes reminder. Page components
  under `src/app/` are not tested yet, which is why overall frontend coverage is low.

## Writing backend tests

**Unit or integration?** Pure functions (formatting, parsing, scoring) get a plain unit test.
Anything that touches the database goes through the HTTP API with supertest, like a real client:

```ts
import { dbUp } from './helpers/db.js';

describe.skipIf(!dbUp)('my feature', () => {
  it('does the thing', async () => {
    const res = await request(app)
      .get('/api/...')
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });
});
```

Rules that keep the integration tests reliable:

- **Use `helpers/db.ts` for the database check.** Do not write your own probe; the helper is
  what makes CI fail loudly when the database is missing.
- **Make test data unique per run.** The local database keeps rows from earlier runs, so a test
  that searches for "nasi goreng" can find someone else's listing. Put the run id in names and
  search terms (see `tok${run}` in `flow.test.ts`).
- **Files run one at a time** (`fileParallelism: false` in `vitest.config.ts`). They share one
  database and the scheduler's job lock; running them in parallel made tests fail at random.
- **Never call real external services.** `vitest.config.ts` blanks `GEMINI_API_KEY` and
  `GROQ_API_KEY` and sets `GEOCODER=off`, so a developer's real keys in `.env` are never used.
  Tests that need those services stub `fetch` (`ai-groq.test.ts`, `geocode.test.ts`) or the
  model (`ai-orchestrator.test.ts`).
- **Email verification is on in tests** (`EMAIL_VERIFICATION=on`) so that flow stays tested
  while it is switched off in development.

Gotcha: a Vitest mock that throws (`mockRejectedValue`, or an implementation that throws) can
be reported as a failure even when the code under test catches the error. The AI fallback
tests simulate an outage with an unusable reply instead.

## Writing frontend tests

Put the test next to the file it tests: `listing-card.tsx` → `listing-card.test.tsx`.

`src/test/setup.ts` runs before every test file. It adds the jest-dom matchers
(`toBeInTheDocument`, `toHaveAttribute`, …), cleans up between tests, and replaces the parts of
Next.js that need a running app: `next/navigation` (control it through the exported `router`)
and `next/link` (a plain `<a>`). It also adds the `<dialog>` methods jsdom lacks.

**Signed-in users.** Components get the user from `useAuth()`. Swap in the controllable fake
from `src/test/auth.ts`:

```ts
import { auth } from '@/test/auth';

vi.mock('@/features/auth', async () => (await import('@/test/auth')).authModule);

beforeEach(() => auth.signIn()); // or auth.signOut(), or auth.signIn({ id: 'seller-1' })
auth.call.mockResolvedValueOnce({ items: [] }); // fake an API response
```

**Modules with their own state** (like the cart store) need a fresh copy per test: call
`vi.resetModules()` and import the module again. Define any fake the module uses with
`vi.hoisted`, otherwise the reset gives the module a different fake from the one your test
holds. `features/cart/cart.test.tsx` shows the pattern.

**Query like a user.** Prefer `getByRole('button', { name: 'Save' })` and `getByText` over
CSS selectors, and drive interaction with `userEvent`. If two controls share a name (the
edit-profile modal has a corner × and a footer button, both "Close"), pick by visible text.

**Check the test can fail.** Break the code it covers once (for example, delete the line that
shows the reminder) and make sure the test goes red before you trust it.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and push to `main` and `develop`:
lint, typecheck, test and build for each app, plus a Prettier check. The backend job starts a
PostgreSQL 17 service and runs `db:migrate` before the tests.

## Troubleshooting

**`Cannot find module './rolldown-binding.…'` or `@rolldown/binding-…`.** Vitest needs a
platform-specific `rolldown` package. npm has a long-standing bug: running `npm install` with an
existing `node_modules` can **remove other platforms' packages from `package-lock.json`**, after
which CI (Linux) or a teammate (macOS/Windows) cannot run the tests.

- Check: `grep -c 'rolldown/binding' package-lock.json` should print about **45**. About 15
  means the platform entries are gone.
- Fix by regenerating the lockfile in an empty folder, so npm cannot copy your local install:

  ```bash
  mkdir -p /tmp/lockgen/backend /tmp/lockgen/frontend
  cp package.json /tmp/lockgen/ && cp backend/package.json /tmp/lockgen/backend/ \
    && cp frontend/package.json /tmp/lockgen/frontend/
  (cd /tmp/lockgen && npm install --package-lock-only --ignore-scripts)
  cp /tmp/lockgen/package-lock.json . && npm ci
  ```

- After adding a dependency, run that check again before committing.

**`npm ci` fails with `EPERM … next-swc…node`** (Windows). A running `npm run dev` or editor
holds the file. Stop the dev server, then run `npm ci` again.

**Integration tests are skipped.** PostgreSQL is not reachable at `DATABASE_URL` (default
`postgres://wastable:wastable@localhost:5432/wastable`). Run `npm run db:up` and
`npm run db:migrate -w backend`.
