# Microlending E2E — Test Result Report

**Suite:** `tests/e2e/microlending-workflow.spec.ts`
**Run date:** 2026-06-21 (final run after closing the 2 skipped cases)
**Runner:** Playwright (`@playwright/test`), Chromium / Desktop Chrome
**App under test:** Next.js 16 dev server (`next dev --webpack`) on `http://localhost:3000`
**DB:** MySQL `loanapp` @ localhost:3306 (seeded test users + sample data)
**Module pin:** `E2E_ACTIVE_BRANCH_ID=cmq8yymu4000478ejxg1ej0cc` (ZoloFund tenant → microlending branch)

---

## Verdict: PASS ✅ — full coverage, nothing skipped

| Metric | Count |
|---|---|
| **Passed** | **17 / 17** |
| Flaky (failed once on cold compile, passed on retry) | 1 |
| **Skipped** | **0** |
| **Failed** | **0** |
| Setup logins (superadmin/admin/agent) | 3 — all pass |
| Wall-clock duration | ~193 s (3.2 min) |

> Previous report had 2 conditional skips (ML-07, ML-N04). Both now run and pass —
> see "Closing the skipped cases" below.

---

## Per-test results

| ID | Title | Result | Time |
|----|-------|--------|------|
| ML-01 | create customer (route + agent + preferred collection time) | PASS (flaky) | 53.6s |
| ML-02 | new customer appears in the customer list | PASS | 13.1s |
| ML-03 | create a DAILY loan (auto-active as superadmin) | PASS | 18.3s |
| ML-04 | loan detail shows schedule, outstanding, instalments | PASS | 4.2s |
| ML-05 | record a payment via loan-page collect popup (Today's Due) | PASS | 7.0s |
| ML-06 | actual vs distributed views render & agree on total | PASS | 10.3s |
| ML-07 | collection page lists a customer & records a payment (redesigned popup) | PASS | 20.9s |
| ML-08 | a fully-paid customer stays visible (grayed), not removed | PASS | 6.5s |
| ML-09 | dashboard Today's Split bars ≤100% (no 3111% regression) | PASS | 10.5s |
| ML-10 | dashboard today-activity feed lists the collection just made | PASS | 4.5s |
| ML-N01 | loan with principal = 0 is rejected | PASS | 15.3s |
| ML-N02 | loan with no customer cannot be submitted | PASS | 15.0s |
| ML-N03 | customer with no name is rejected (HTML required) | PASS | 14.4s |
| ML-N04 | collection: overpaying is capped, never over-credits an instalment | PASS | 70.8s |
| ML-R01 | agent kept out of admin-only pages (/accounting) | PASS | 30.6s |
| ML-R02 | agent CAN open /collection (their core screen) | PASS | 30.4s |
| ML-R03 | agent CAN open the dashboard | PASS | 10.1s |

---

## Closing the skipped cases (ML-07, ML-N04)

Both used to `test.skip` whenever the seed had no collectible row that day. They
were finished — made deterministic, not data-dependent. Three distinct issues had
to be fixed:

1. **Stale selector (test bug).** The collection redesign replaced per-row "Pay"
   buttons with a single primary button whose accessible name is `"payments Pay"`
   (the Material-icon ligature text precedes the label). The old `/^pay$/i` exact
   match could never hit it → the tests skipped forever. Fixed with a shared
   `payButton()` helper matching `/\bpay\b/i` (matches "Pay", excludes "payments"
   and "Submit Payment" — no word boundary inside them).

2. **Data dependency (test design).** In the serial flow the customer is fully
   settled by ML-05, so it genuinely has no due row at ML-07. Both tests now
   **self-seed** a fresh customer + DAILY loan (start today → instalment #1 due
   today) via new `createCustomer()` / `createDailyLoan()` helpers, so a
   collectible row always exists.

3. **Onboarding overlay intercepting clicks (see Findings).** The first-run
   "Getting started guide" dialog blocked the Pay/Create buttons. Pre-seeding its
   "done" flag in `beforeEach` fixed it for the whole suite.

A fourth, helper-only race was found and fixed while wiring this up: `createLoan`
redirects to `/loans/<code>` via a server-action RPC; reading `page.url()` right
after `networkidle` raced the client redirect and still saw `/loans/new`. The
helper now `waitForURL(...)` before reading the code.

---

## Findings (issues surfaced by the tests)

- **Live production bug — FIXED.** `app/api/v1/loans/route.ts` referenced an
  undeclared `status` variable (commit `67de1e6`) → **every loan creation 500'd**
  for all roles. Fixed by declaring
  `const status = bypassLoanApproval ? 'active' : 'pending_review';`.

- **UX observation (not fixed).** The first-run onboarding tour
  (`components/onboarding/OnboardingTour.tsx`) renders a `position: fixed`
  bottom-right dialog with `z-index: 9999`. It **intercepts pointer events** for
  anything beneath its footprint until dismissed. A real user clicking a control
  in that corner on first run would be blocked too. It is dismissible (Skip), so
  severity is low — but worth a glance (e.g. shrink hit-area, or only overlay the
  card not the corner). The suite works around it by marking the tour completed.

---

## Flaky analysis (ML-01 only, now)

The onboarding fix removed the earlier flakiness on ML-01/ML-03/ML-N01. The single
remaining flake is **dev-server first-compile latency**: `next dev --webpack`
compiles a route on first hit, which can blow the per-test timeout cold; the retry
hits the warm route and passes fast. Not a product defect.

**Eliminate it** by running a production build instead of dev:
```
npm run build && npm run start          # routes precompiled, no on-demand compile
```
Needs `PII_ENCRYPTION_KEY` + `MOBILE_JWT_SECRET` set (env validator is FATAL in
production). Do NOT fake them against the live DB — a wrong `PII_ENCRYPTION_KEY`
breaks aadhaar decryption for the 21 real customers. Use a throwaway DB.

---

## How to reproduce this run

```bash
# 1. seed DB (test users: superadmin/super123, admin/admin123, agent karthik/agent123)
npm run db:seed

# 2. start app
npm run dev        # or: npm run build && npm run start  (no flake, needs prod secrets)

# 3. run the microlending suite (retries cover dev cold-compile)
E2E_ACTIVE_BRANCH_ID=cmq8yymu4000478ejxg1ej0cc \
  npx playwright test tests/e2e/microlending-workflow.spec.ts --retries=2 --timeout=120000

# 4. open the HTML report
npx playwright show-report
```

Artifacts:
- HTML report — `playwright-report/index.html`
- Machine-readable — `test-results/results.json` (parse: `node scripts/parse-e2e-results.cjs`)
- Failure traces/screenshots/video — `test-results/<case>/` (only on failure/retry)

---

## Related deliverable

`tests/e2e/microlending-testcases.xlsx` — 79-case manual test catalogue (10 area
sheets + Summary + All Cases), generated by `scripts/gen-microlending-testcases.cjs`.
The 17 automated cases above are the executable subset of that catalogue.
