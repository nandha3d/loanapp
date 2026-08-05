# ZoloFund Automation Test Sketch — Cron Jobs, Idempotency, Scheduled Automation

This Markdown file is written as a direct implementation sketch/prompt for Codex.

## Project context Codex must use

- App stack: Next.js app router + TypeScript + Prisma + MySQL.
- Existing API style: `/api/v1/...` routes return the shared v1 envelope through `ok()` / `fail()`.
- Existing database models include: `Tenant`, `Branch`, `User`, `Customer`, `LoanPackage`, `Loan`, `Instalment`, `DailyCollection`, `CollectionEntry`, `AccountEntry`, `WalletTransaction`, `BranchCashAccount`, `AgentAccount`, `CashHandover`, `ApprovalRequest`, `Penalty`, `NpaHistory`, `LoanProvisioning`, `GoldLoanCollateral`, `Payment`, `PaymentAllocation`, `NachMandate`, `NachPresentation`, `AuditLog`.
- Existing package scripts already include several `tsx` test scripts and Playwright setup. Add new tests without breaking existing scripts.
- Prefer API + DB tests for business correctness. Use Playwright only where UI behaviour must be verified.
- Do not depend on production data. Use a dedicated QA/test database from `DATABASE_URL`.

## Common implementation rules

1. Create deterministic seed helpers for tenant, branches, users, customers, packages, loans, and opening cash.
2. Every test must clean up its own data or use unique IDs/slugs using a timestamp/test prefix.
3. Every money test must assert all four layers where applicable: API response, DB row, ledger/wallet row, and report/API summary.
4. Use idempotency keys for payment/collection tests.
5. Assert tenant isolation and branch isolation for every read/list API that returns business data.
6. Add clear npm scripts for each test file.
7. Keep tests independent; one failed test should not corrupt the next test.

## Suggested shared helper files

Codex can create helpers similar to these:

```text
tests/helpers/testDb.ts
tests/helpers/apiClient.ts
tests/helpers/seedZoloFund.ts
tests/helpers/assertMoney.ts
tests/helpers/authTokens.ts
tests/helpers/cleanup.ts
```

The helper names can be adjusted after inspecting the repository, but keep the same responsibilities.


## Objective

Implement automated tests for cron endpoints: penalty accrual, NPA classification, dunning/reminders, reports, NACH presentation, subscription reminders, GPS purge, affiliate sync, and balance recompute. Main focus: idempotency and safe retry.

## Source areas Codex should inspect first

- `app/api/cron/accrue-penalties/route.ts`
- `app/api/cron/npa-classify/route.ts`
- `app/api/cron/send-reminders/route.ts`
- `app/api/cron/dunning/route.ts`
- `app/api/cron/reports/route.ts`
- `app/api/cron/send-reports/route.ts`
- `app/api/cron/nach-present/route.ts`
- `app/api/cron/subscription-reminders/route.ts`
- `app/api/cron/gps-purge/route.ts`
- `app/api/cron/recompute-balances/route.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| CRON-001 | Cron secret required | Missing/wrong secret is blocked | API |
| CRON-002 | Penalty accrual cron | Creates expected penalties | Cron + DB |
| CRON-003 | Penalty cron idempotent | Second run creates zero duplicates | Cron + DB |
| CRON-004 | NPA classify cron | Creates/updates expected NPA state | Cron + DB |
| CRON-005 | NPA cron idempotent | Second run does not duplicate NpaHistory | Cron + DB |
| CRON-006 | Reminder cron | NotificationLog rows created for due/overdue cases | Cron + DB |
| CRON-007 | Reminder cron idempotent | No duplicate same-day reminder | Cron + DB |
| CRON-008 | Report cron | Report log/export record created | Cron + DB |
| CRON-009 | NACH present cron | Eligible mandates presented once | Cron + DB |
| CRON-010 | Subscription reminder cron | Only expiring tenants notified | Cron + DB |
| CRON-011 | GPS purge cron | Only old pings removed | Cron + DB |
| CRON-012 | Balance recompute cron | Corrects seeded inconsistent balances | Cron + DB |
| CRON-013 | Cron lock | Parallel/repeated execution does not corrupt data | Cron + DB |

## Implementation sketch for Codex

1. Inspect cron auth secret/header. Add test helper `callCron(path)` that sets the required secret.
2. Seed eligible and non-eligible records for each cron.
3. For every cron, capture counts/totals before, run cron, assert expected delta, run cron again, assert zero duplicate delta.
4. Assert `CronLock` behaviour if used.
5. For reminders/reports, assert log rows rather than depending on actual email/SMS delivery.
6. For balance recompute, deliberately seed one inconsistent aggregate and verify it is corrected.
7. For GPS purge, create old and recent `AgentLocationPing` rows and verify only old rows are removed.
8. Do not call real external providers. Mock/provider logs only.

## Manual verification still needed

Manually verify actual scheduler configuration in deployment, email/SMS provider delivery, report attachments, and business timing of cron execution.

## Acceptance criteria

- Cron endpoints are protected.
- Every cron is safe to retry.
- Logs and DB changes are correct.
- No external provider dependency is required for automated tests.

## Suggested npm script

```json
"test:e2e-cron": "tsx tests/e2e-business/cronJobsIdempotency.test.ts"
```
