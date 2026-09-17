# ZoloFund Automation Test Sketch — Penalty, Overdue, NPA, Foreclosure, Settlement

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

Implement automated tests for overdue detection, penalty accrual/waiver/settlement, NPA classification/history/provisioning, foreclosure/preclose calculation, closure, write-off/settlement behaviour, and idempotent cron behaviour.

## Source areas Codex should inspect first

- `app/api/v1/penalties/route.ts`
- `app/api/v1/penalties/[id]/settle/route.ts`
- `app/api/v1/penalties/[id]/waive/route.ts`
- `app/api/cron/accrue-penalties/route.ts`
- `app/api/cron/npa-classify/route.ts`
- `app/api/v1/npa/history/route.ts`
- `app/api/v1/npa/loans/route.ts`
- `app/api/v1/npa/summary/route.ts`
- `app/api/v1/loans/[id]/preclose/route.ts`
- `app/api/v1/loans/[id]/close/route.ts`
- `lib/foreclosure.test.ts`
- `scripts/npaSharedService.test.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| RISK-001 | Loan with missed due date becomes overdue | Overdue API/report includes loan | API + DB |
| RISK-002 | Penalty accrual creates penalty | Penalty row and balance impact correct | Cron/API + DB |
| RISK-003 | Penalty cron idempotency | Second run does not duplicate penalty | Cron/API + DB |
| RISK-004 | Penalty waiver | Penalty waived and net due updated | API + DB |
| RISK-005 | Penalty settlement | Settlement collection/accounting correct | API + DB |
| RISK-006 | NPA bucket classification | Loan enters correct bucket after threshold | Cron/API + DB |
| RISK-007 | NPA history | NpaHistory row created once per transition | DB |
| RISK-008 | NPA summary | Summary totals match DB | API + DB |
| RISK-009 | Provisioning calculation | LoanProvisioning amount correct | Unit/API + DB |
| RISK-010 | Foreclosure calculation | Preclose amount correct with principal/interest/penalty | Unit/API |
| RISK-011 | Foreclosure close | Loan status closed; no future collections allowed | API + DB |
| RISK-012 | Settlement discount/write-off | Ledger and loan status correct | API + DB |
| RISK-013 | Closed loan cannot be reclosed | Returns conflict/validation error | API |

## Implementation sketch for Codex

1. Use fixed dates. Avoid relying on current system date; inject dates or create due dates relative to test date.
2. Seed loans with missed instalments at 1 day, 30 days, 60 days, 90+ days, and partially paid overdue status.
3. Trigger cron route with required secret/header after inspecting cron auth logic.
4. Assert idempotency by running the same cron twice.
5. Use DB assertions for `Penalty`, `Instalment`, `Loan`, `NpaHistory`, `LoanProvisioning`, `CollectionEntry`, `AccountEntry`, and `AuditLog`.
6. For foreclosure, test before first EMI, after partial payment, with penalty, and after waiver.
7. Implement exact expected amount helper and avoid floating point errors.
8. Verify that closed/write-off loans are excluded from active collection lists.

## Manual verification still needed

Manual finance/product sign-off is needed for NPA threshold rules, penalty wording, foreclosure receipt format, and settlement approval authority.

## Acceptance criteria

- Penalty and NPA calculations are deterministic and idempotent.
- Foreclosure and settlement amounts match expected accounting rules.
- Closed/write-off loans cannot receive invalid future collections.
- Risk reports match DB state.

## Suggested npm script

```json
"test:e2e-risk": "tsx tests/e2e-business/penaltyOverdueNpaForeclosure.test.ts"
```
