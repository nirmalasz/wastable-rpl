# WASTABLE Software Test Documentation

**Document ID:** WASTABLE-STD-001 · **Version:** 1.0 · **Date:** 6 November 2026
**Project:** WASTABLE, peer-to-peer surplus food marketplace (Group 8, RPL)
**Standard:** structured after IEEE 829 (Software and System Test Documentation)

| #   | IEEE 829 document            | Section |
| --- | ---------------------------- | ------- |
| 1   | Test Plan                    | §1      |
| 2   | Test Design Specification    | §2      |
| 3   | Test Case Specification      | §3      |
| 4   | Test Procedure Specification | §4      |
| 5   | Test Log                     | §5      |
| 6   | Test Incident Report         | §6      |
| 7   | Test Summary Report          | §7      |

Use-case (actor-based) test scenarios for the **Seller** and **Buyer** are specified separately
in [USE-CASE-TESTS.md](USE-CASE-TESTS.md) and are part of this test documentation.

Requirement IDs (FR-x, UCx, NFR) are the ones used in the source code comments and refer to
the project's requirements specification. Features added after that specification (chat, cart,
profiles, reviews UI) are marked **New**.

---

## 1. Test Plan

### 1.1 Test plan identifier

WASTABLE-TP-001, version 1.0.

### 1.2 Introduction

**Purpose.** This plan defines how WASTABLE is tested: what is tested, at which levels, with
which techniques, and how results are recorded. It also records the results of the test run of
6 November 2026.

**Scope.** The backend REST API (Express, PostgreSQL), its AI agents, and the frontend logic and
components (Next.js, React). Automated tests only; manual exploratory testing is out of scope
for this version (§1.5).

**References.**

- Project requirements specification (FR, UC and NFR identifiers)
- `backend/openapi.yaml`: API reference
- `docs/TESTING.md`: developer guide for running and writing tests
- IEEE 829-2008, Standard for Software and System Test Documentation

### 1.3 Test items

| Item            | Version / location                                                |
| --------------- | ----------------------------------------------------------------- |
| Source code     | Git commit `89f06d6`, branch `feature/unit-tests-docs`            |
| Backend API     | `backend/src/` (Express 5, TypeScript, Drizzle ORM)               |
| Frontend        | `frontend/src/` (Next.js 16, React 19)                            |
| Database schema | Migrations `0000`–`0003` in `backend/drizzle/`                    |
| Test suites     | `backend/tests/` (12 files), `frontend/src/**/*.test.*` (8 files) |

### 1.4 Features to be tested

| Feature                                              | Requirement                           |
| ---------------------------------------------------- | ------------------------------------- |
| Registration, verification, login, password reset    | FR-1, FR-2, UC1–UC4                   |
| Create, edit and delete listings; urgent tagging     | FR-3, FR-4, FR-5, UC5–UC8             |
| Browse, filter and conversational search             | FR-6, FR-7, FR-17, UC9–UC10           |
| Claim, waitlist, complete or cancel a pickup         | FR-8, FR-9, UC11–UC13                 |
| Expiry and compost referral                          | FR-10, UC20                           |
| Notifications                                        | FR-11, UC15                           |
| Reports, moderation, violations, suspension, appeals | FR-12, FR-13, FR-14, FR-16, UC16–UC19 |
| Reviews between buyer and seller                     | UC14                                  |
| AI agents and their rule-based fallbacks             | FR-15, FR-16, FR-17, Reliability NFR  |
| Privacy of exact location and contact data           | Privacy NFR                           |
| Upload safety, rate limits, token handling           | Security NFR                          |
| Trade chat, cart, pickup address lookup              | New                                   |
| Profile editing, review display, pricing display     | New / UC14                            |

### 1.5 Features not to be tested

| Feature                                   | Reason                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Page layout and visual design             | Checked by review against the Figma design, not automated                                       |
| Page components under `frontend/src/app/` | Not yet covered; planned for the next version                                                   |
| Real email delivery                       | Not implemented (`sendMail` only logs)                                                          |
| Live AI model quality                     | Non-deterministic and rate-limited; checked manually during development. Tests use a fake model |
| Live OpenStreetMap geocoding              | External service with a fair-use policy; tests stub it                                          |
| Performance and load                      | Out of scope for this course project                                                            |
| Cross-browser behaviour                   | Out of scope; jsdom is used for component tests                                                 |

### 1.6 Approach

**Test levels.**

| Level       | What it checks                                                                                   | Tools                                       |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Unit        | One function or component on its own                                                             | Vitest, React Testing Library               |
| Integration | Real HTTP requests through the API to a real database                                            | Vitest, supertest, PostgreSQL 17            |
| Use case    | A whole use case from the Seller's or Buyer's point of view: main, alternate and exception flows | Vitest, supertest, PostgreSQL 17            |
| Regression  | The whole suite on every pull request                                                            | GitHub Actions (`.github/workflows/ci.yml`) |

**Test design techniques.**

- **Equivalence partitioning:** inputs split into classes that should behave the same, for
  example the three listing types (SELL, FREE, EXCHANGE) and signed-in versus signed-out users.
- **Boundary value analysis:** values at the edges of a rule, for example a price of 0 and
  -5, the third violation that suspends an account, the daily AI quota limit, the maximum number
  of open claims, and an expiry time of exactly now.
- **Error guessing:** inputs likely to break the system, for example tampered tokens, fake image
  files, malformed JSON, external photo URLs and repeated failed logins.
- **White-box (statement coverage):** coverage is measured with `@vitest/coverage-v8` to find
  untested code.
- **Test doubles:** external services (AI model, geocoder) are replaced with stubs so tests are
  free, fast and repeatable.

### 1.7 Item pass/fail criteria

- A **test case** passes when all its assertions hold.
- A **test item** passes when all its test cases pass and none are skipped in CI.
- The **release** passes when every test passes in CI, lint and typecheck report no errors, and
  both applications build.

### 1.8 Suspension criteria and resumption requirements

Testing is suspended when the test database is unavailable (integration tests cannot run), when
the build fails, or when the test runner cannot start (for example missing platform packages).
Testing resumes once the cause is fixed; the whole suite is then run again, not only the failed
tests.

### 1.9 Test deliverables

This document; the automated test suites; `docs/TESTING.md`; coverage reports
(`backend/coverage/`, `frontend/coverage/`); CI run logs on GitHub.

### 1.10 Testing tasks

1. Write test cases for each feature in §1.4.
2. Set up the test environment (§1.11) and CI.
3. Run the suites and record the results (§5).
4. Report and fix incidents (§6), then re-run.
5. Write the summary report (§7).

### 1.11 Environmental needs

| Need          | Detail                                                                |
| ------------- | --------------------------------------------------------------------- |
| Runtime       | Node.js 24, npm 11                                                    |
| Database      | PostgreSQL 17 (Docker locally, a service container in CI)             |
| Test runner   | Vitest 5.1; jsdom for frontend tests                                  |
| Configuration | Tests force `EMAIL_VERIFICATION=on`, `GEOCODER=off` and blank AI keys |
| CI            | GitHub Actions, Ubuntu runner                                         |

### 1.12 Responsibilities

| Role       | Responsibility                                    | Name |
| ---------- | ------------------------------------------------- | ---- |
| Test lead  | Owns this plan and the summary report             |      |
| Developers | Write and maintain tests for the code they change |      |
| Reviewer   | Checks tests in pull requests before merging      |      |

### 1.13 Staffing and training needs

Team members need to know Vitest and Testing Library basics. `docs/TESTING.md` covers the
project's conventions and the fakes used in tests.

### 1.14 Schedule

Tests are written together with each feature and run on every pull request. A full run with a
recorded log (§5) is made before each project milestone.

### 1.15 Risks and contingencies

| Risk                                                | Contingency                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Tests depend on a running database                  | Integration files skip locally without one; CI provides one and fails if it is missing |
| Shared test database causes interference            | Test files run one at a time; test data uses a unique word per run                     |
| External services are slow, limited or not free     | Replaced with stubs in tests                                                           |
| Lockfile loses platform packages, test runner fails | Documented fix in `docs/TESTING.md`; checked before commits                            |

### 1.16 Approvals

| Name | Role | Signature | Date |
| ---- | ---- | --------- | ---- |
|      |      |           |      |

---

## 2. Test Design Specification

Test cases are grouped into feature sets. Each set lists its test file(s) and requirements.

| Set ID | Feature set                        | Test files                                                                   | Requirements                 |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| TD-01  | API basics and input validation    | `health.test.ts`, `validation.test.ts`                                       | NFR                          |
| TD-02  | Authentication and accounts        | `crypto.test.ts`, `flow.test.ts`, `security.test.ts`, `chat-cart.test.ts`    | FR-1, FR-2                   |
| TD-03  | Listings and pricing               | `flow.test.ts`, `pricing.test.ts`, `listing-card.test.tsx`, `format.test.ts` | FR-3–FR-6                    |
| TD-04  | Search                             | `flow.test.ts`, `chat-cart.test.ts`                                          | FR-6, FR-7, FR-17            |
| TD-05  | Claims, waitlist and pickups       | `flow.test.ts`, `security.test.ts`                                           | FR-8, FR-9                   |
| TD-06  | Expiry, urgency and compost        | `flow.test.ts`, `chat-cart.test.ts`                                          | FR-5, FR-10                  |
| TD-07  | Moderation, suspension and appeals | `flow.test.ts`, `security.test.ts`, `rule-based-filter.test.ts`              | FR-12–FR-14, FR-16           |
| TD-08  | Reviews                            | `flow.test.ts`, `security.test.ts`, `reviews.test.tsx`                       | UC14                         |
| TD-09  | Notifications                      | `chat-cart.test.ts`                                                          | FR-11                        |
| TD-10  | AI agents and fallbacks            | `ai-orchestrator.test.ts`, `ai-groq.test.ts`                                 | FR-15–FR-17, Reliability NFR |
| TD-11  | Security and privacy               | `security.test.ts`, `validation.test.ts`, `flow.test.ts`                     | Security and Privacy NFR     |
| TD-12  | Chat and cart                      | `chat-cart.test.ts`, `cart.test.tsx`, `listing-card.test.tsx`                | New                          |
| TD-13  | Location and address               | `geocode.test.ts`, `chat-cart.test.ts`, `pricing.test.ts`                    | New, Privacy NFR             |
| TD-14  | Frontend support code and profile  | `api-client.test.ts`, `local-store.test.ts`, `edit-profile-modal.test.tsx`   | New                          |
| TD-15  | Seller use cases (S-1 to S-8)      | `seller.test.ts`, specified in USE-CASE-TESTS.md                             | UC1–UC8, UC11–UC14, UC20     |
| TD-16  | Buyer use cases (B-1 to B-8)       | `buyer.test.ts`, specified in USE-CASE-TESTS.md                              | UC9–UC14, UC16               |

---

## 3. Test Case Specification

**Level:** U = unit, I = integration. **Technique:** EP = equivalence partitioning,
BVA = boundary value analysis, EG = error guessing, FN = functional (requirement-based).
Each test case is an automated test; the **Test** column gives its file and name so it can be
found and run.

### TD-01 API basics and input validation

| ID     | Test (file › name)                                                           | Lvl | Tech | Input / precondition                   | Expected result                                        |
| ------ | ---------------------------------------------------------------------------- | --- | ---- | -------------------------------------- | ------------------------------------------------------ |
| TC-001 | `health.test.ts` › GET /api/health returns ok                                | I   | FN   | Running API                            | 200, status `ok`                                       |
| TC-002 | `health.test.ts` › unknown routes return 404 JSON                            | I   | EG   | Request to a route that does not exist | 404 with a JSON error                                  |
| TC-003 | `health.test.ts` › protected endpoints require a token                       | I   | EG   | Request without a token                | 401                                                    |
| TC-004 | `health.test.ts` › rejects invalid bodies with 400                           | I   | EG   | Body that fails validation             | 400                                                    |
| TC-005 | `validation.test.ts` › explains what to fix without leaking schema internals | I   | EG   | Invalid field values                   | Plain-language message per field, no library internals |
| TC-006 | `validation.test.ts` › reports missing fields as required                    | I   | EP   | Required fields left out               | Each missing field reported as required                |
| TC-007 | `validation.test.ts` › hides internals for malformed bodies                  | I   | EG   | Malformed JSON                         | 400 with a safe message                                |

### TD-02 Authentication and accounts (FR-1, FR-2, UC1–UC4)

| ID     | Test (file › name)                                                                         | Lvl | Tech | Input / precondition              | Expected result                          |
| ------ | ------------------------------------------------------------------------------------------ | --- | ---- | --------------------------------- | ---------------------------------------- |
| TC-008 | `crypto.test.ts` › hashes and verifies passwords                                           | U   | FN   | A password                        | Hash verifies the right password only    |
| TC-009 | `crypto.test.ts` › signs tokens bound to a purpose                                         | U   | EP   | Token signed for one purpose      | Rejected when used for another purpose   |
| TC-010 | `crypto.test.ts` › rejects tampered and expired tokens                                     | U   | EG   | Edited or expired token           | Rejected                                 |
| TC-011 | `flow.test.ts` › password reset links are single-use                                       | I   | EG   | Reset link used twice             | Second use rejected                      |
| TC-012 | `security.test.ts` › revokes the old access token after a password reset                   | I   | FN   | Token issued before reset         | Rejected after reset                     |
| TC-013 | `security.test.ts` › throttles repeated failed logins for one account and a reset lifts it | I   | BVA  | Failed logins past the limit      | Login blocked; password reset unblocks   |
| TC-014 | `chat-cart.test.ts` › resends verification only to unverified accounts                     | I   | EP   | Unverified, then verified account | Token sent first time; 400 once verified |

### TD-03 Listings and pricing (FR-3–FR-6, UC5–UC8)

| ID     | Test (file › name)                                                                     | Lvl | Tech | Input / precondition                        | Expected result                               |
| ------ | -------------------------------------------------------------------------------------- | --- | ---- | ------------------------------------------- | --------------------------------------------- |
| TC-015 | `flow.test.ts` › saves a Rp 0 sale as FREE and shows the exact pin only to the seller  | I   | BVA  | SELL listing at price 0, created and edited | Stored as FREE, price 0                       |
| TC-016 | `pricing.test.ts` › keeps a priced sale                                                | U   | EP   | SELL, price 8000                            | SELL, 8000                                    |
| TC-017 | `pricing.test.ts` › turns a sale priced "0" / "" / "-5" into a free listing            | U   | BVA  | Price 0, empty, -5                          | FREE, price 0 (3 cases)                       |
| TC-018 | `pricing.test.ts` › never sends a price for free or exchange listings                  | U   | EP   | FREE or EXCHANGE with a price               | Price sent as 0                               |
| TC-019 | `pricing.test.ts` › shows the price for sales and a word for the other offer types     | U   | EP   | Each listing type                           | "Rp 13.000", "Free", "Exchange"               |
| TC-020 | `listing-card.test.tsx` › shows price, title and diet warnings, linking to the listing | U   | FN   | Listing with an egg flag                    | Price, title, "contains egg", link to listing |
| TC-021 | `format.test.ts` › uses Indonesian thousands separators                                | U   | EP   | 8000, 1250000, 0                            | "Rp 8.000", "Rp 1.250.000", "Rp 0"            |
| TC-022 | `format.test.ts` › timeLeft for 35 min, 2 h 10 min, 1 day 3 h                          | U   | EP   | Three durations                             | "35m left", "2h 10m left", "1d 3h left"       |
| TC-023 | `format.test.ts` › says expired at or after the deadline                               | U   | BVA  | Exactly now; 5 min ago                      | "expired"                                     |
| TC-024 | `format.test.ts` › formats for datetime-local in the browser time zone                 | U   | FN   | 6 Nov 2026 09:05 local                      | "2026-11-06T09:05"                            |
| TC-025 | `format.test.ts` › turns enum-style values into readable words                         | U   | EP   | `cooked-meal`, `UNDER_REVIEW`               | "cooked meal", "under review"                 |

### TD-04 Search (FR-6, FR-7, FR-17, UC9–UC10)

| ID     | Test (file › name)                                                                        | Lvl | Tech | Input / precondition                     | Expected result                                     |
| ------ | ----------------------------------------------------------------------------------------- | --- | ---- | ---------------------------------------- | --------------------------------------------------- |
| TC-026 | `flow.test.ts` › runs register → list → claim → complete → review (search step)           | I   | FN   | New listing with a unique word           | Found by search; no exact coordinates in results    |
| TC-027 | `chat-cart.test.ts` › AI extract and conversational search fall back to rules with AI off | I   | FN   | No AI key; draft request and chat search | Heuristic draft; search returns filters and results |

### TD-05 Claims, waitlist and pickups (FR-8, FR-9, UC11–UC13)

| ID     | Test (file › name)                                                        | Lvl | Tech | Input / precondition                          | Expected result                                                                                        |
| ------ | ------------------------------------------------------------------------- | --- | ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| TC-028 | `flow.test.ts` › runs register → list → claim → complete → review         | I   | FN   | Seller lists; buyer claims; second user tries | Seller cannot claim own; second claim 409 with waitlist offer; seller cannot complete; buyer completes |
| TC-029 | `flow.test.ts` › cancelling a claim re-offers the listing to the waitlist | I   | FN   | Claimed listing with a waitlist               | Cancel offers it to waitlist position 1                                                                |
| TC-030 | `security.test.ts` › caps open claims per user at 3                       | I   | BVA  | 4th open claim                                | First 3 accepted, 4th 429                                                                              |
| TC-031 | `security.test.ts` › scheduler cancels claims that were never picked up   | I   | FN   | Claim older than the timeout                  | Cancelled by the scheduled job                                                                         |

### TD-06 Expiry, urgency and compost (FR-5, FR-10, UC20)

| ID     | Test (file › name)                                                         | Lvl | Tech | Input / precondition             | Expected result                                 |
| ------ | -------------------------------------------------------------------------- | --- | ---- | -------------------------------- | ----------------------------------------------- |
| TC-032 | `flow.test.ts` › scheduler expires listings and flags urgent ones          | I   | BVA  | Listings expiring in 1 h and 8 h | 1 h: urgent, then expired; 8 h: still available |
| TC-033 | `chat-cart.test.ts` › refers an expired listing to a compost partner, once | I   | EP   | Unexpired, then expired listing  | 409 before expiry; 201 after; 409 on repeat     |

### TD-07 Moderation, suspension and appeals (FR-12–FR-14, FR-16, UC16–UC19)

| ID     | Test (file › name)                                                                  | Lvl | Tech | Input / precondition                       | Expected result                                                                      |
| ------ | ----------------------------------------------------------------------------------- | --- | ---- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| TC-034 | `flow.test.ts` › handles reports, 3 violations, suspension and appeal               | I   | BVA  | Three confirmed violations, then an appeal | Suspended at the 3rd; appeal approved; account active; appeal listed in "my appeals" |
| TC-035 | `flow.test.ts` › runs register → list → claim → complete → review (moderation step) | I   | FN   | Listing "Bir dingin"; listing with pork    | Alcohol rejected (403); pork flagged as a diet flag                                  |
| TC-036 | `security.test.ts` › does not let a user report the same listing twice              | I   | EG   | Same user reports twice                    | Second report rejected                                                               |
| TC-037 | `rule-based-filter.test.ts` › rejects prohibited items                              | U   | EP   | Alcohol listing                            | PROHIBITED                                                                           |
| TC-038 | `rule-based-filter.test.ts` › flags diet ingredients                                | U   | EP   | "Nasi goreng babi"                         | Diet flag `pork`                                                                     |
| TC-039 | `rule-based-filter.test.ts` › passes ordinary food                                  | U   | EP   | Ordinary food                              | OK                                                                                   |
| TC-040 | `rule-based-filter.test.ts` › does not match words inside other words               | U   | EG   | Word containing a prohibited word          | Not flagged                                                                          |

### TD-08 Reviews (UC14)

| ID     | Test (file › name)                                                                         | Lvl | Tech | Input / precondition         | Expected result                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------ | --- | ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| TC-041 | `flow.test.ts` › runs register → list → claim → complete → review (review step)            | I   | FN   | Completed trade              | Buyer reviews (201) once; second review 409; seller reviews back; roles labelled BUYER / SELLER; reviewed product returned |
| TC-042 | `security.test.ts` › does not let a suspended user post a review                           | I   | EP   | Suspended buyer              | 403                                                                                                                        |
| TC-043 | `security.test.ts` › only accepts review photos from our own uploads                       | I   | EG   | External photo URL           | 400                                                                                                                        |
| TC-044 | `reviews.test.tsx` › fills whole stars and part of the last one                            | U   | BVA  | Rating 4.3                   | Fills 100, 100, 100, 100, 30 %                                                                                             |
| TC-045 | `reviews.test.tsx` › counts reviews per star, five first                                   | U   | FN   | Ratings 5, 5, 2              | Bars: 5★ 2, 2★ 1, others 0                                                                                                 |
| TC-046 | `reviews.test.tsx` › labels the reviewer's role and links the reviewed product and profile | U   | FN   | Review by a seller           | "Seller" label; links to product and profile                                                                               |
| TC-047 | `reviews.test.tsx` › shows an attached photo only when there is one                        | U   | EP   | With and without photo       | Photo shown only when present                                                                                              |
| TC-048 | `reviews.test.tsx` › filters reviews by who wrote them                                     | U   | EP   | One buyer, one seller review | "From sellers" shows only the seller's                                                                                     |
| TC-049 | `reviews.test.tsx` › explains an empty rating tab                                          | U   | BVA  | No reviews                   | "No reviews yet" message                                                                                                   |

### TD-09 Notifications (FR-11, UC15)

| ID     | Test (file › name)                                                    | Lvl | Tech | Input / precondition             | Expected result                                                         |
| ------ | --------------------------------------------------------------------- | --- | ---- | -------------------------------- | ----------------------------------------------------------------------- |
| TC-050 | `chat-cart.test.ts` › marks one notification, or all of them, as read | I   | FN   | Seller with unread notifications | Other user cannot mark (404); owner marks one; mark-all leaves 0 unread |

### TD-10 AI agents and fallbacks (FR-15–FR-17, Reliability NFR)

| ID     | Test (file › name)                                                                                | Lvl | Tech | Input / precondition                   | Expected result                                       |
| ------ | ------------------------------------------------------------------------------------------------- | --- | ---- | -------------------------------------- | ----------------------------------------------------- |
| TC-051 | `ai-orchestrator.test.ts` › parses JSON, including replies wrapped in a code fence                | U   | EG   | Model reply in a code fence            | Parsed correctly                                      |
| TC-052 | `ai-orchestrator.test.ts` › serves an identical prompt from cache without calling the model again | U   | FN   | Same prompt twice                      | One model call; second answer cached                  |
| TC-053 | `ai-orchestrator.test.ts` › rejects output that is not JSON or does not match the schema          | U   | EG   | Non-JSON; wrong field type             | AI treated as unavailable                             |
| TC-054 | `ai-orchestrator.test.ts` › enforces the daily quota, and failed calls do not use it up           | U   | BVA  | Limit 2; one failed call, then 3 calls | Failed call not counted; 3rd call refused             |
| TC-055 | `ai-orchestrator.test.ts` › moderation keeps the rule-based verdict                               | U   | FN   | Model unusable                         | Rule-based verdict used                               |
| TC-056 | `ai-orchestrator.test.ts` › listing extraction returns a heuristic draft                          | U   | FN   | Model unusable                         | Heuristic draft returned                              |
| TC-057 | `ai-orchestrator.test.ts` › moderation uses the model verdict and adds diet flags                 | U   | FN   | Model reply with a gluten flag         | DIET_FLAG with `gluten`                               |
| TC-058 | `ai-groq.test.ts` › sends an OpenAI-style JSON-mode request and returns the content               | U   | FN   | Stubbed Groq API                       | Correct URL, key, model and JSON mode                 |
| TC-059 | `ai-groq.test.ts` › drops image parts when vision is off                                          | U   | EP   | Prompt with an image                   | Text only is sent                                     |
| TC-060 | `ai-groq.test.ts` › HTTP error / empty reply / network failure → AiUnavailableError               | U   | EG   | 429, empty reply, network error        | Treated as unavailable so callers fall back (3 cases) |

### TD-11 Security and privacy (Security and Privacy NFR)

| ID     | Test (file › name)                                                                                  | Lvl | Tech | Input / precondition                     | Expected result                                           |
| ------ | --------------------------------------------------------------------------------------------------- | --- | ---- | ---------------------------------------- | --------------------------------------------------------- |
| TC-061 | `security.test.ts` › rejects unsafe listing photo URLs with a friendly message                      | I   | EG   | Internal-network and path-traversal URLs | 400 with a readable message                               |
| TC-062 | `security.test.ts` › rejects an external avatarUrl                                                  | I   | EG   | Avatar from another site                 | 400                                                       |
| TC-063 | `security.test.ts` › accepts a real PNG upload, serves it with nosniff, and rejects fake images     | I   | EG   | Real PNG; plain text sent as a PNG       | PNG stored and served with `nosniff`; fake rejected (415) |
| TC-064 | `validation.test.ts` › uploads › requires login                                                     | I   | EG   | Upload without a token                   | 401                                                       |
| TC-065 | `validation.test.ts` › uploads › detects images by content, not by name                             | U   | EG   | Bytes of JPEG/PNG/WebP and junk          | Type from content only                                    |
| TC-066 | `security.test.ts` › shares counterpart contact in /transactions/mine without leaking email or hash | I   | FN   | Claimed trade                            | Contact shared; no email, no password hash                |
| TC-067 | `flow.test.ts` › saves a Rp 0 sale as FREE and shows the exact pin only to the seller               | I   | EP   | Seller and another user view a listing   | Pin returned to seller only                               |

### TD-12 Chat and cart (New)

| ID     | Test (file › name)                                                                     | Lvl | Tech | Input / precondition                     | Expected result                                                             |
| ------ | -------------------------------------------------------------------------------------- | --- | ---- | ---------------------------------------- | --------------------------------------------------------------------------- |
| TC-068 | `chat-cart.test.ts` › lets buyer and seller message each other with unread counts      | I   | FN   | Buyer sends 2 messages                   | Seller sees 2 unread; reading marks them read; `?after=` returns only newer |
| TC-069 | `chat-cart.test.ts` › notifies once per unread burst, not on every message             | I   | FN   | 3 quick messages                         | 1 notification                                                              |
| TC-070 | `chat-cart.test.ts` › hides threads from outsiders and closes chat on cancelled trades | I   | EG   | Outsider; blank message; cancelled trade | 404; 400; 409 on send                                                       |
| TC-071 | `chat-cart.test.ts` › adds, lists, removes, and clears an item once claimed            | I   | FN   | Two items added; one claimed             | Own listing rejected; claimed item leaves cart; no location data in cart    |
| TC-072 | `chat-cart.test.ts` › marks items unavailable once they expire                         | I   | BVA  | Cart item past expiry                    | `available: false`                                                          |
| TC-073 | `chat-cart.test.ts` › cart › requires login                                            | I   | EG   | No token                                 | 401                                                                         |
| TC-074 | `cart.test.tsx` › loads the cart from the API once, even with several components       | U   | FN   | Two components using the cart            | One API request                                                             |
| TC-075 | `cart.test.tsx` › adds and removes items through the API                               | U   | FN   | Add then remove                          | POST then DELETE; cart updated                                              |
| TC-076 | `cart.test.tsx` › moves an old browser-only cart to the API once                       | U   | FN   | Old cart in local storage                | Items uploaded; local copy removed                                          |
| TC-077 | `cart.test.tsx` › is empty when signed out and never calls the API                     | U   | EP   | Signed out                               | Empty; no requests                                                          |
| TC-078 | `listing-card.test.tsx` › adds to and removes from the cart                            | U   | FN   | Click + twice                            | Add, then remove                                                            |
| TC-079 | `listing-card.test.tsx` › sends signed-out visitors to the login page instead          | U   | EP   | Signed out                               | Redirect to /login                                                          |
| TC-080 | `listing-card.test.tsx` › hides the cart button on the seller's own listing            | U   | EP   | Viewer is the seller                     | No cart button                                                              |
| TC-081 | `listing-card.test.tsx` › shows the reason when adding fails                           | U   | EG   | API rejects                              | Error message shown                                                         |

### TD-13 Location and address (New, Privacy NFR)

| ID     | Test (file › name)                                                                                 | Lvl | Tech | Input / precondition              | Expected result                              |
| ------ | -------------------------------------------------------------------------------------------------- | --- | ---- | --------------------------------- | -------------------------------------------- |
| TC-082 | `geocode.test.ts` › builds a short street address and a coarse public area                         | U   | FN   | Address from OpenStreetMap        | Street address; neighbourhood + city as area |
| TC-083 | `geocode.test.ts` › falls back to the display name when there is no usable detail                  | U   | EG   | Empty address fields              | Display name used                            |
| TC-084 | `geocode.test.ts` › calls Nominatim with an identifying User-Agent and caches the result           | U   | FN   | Same pin twice                    | One request with app User-Agent              |
| TC-085 | `geocode.test.ts` › returns null instead of throwing when the service fails                        | U   | EG   | Service returns 429               | `null`, no error                             |
| TC-086 | `geocode.test.ts` › spaces calls at least a second apart                                           | U   | BVA  | Two simultaneous lookups          | ≥ 1000 ms apart                              |
| TC-087 | `chat-cart.test.ts` › previews a pin address: login required, coordinates validated, null when off | I   | BVA  | No token; latitude 200; valid pin | 401; 400; `{ result: null }`                 |
| TC-088 | `pricing.test.ts` › points OpenStreetMap at the pin                                                | U   | FN   | A pin                             | Map link with the pin's coordinates          |

### TD-14 Frontend support code and profile (New)

| ID     | Test (file › name)                                                                                  | Lvl | Tech | Input / precondition    | Expected result                             |
| ------ | --------------------------------------------------------------------------------------------------- | --- | ---- | ----------------------- | ------------------------------------------- |
| TC-089 | `api-client.test.ts` › GETs by default and sends the bearer token                                   | U   | FN   | Request with a token    | GET with `Authorization: Bearer`            |
| TC-090 | `api-client.test.ts` › POSTs JSON when a body is given                                              | U   | FN   | Request with a body     | POST with JSON body                         |
| TC-091 | `api-client.test.ts` › resolves to null for empty responses such as 204                             | U   | BVA  | 204 No Content          | `null`                                      |
| TC-092 | `api-client.test.ts` › turns API errors into ApiError with the server's message and field errors    | U   | EG   | 400 with field errors   | ApiError with message and fields            |
| TC-093 | `api-client.test.ts` › uses a friendly message when the server gives none                           | U   | EG   | 502 without JSON        | Friendly generic message                    |
| TC-094 | `api-client.test.ts` › reports network failures as status 0                                         | U   | EG   | Network down            | Status 0, "Cannot reach the server"         |
| TC-095 | `local-store.test.ts` › reads, writes and notifies subscribed components                            | U   | FN   | Value saved             | Component updates; value stored             |
| TC-096 | `local-store.test.ts` › returns the same object until the stored value changes                      | U   | FN   | Two reads               | Same object (no extra renders)              |
| TC-097 | `local-store.test.ts` › falls back to the empty value for corrupt entries                           | U   | EG   | Corrupt stored JSON     | Empty value                                 |
| TC-098 | `edit-profile-modal.test.tsx` › closes straight away when nothing changed, and Save starts disabled | U   | EP   | No edits                | Save disabled; Close closes                 |
| TC-099 | `edit-profile-modal.test.tsx` › reminds about unsaved changes, and Keep editing keeps them          | U   | FN   | Name edited, then Close | Reminder shown; Keep editing keeps the edit |
| TC-100 | `edit-profile-modal.test.tsx` › Discard changes closes without saving                               | U   | FN   | Edit, Close, Discard    | Closed; nothing sent                        |
| TC-101 | `edit-profile-modal.test.tsx` › saves every edited field in one request                             | U   | FN   | Name and radius changed | One PATCH with all fields                   |
| TC-102 | `edit-profile-modal.test.tsx` › shows the server error and stays open when saving fails             | U   | EG   | Server rejects          | Error shown; popup stays open               |

TD-15 and TD-16 (39 seller and buyer scenarios, IDs S-x.y and B-x.y) are specified in
[USE-CASE-TESTS.md](USE-CASE-TESTS.md) rather than repeated here.

**Test cases and automated tests.** Most test cases are one automated test. The exceptions:
TC-017, TC-022 and TC-060 each run three inputs, while one long end-to-end test in
`flow.test.ts` covers four test cases (TC-026, TC-028, TC-035, TC-041) and the Rp 0 test covers
two (TC-015, TC-067). Together, the 102 test cases correspond to the 104 automated test runs
in the Test Log.

---

## 4. Test Procedure Specification

**TP-01: Run the full automated suite (local).**

1. Install dependencies: `npm ci`.
2. Start the database: `npm run db:up`.
3. Apply migrations: `npm run db:migrate -w backend`.
4. Run all tests: `npm test`.
5. Optional, coverage: `npm run test:coverage -w backend` and `-w frontend`; open
   `backend/coverage/index.html` and `frontend/coverage/index.html`.
6. Record the result in the Test Log (§5).

**TP-02: Run one test file or one test case.**
`npx vitest run tests/flow.test.ts` (inside `backend/`), or add `-t "<test name>"` to run a
single test case by name.

**TP-03: CI run.** Open a pull request to `main` or `develop`. GitHub Actions runs lint,
typecheck, tests (with a PostgreSQL service) and build for both applications. The result is
shown on the pull request.

---

## 5. Test Log

**Run 1:** 6 November 2026 · commit `89f06d6` · Windows 11, Node.js 24.9.0 · PostgreSQL 17
(Docker) · procedure TP-01.

| Test file                     | Suite    | Passed  | Failed | Skipped |
| ----------------------------- | -------- | ------- | ------ | ------- |
| `ai-groq.test.ts`             | Backend  | 5       | 0      | 0       |
| `ai-orchestrator.test.ts`     | Backend  | 7       | 0      | 0       |
| `chat-cart.test.ts`           | Backend  | 11      | 0      | 0       |
| `crypto.test.ts`              | Backend  | 3       | 0      | 0       |
| `flow.test.ts`                | Backend  | 6       | 0      | 0       |
| `geocode.test.ts`             | Backend  | 5       | 0      | 0       |
| `health.test.ts`              | Backend  | 4       | 0      | 0       |
| `rule-based-filter.test.ts`   | Backend  | 4       | 0      | 0       |
| `security.test.ts`            | Backend  | 11      | 0      | 0       |
| `validation.test.ts`          | Backend  | 5       | 0      | 0       |
| `seller.test.ts`              | Backend  | 22      | 0      | 0       |
| `buyer.test.ts`               | Backend  | 17      | 0      | 0       |
| `api-client.test.ts`          | Frontend | 6       | 0      | 0       |
| `format.test.ts`              | Frontend | 7       | 0      | 0       |
| `local-store.test.ts`         | Frontend | 3       | 0      | 0       |
| `cart.test.tsx`               | Frontend | 4       | 0      | 0       |
| `listing-card.test.tsx`       | Frontend | 5       | 0      | 0       |
| `pricing.test.ts`             | Frontend | 7       | 0      | 0       |
| `edit-profile-modal.test.tsx` | Frontend | 5       | 0      | 0       |
| `reviews.test.tsx`            | Frontend | 6       | 0      | 0       |
| **Total**                     |          | **143** | **0**  | **0**   |

**Run 2 (CI):** pending. Record the GitHub Actions result here once the pull request for this
branch has run.

---

## 6. Test Incident Report

Defects found by testing during development, and how each was resolved.

| ID     | Found by                  | Description                                                                                                                                                                                                                | Severity               | Resolution                                                                          | Status                             |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| INC-01 | TC-068                    | Chat polling returned the last message again on every poll. PostgreSQL stores microseconds but the API sends milliseconds, so `?after=<last message time>` still matched that message. Users would see duplicate messages. | High                   | Compare at millisecond precision (`date_trunc('milliseconds', …)`)                  | Fixed                              |
| INC-02 | Code review before TC-071 | The new `pickup_address` column would have been included in every public listing response, exposing a seller's street address.                                                                                             | High (privacy)         | Removed from public responses in `toPublicListing`; TC-071 checks the cart response | Fixed                              |
| INC-03 | TC-026, TC-032            | Tests failed at random. Test files ran in parallel on one database and shared the scheduler lock; old test data also pushed a search result off the first page.                                                            | Medium                 | Test files run one at a time; search uses a unique word per run                     | Fixed                              |
| INC-04 | CI                        | Backend typecheck failed on every fresh copy: `.gitignore` rule `uploads/` also hid the source folder `src/modules/uploads/`, so that file was never committed.                                                            | High                   | Anchored the rule to `/backend/uploads/` and committed the file                     | Fixed                              |
| INC-05 | CI                        | The test runner could not start on Linux or Windows: the lockfile was missing `rolldown`'s platform packages (npm bug).                                                                                                    | High                   | Lockfile regenerated cleanly; fix documented in `docs/TESTING.md`                   | Fixed; to be confirmed in CI run 2 |
| INC-06 | Manual AI evaluation      | With low reasoning effort the AI moderator accepted a listing describing spoiled food ("agak bau asam") as OK.                                                                                                             | High (food safety)     | Prompt now lists signs of spoilage; re-test rejected it 6 out of 6 times            | Fixed                              |
| INC-07 | CI design review          | Integration tests skipped silently when CI had no database, so CI passed without running 27 tests.                                                                                                                         | Medium                 | CI now provides PostgreSQL; tests fail instead of skipping in CI                    | Fixed                              |
| INC-08 | B-8.1, B-8.2              | Two buyer scenarios got "429 Too Many Requests": the global limit of 120 requests per minute was the only rate limit not switched off in tests.                                                                            | Low (test environment) | Global limit skipped in tests like the others; production unchanged                 | Fixed                              |

---

## 7. Test Summary Report

**Summary.** Run 1 executed all 143 automated tests (102 test cases in §3 plus 39 seller and
buyer scenarios in USE-CASE-TESTS.md); all passed, none were skipped. Eight incidents were found
during testing and all are fixed; INC-05 still needs confirming by the first CI run (Run 2).

**Coverage.**

| Suite    | Statements | Branches | Functions | Lines |
| -------- | ---------- | -------- | --------- | ----- |
| Backend  | 81.8%      | 66.7%    | 76.5%     | 86.7% |
| Frontend | 23.0%      | 18.7%    | 23.0%     | 22.2% |

All 37 backend routes have at least one test. Frontend coverage is low because the page
components under `src/app/` are not tested yet; the logic and shared components listed in TD-03,
TD-08, TD-12 and TD-14 are.

**Evaluation.** The backend meets the pass criteria in §1.7 for Run 1. The release criteria
also require a passing CI run, which is pending.

**Variances from the plan.** Page components were planned but not tested in this version
(§1.5). Live AI and geocoding behaviour is checked with stubs, not against the real services.

**Recommendations.**

1. Confirm Run 2 (CI) and record it in §5.
2. Add tests for the main pages (listing detail, chat, cart, profile).
3. Raise backend branch coverage, currently the lowest backend figure (67%).
4. Add a small set of manual system tests for flows that need a real browser and two users
   (for example a chat between buyer and seller).

**Approvals.**

| Name | Role | Signature | Date |
| ---- | ---- | --------- | ---- |
|      |      |           |      |
