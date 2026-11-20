# WASTABLE Use-Case Test Specification: Seller and Buyer

**Document ID:** WASTABLE-UCT-001 · **Version:** 1.0 · **Date:** 6 November 2026
**Part of:** [WASTABLE Software Test Documentation](TEST-PLAN.md) (IEEE 829 style)

This document tests WASTABLE from the point of view of its two main users. Each use case lists
its scenarios: the **main flow** (everything goes right), **alternate flows** (a different but
valid path) and **exceptions** (the system must refuse). Every scenario is an automated test
with the same ID, so the results below come from real test runs, not manual checks.

| Automated tests                | Actor  | Scenarios |
| ------------------------------ | ------ | --------- |
| `backend/tests/seller.test.ts` | Seller | 22        |
| `backend/tests/buyer.test.ts`  | Buyer  | 17        |

## Actors

| Actor      | Description                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Seller** | A student or household with surplus food. Posts listings, handles claims, hands the food over. |
| **Buyer**  | Someone looking for food to buy, swap or take for free. Searches, claims, picks up.            |
| System     | WASTABLE itself: moderation, notifications, the scheduled expiry job.                          |

One account can act as both; the role depends on the trade (whoever claims is the buyer).

Requirement IDs (UCx, FR-x, NFR) are the ones used in the source code and refer to the project's
requirements specification. Scenarios for features added later are marked **New**.

## How to run

```bash
npm run db:up && npm run db:migrate -w backend      # once: database for the tests
cd backend
npx vitest run tests/seller.test.ts tests/buyer.test.ts --reporter=verbose
```

`--reporter=verbose` prints every scenario by name, for example
`Buyer > B-3 Claim food (UC11) > B-3.2 cannot claim food someone else has reserved…`.
To run one scenario: add `-t "B-3.2"`.

---

## Seller use cases

### S-1 Create an account and sign in

|                   |                                                 |
| ----------------- | ----------------------------------------------- |
| **Actor**         | Seller                                          |
| **Related**       | UC1–UC4, FR-1, FR-2                             |
| **Goal**          | Have a verified account that can post food      |
| **Preconditions** | None                                            |
| **Postcondition** | The seller is signed in with a verified account |

| ID    | Scenario                               | Flow      | Steps                                                       | Test data                                  | Expected result                      | Status |
| ----- | -------------------------------------- | --------- | ----------------------------------------------------------- | ------------------------------------------ | ------------------------------------ | ------ |
| S-1.1 | Register, verify the email and sign in | Main      | 1. Register 2. Open the verification link 3. Sign in        | Name "Rina Seller", password `password123` | Signed in; account shown as verified | Pass   |
| S-1.2 | Sign in with a wrong password          | Exception | 1. Register and verify 2. Sign in with a different password | Password `not-my-password`                 | Refused (401)                        | Pass   |
| S-1.3 | Post food before verifying the email   | Exception | 1. Register, do not verify 2. Post a listing                | Standard listing                           | Refused (403)                        | Pass   |

### S-2 Post surplus food

|                   |                                                |
| ----------------- | ---------------------------------------------- |
| **Actor**         | Seller                                         |
| **Related**       | UC5–UC8, FR-3, FR-12, FR-15, FR-16             |
| **Goal**          | Make surplus food visible to buyers            |
| **Preconditions** | Seller is signed in and verified               |
| **Postcondition** | The listing is AVAILABLE and appears in search |

| ID    | Scenario                            | Flow      | Steps                                                           | Test data                          | Expected result                             | Status |
| ----- | ----------------------------------- | --------- | --------------------------------------------------------------- | ---------------------------------- | ------------------------------------------- | ------ |
| S-2.1 | Post a listing buyers can find      | Main      | 1. Post a listing 2. Search for its title 3. Open "my listings" | Bakery item with a unique word     | Found in search; AVAILABLE in "my listings" | Pass   |
| S-2.2 | Sell at Rp 0                        | Alternate | 1. Post a SELL listing priced 0                                 | Price 0                            | Saved as FREE, price 0                      | Pass   |
| S-2.3 | Post a prohibited item              | Exception | 1. Post an alcohol listing                                      | "Bir dingin 6 kaleng"              | Refused (403), message says rejected        | Pass   |
| S-2.4 | Post food with a diet ingredient    | Alternate | 1. Post a listing containing pork                               | "Nasi goreng babi"                 | Posted; diet flag `pork` shown              | Pass   |
| S-2.5 | Expiry date in the past             | Exception | 1. Post with an expiry time already passed                      | Expiry 1 hour ago                  | Refused (422)                               | Pass   |
| S-2.6 | Let the AI helper draft the listing | Alternate | 1. Describe the food in words 2. Ask for a draft                | "5 nasi kotak ayam sisa katering…" | Draft returned, category cooked meal        | Pass   |

### S-3 Edit or remove a listing

|                   |                                                 |
| ----------------- | ----------------------------------------------- |
| **Actor**         | Seller                                          |
| **Related**       | UC5–UC8, FR-4                                   |
| **Goal**          | Keep a listing correct, or take it down         |
| **Preconditions** | Seller has an AVAILABLE listing                 |
| **Postcondition** | Changes saved, or the listing no longer visible |

| ID    | Scenario                           | Flow      | Steps                                  | Test data                     | Expected result                    | Status |
| ----- | ---------------------------------- | --------- | -------------------------------------- | ----------------------------- | ---------------------------------- | ------ |
| S-3.1 | Edit price and title               | Main      | 1. Edit the listing                    | New title, price 5000         | Saved with the new values          | Pass   |
| S-3.2 | Edit another seller's listing      | Exception | 1. Another account edits the listing   | Price 1                       | Refused (403)                      | Pass   |
| S-3.3 | Edit while a buyer has reserved it | Exception | 1. A buyer claims 2. Seller edits      | Price 1                       | Refused (409)                      | Pass   |
| S-3.4 | Remove a listing                   | Main      | 1. Delete the listing 2. Search for it | Dairy item with a unique word | Deleted (204); no longer in search | Pass   |

### S-4 Handle a claim from a buyer

|                   |                                                        |
| ----------------- | ------------------------------------------------------ |
| **Actor**         | Seller                                                 |
| **Related**       | UC11–UC13, FR-8, FR-11                                 |
| **Goal**          | Know who reserved the food and manage the hand-over    |
| **Preconditions** | Seller has an AVAILABLE listing                        |
| **Postcondition** | Claim is pending, cancelled, or completed by the buyer |

| ID    | Scenario                            | Flow      | Steps                                                             | Test data            | Expected result                                                       | Status |
| ----- | ----------------------------------- | --------- | ----------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------- | ------ |
| S-4.1 | Be told about a claim               | Main      | 1. A buyer claims 2. Seller opens notifications and "my listings" | Buyer "Budi Claimer" | CLAIM_REQUEST notification; listing PENDING, reserved by Budi Claimer | Pass   |
| S-4.2 | Cancel a claim (buyer did not come) | Alternate | 1. A buyer claims 2. Seller cancels                               | —                    | Food AVAILABLE again                                                  | Pass   |
| S-4.3 | Mark the pickup as done             | Exception | 1. A buyer claims 2. Seller marks it completed                    | —                    | Refused (403): only the buyer confirms                                | Pass   |
| S-4.4 | Claim own food                      | Exception | 1. Seller claims their own listing                                | —                    | Refused (400)                                                         | Pass   |

### S-5 Chat with the buyer (New)

|                   |                                          |
| ----------------- | ---------------------------------------- |
| **Actor**         | Seller                                   |
| **Related**       | New (trade chat)                         |
| **Goal**          | Agree on pickup details with the buyer   |
| **Preconditions** | A buyer has claimed the seller's listing |

| ID    | Scenario                           | Flow | Steps                                                               | Test data                    | Expected result                                   | Status |
| ----- | ---------------------------------- | ---- | ------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------- | ------ |
| S-5.1 | Read the buyer's message and reply | Main | 1. Buyer sends a message 2. Seller opens the chat 3. Seller replies | "Bisa ambil jam 7?" / "Bisa" | Seller sees the buyer's message; reply sent (201) | Pass   |

### S-6 Review the buyer

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Actor**         | Seller                                                             |
| **Related**       | UC14                                                               |
| **Goal**          | Rate the buyer after the trade                                     |
| **Preconditions** | The buyer has confirmed the pickup                                 |
| **Postcondition** | The review shows on the buyer's profile, labelled as from a seller |

| ID    | Scenario                     | Flow      | Steps                                                            | Test data               | Expected result                      | Status |
| ----- | ---------------------------- | --------- | ---------------------------------------------------------------- | ----------------------- | ------------------------------------ | ------ |
| S-6.1 | Review the buyer             | Main      | 1. Trade completed 2. Seller reviews 3. Open the buyer's profile | Rating 5, "Tepat waktu" | Review saved; shown with role SELLER | Pass   |
| S-6.2 | Review before pickup is done | Exception | 1. Buyer claims, pickup not confirmed 2. Seller reviews          | Rating 4                | Refused (409)                        | Pass   |

### S-7 Send expired food to compost

|                   |                                               |
| ----------------- | --------------------------------------------- |
| **Actor**         | Seller (System expires the listing)           |
| **Related**       | UC20, FR-10                                   |
| **Goal**          | Food that expired unsold still avoids the bin |
| **Preconditions** | Seller has a listing that expires             |

| ID    | Scenario                            | Flow | Steps                                                  | Test data                               | Expected result                               | Status |
| ----- | ----------------------------------- | ---- | ------------------------------------------------------ | --------------------------------------- | --------------------------------------------- | ------ |
| S-7.1 | Refer an expired listing to compost | Main | 1. Listing expires (scheduled job) 2. Seller refers it | Expiry in 1 hour; job run 2 hours later | Referral created (201) with a compost partner | Pass   |

### S-8 Keep the exact pickup location private

|                   |                                                        |
| ----------------- | ------------------------------------------------------ |
| **Actor**         | Seller                                                 |
| **Related**       | Privacy NFR                                            |
| **Goal**          | Buyers see the area and distance, never the exact spot |
| **Preconditions** | Listing saved with an exact pin                        |

| ID    | Scenario                              | Flow | Steps                                                         | Test data             | Expected result                                               | Status |
| ----- | ------------------------------------- | ---- | ------------------------------------------------------------- | --------------------- | ------------------------------------------------------------- | ------ |
| S-8.1 | Seller sees the pin, a buyer does not | Main | 1. Seller opens the listing 2. A buyer opens the same listing | Pin −6.3646, 106.8287 | Seller gets the pin; buyer's response contains no coordinates | Pass   |

---

## Buyer use cases

### B-1 Find food

|                   |                                                                   |
| ----------------- | ----------------------------------------------------------------- |
| **Actor**         | Buyer                                                             |
| **Related**       | UC9–UC10, FR-6, FR-7                                              |
| **Goal**          | Find suitable food nearby                                         |
| **Preconditions** | There are available listings (signing in is not needed to browse) |

| ID    | Scenario                     | Flow      | Steps                                         | Test data                            | Expected result                      | Status |
| ----- | ---------------------------- | --------- | --------------------------------------------- | ------------------------------------ | ------------------------------------ | ------ |
| B-1.1 | Search by keyword            | Main      | 1. Search for a word in the title             | Unique word                          | Exactly that listing returned        | Pass   |
| B-1.2 | Show free food only          | Alternate | 1. Search with the "free" filter              | One free and one paid listing        | Only the free listing                | Pass   |
| B-1.3 | Look at the seller's profile | Alternate | 1. Open the seller's profile                  | Seller with two listings, no reviews | Both listings shown; 0 ratings       | Pass   |
| B-1.4 | Exact location stays hidden  | Exception | 1. Search for a listing that has an exact pin | Pin −6.36, 106.83                    | No coordinates or address in results | Pass   |

### B-2 Save food to the cart (New)

|                   |                                    |
| ----------------- | ---------------------------------- |
| **Actor**         | Buyer                              |
| **Related**       | New (cart)                         |
| **Goal**          | Keep a list of food to claim later |
| **Preconditions** | Buyer is signed in                 |

| ID    | Scenario                     | Flow      | Steps                                          | Test data | Expected result                     | Status |
| ----- | ---------------------------- | --------- | ---------------------------------------------- | --------- | ----------------------------------- | ------ |
| B-2.1 | Add, view and remove         | Main      | 1. Add a listing 2. Open the cart 3. Remove it | —         | Shown as available; then cart empty | Pass   |
| B-2.2 | Claimed item leaves the cart | Alternate | 1. Add a listing 2. Claim it 3. Open the cart  | —         | Cart empty                          | Pass   |

### B-3 Claim food

|                   |                                                                |
| ----------------- | -------------------------------------------------------------- |
| **Actor**         | Buyer                                                          |
| **Related**       | UC11, FR-8                                                     |
| **Goal**          | Reserve food for pickup                                        |
| **Preconditions** | Buyer is signed in and verified; the listing is AVAILABLE      |
| **Postcondition** | Listing PENDING; buyer and seller can see each other's contact |

| ID    | Scenario                         | Flow      | Steps                                                | Test data                          | Expected result                                         | Status |
| ----- | -------------------------------- | --------- | ---------------------------------------------------- | ---------------------------------- | ------------------------------------------------------- | ------ |
| B-3.1 | Claim available food             | Main      | 1. Claim 2. Open "my trades"                         | Seller contact "WA 0812 1111 2222" | Claimed (201), PENDING; seller's name and contact shown | Pass   |
| B-3.2 | Claim food someone else reserved | Exception | 1. Another buyer claims first 2. This buyer claims   | —                                  | Refused (409), offered the waitlist                     | Pass   |
| B-3.3 | Too many open claims             | Exception | 1. Claim 4 different listings without picking any up | Limit: 3 open claims               | First 3 accepted, 4th refused (429)                     | Pass   |

### B-4 Join the waitlist

|                   |                                                 |
| ----------------- | ----------------------------------------------- |
| **Actor**         | Buyer                                           |
| **Related**       | UC12, FR-9, FR-11                               |
| **Goal**          | Get the food if the current claim falls through |
| **Preconditions** | The listing is reserved by another buyer        |

| ID    | Scenario                | Flow | Steps                                           | Test data | Expected result                         | Status |
| ----- | ----------------------- | ---- | ----------------------------------------------- | --------- | --------------------------------------- | ------ |
| B-4.1 | Wait, then get notified | Main | 1. Join the waitlist 2. The first buyer cancels | —         | Position 1; ITEM_AVAILABLE notification | Pass   |

### B-5 Confirm the pickup or cancel

|                   |                           |
| ----------------- | ------------------------- |
| **Actor**         | Buyer                     |
| **Related**       | UC13, FR-8, FR-11         |
| **Goal**          | Close the trade           |
| **Preconditions** | Buyer has a pending claim |

| ID    | Scenario           | Flow      | Steps                      | Test data | Expected result                                         | Status |
| ----- | ------------------ | --------- | -------------------------- | --------- | ------------------------------------------------------- | ------ |
| B-5.1 | Confirm the pickup | Main      | 1. Mark the pickup as done | —         | Trade completed; listing COMPLETED                      | Pass   |
| B-5.2 | Cancel the claim   | Alternate | 1. Cancel                  | —         | Food AVAILABLE again; seller notified (CLAIM_CANCELLED) | Pass   |

### B-6 Chat with the seller (New)

|                   |                                   |
| ----------------- | --------------------------------- |
| **Actor**         | Buyer                             |
| **Related**       | New (trade chat)                  |
| **Goal**          | Ask questions and agree on pickup |
| **Preconditions** | Buyer has claimed the listing     |

| ID    | Scenario                             | Flow | Steps                                                | Test data                       | Expected result                               | Status |
| ----- | ------------------------------------ | ---- | ---------------------------------------------------- | ------------------------------- | --------------------------------------------- | ------ |
| B-6.1 | Message the seller and see the reply | Main | 1. Send a message 2. Seller replies 3. Open the chat | "Masih ada?" / "Masih, silakan" | Both messages, in order, marked mine / theirs | Pass   |

### B-7 Review the seller

|                   |                                                          |
| ----------------- | -------------------------------------------------------- |
| **Actor**         | Buyer                                                    |
| **Related**       | UC14                                                     |
| **Goal**          | Help other buyers judge the seller                       |
| **Preconditions** | Buyer has confirmed the pickup                           |
| **Postcondition** | Review on the seller's profile, labelled as from a buyer |

| ID    | Scenario                 | Flow      | Steps                                                  | Test data                   | Expected result                                                                                   | Status |
| ----- | ------------------------ | --------- | ------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| B-7.1 | Review once after pickup | Main      | 1. Review 2. Review again 3. Open the seller's profile | Rating 4, "Enak, porsi pas" | First saved, second refused (409); profile: 1 rating, average 4, role BUYER, the reviewed product | Pass   |
| B-7.2 | Rating out of range      | Exception | 1. Review with rating 0, then 6                        | 0 and 6 (boundaries of 1–5) | Both refused (400)                                                                                | Pass   |

### B-8 Report an unsafe listing

|                   |                                 |
| ----------------- | ------------------------------- |
| **Actor**         | Buyer                           |
| **Related**       | UC16, FR-12                     |
| **Goal**          | Flag a listing for moderators   |
| **Preconditions** | Buyer is signed in and verified |

| ID    | Scenario                | Flow      | Steps                                      | Test data                    | Expected result                            | Status |
| ----- | ----------------------- | --------- | ------------------------------------------ | ---------------------------- | ------------------------------------------ | ------ |
| B-8.1 | Report once             | Main      | 1. Report 2. Report the same listing again | "Looks spoiled in the photo" | First accepted (201), second refused (409) | Pass   |
| B-8.2 | Report without a reason | Exception | 1. Report with an empty reason             | Empty reason                 | Refused (400)                              | Pass   |

---

## Traceability matrix

| Requirement | Seller scenarios         | Buyer scenarios                          |
| ----------- | ------------------------ | ---------------------------------------- |
| UC1–UC4     | S-1.1, S-1.2, S-1.3      | (every buyer test signs up the same way) |
| UC5–UC8     | S-2.1–S-2.6, S-3.1–S-3.4 | —                                        |
| UC9–UC10    | S-2.1                    | B-1.1–B-1.4                              |
| UC11        | S-4.1, S-4.4             | B-3.1–B-3.3, B-2.2                       |
| UC12        | —                        | B-4.1                                    |
| UC13        | S-4.2, S-4.3             | B-5.1, B-5.2                             |
| UC14        | S-6.1, S-6.2             | B-7.1, B-7.2                             |
| UC16        | —                        | B-8.1, B-8.2                             |
| UC20        | S-7.1                    | —                                        |
| Privacy NFR | S-8.1                    | B-1.4                                    |
| New: chat   | S-5.1                    | B-6.1                                    |
| New: cart   | —                        | B-2.1, B-2.2                             |

## Execution summary

**Run:** 6 November 2026 · Windows 11, Node.js 24.9.0, PostgreSQL 17 (Docker) ·
`npx vitest run tests/seller.test.ts tests/buyer.test.ts`

| Actor     | Use cases | Scenarios | Passed | Failed |
| --------- | --------- | --------- | ------ | ------ |
| Seller    | 8         | 22        | 22     | 0      |
| Buyer     | 8         | 17        | 17     | 0      |
| **Total** | **16**    | **39**    | **39** | **0**  |

**Incident found while writing these tests.** The first buyer run failed two scenarios (B-8.1,
B-8.2) with "429 Too Many Requests". The cause was not the report feature: the API's global limit
of 120 requests per minute per address was not switched off in tests, unlike every other rate
limit, and the buyer tests make more requests than that in under a minute. The global limit is now
skipped in tests like the others (production is unchanged), and both scenarios pass.
