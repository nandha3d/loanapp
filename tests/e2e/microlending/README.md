# Micro Lending E2E suite

One continuous business journey against a real database, from self-registration
through to collection, with every branch-isolation invariant asserted along the
way. Results feed a tracker page that shows a verdict for **every** catalogued
case — including the ones no spec claims yet.

## Running it

```bash
# 1. QA database (once)
DATABASE_URL=<qa-url> npx prisma db push
DATABASE_URL=<qa-url> npx tsx prisma/seed-pricing.ts   # plan + addon catalog

# 2. App under test, pointed at the QA database
set -a; . ./.env.e2e; set +a
npx next dev --webpack -p 3100

# 3. Suite + tracker page
npm run test:ml-full
```

`.env.e2e` (gitignored) pins `TEST_DATABASE_URL`, the auth secrets shared with
the running server, and `E2E_BASE_URL`. The suite refuses to run against a
database whose name does not contain `test` / `qa` / `e2e` / `ci`.

The tracker lands at `test-report/microlending.html`.

## Layout

| File | Covers |
|---|---|
| `cases.ts` | The catalogue — 182 cases, the source of truth for the tracker |
| `01-registration.spec.ts` | Tenant provisioning, plan snapshot, seeded settings |
| `02-auth.spec.ts` | Email verification, login paths, session gating |
| `03-branch-staff.spec.ts` | Branch creation, plan limits, the branch switcher, staff |
| `04-capital-float.spec.ts` | Routes, capital injection, agent float, handovers |
| `05-customers.spec.ts` | Agent registration → admin approval, PII, scoping |
| `06-loans.spec.ts` | Origination, approval, contract numbers, every frequency |
| `07-collection.spec.ts` | Repayment allocation, idempotency, closure, cash book |
| `08-rbac-isolation.spec.ts` | Role refusals, branch and tenant isolation, security |
| `09-penalties-npa-gps.spec.ts` | Penalty accrual, NPA ladder, GPS gating and pings |
| `10-remaining.spec.ts` | Handovers, single-click controls, provisioning, borrower |

`support/` holds the harness: the QA Prisma client, the JWT API client, the run
state file that carries ids between spec files, and the UI helpers.

## Conventions that matter

**A case is claimed by its id in the test title** — `test('[ML-101] …')`. The
report joins on that id, so a renamed title is fine and a changed id is not.

**Not serial.** Ordering comes from `workers: 1, fullyParallel: false`. Playwright's
serial mode would *skip* every later case once one fails, and the tracker needs a
real verdict per case rather than a blank.

**Wait for the row, not the clock.** Server actions in dev take seconds on a cold
route. `waitForRow()` polls for the row the action is supposed to write.

**Wait for hydration before touching a control.** Filling a controlled input
before React hydrates sets the DOM value but never the state, so the form submits
empty strings — which looks exactly like a real auth or validation bug.
`waitForHydration()` waits for React's `__reactFiber$…` key on the node.

**A failing case that found a real defect stays failing.** Where the defect would
poison later cases (a branch pool driven negative, a renamed customer), the test
restores the row *before* asserting, so the failure is reported once and nothing
downstream inherits it.

**Both surfaces count.** Branch scoping is asserted through the JWT API because
`X-Branch-Id` *is* the branch switcher and the response *is* the scoped row set.
The web dashboard reaches the same `lib/` functions through `serverFetch`, so an
API assertion is not the weaker assertion — see STRUCT-3 in
`ENGINEERING_REFERENCE.md`.
