# LoanTrack Automation Test Sketch — Gold Loan, Valuation, Collateral, Repledge, Release

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
tests/helpers/seedLoanTrack.ts
tests/helpers/assertMoney.ts
tests/helpers/authTokens.ts
tests/helpers/cleanup.ts
```

The helper names can be adjusted after inspecting the repository, but keep the same responsibilities.


## Objective

Implement automated tests for gold master setup, gold rate, ornament/spec configuration, collateral valuation, purity/net weight/LTV validation, gold loan creation, servicing interest, repledge, release, receipt, and reports.

## Source areas Codex should inspect first

- `app/api/v1/gold/master/route.ts`
- `app/api/v1/gold/rate/route.ts`
- `app/api/v1/gold/config/route.ts`
- `app/api/v1/gold/loans/[id]/repledge/route.ts`
- `app/api/v1/gold/loans/[id]/servicing/route.ts`
- `app/api/v1/gold/reports/route.ts`
- `app/api/v1/loans/[id]/gold-receipt/route.ts`
- `prisma/seed_gold_master.ts`
- `prisma/seed_gold_demo.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| GOLD-001 | Create ornament type/spec | OrnamentType and OrnamentSpecification saved | API + DB |
| GOLD-002 | Create/update gold rate | Rate saved per tenant/config | API + DB |
| GOLD-003 | Gross/net valuation | Weight, purity, wastage/deduction rules correct | Unit/API |
| GOLD-004 | LTV validation allows valid amount | Loan amount <= allowed LTV | API + DB |
| GOLD-005 | LTV validation blocks excess amount | Loan create fails and no loan/collateral row | API + DB |
| GOLD-006 | Gold loan with multiple ornaments | Collateral and item rows saved | API + DB |
| GOLD-007 | Gold receipt | Receipt API returns loan/collateral/value data | API |
| GOLD-008 | Bank repledge | BankRepledge row/status updated | API + DB |
| GOLD-009 | Servicing interest calculation | Interest due/paid values correct | Unit/API + DB |
| GOLD-010 | Release after closure | Collateral released only when loan closed | API + DB |
| GOLD-011 | Release before closure blocked | Returns validation error and status unchanged | API + DB |
| GOLD-012 | Gold report | Report totals match Loan + GoldLoanCollateral rows | API + DB |

## Implementation sketch for Codex

1. Seed gold master data using the existing seed strategy or create tenant-specific test records.
2. Create deterministic gold rate and LTV settings.
3. Implement pure unit tests for valuation formula using exact decimals.
4. Create a customer and gold loan with multiple ornament items.
5. Assert `GoldLoanCollateral`, `GoldOrnamentItem`, `LoanCollateral`, `Loan`, `BankRepledge`, `AccountEntry`, and `AuditLog`.
6. Test negative cases: zero weight, invalid purity, missing rate, excess LTV, release before closure.
7. Test repledge flow with bank name and status transitions.
8. Cross-check gold reports against DB aggregations.

## Manual verification still needed

Manual verification is needed for gold valuation business rules, pledge receipt layout, physical ornament entry usability, and gold release approval process.

## Acceptance criteria

- Gold valuation and LTV rules are accurate.
- Gold collateral is linked to the loan and cannot be released before closure.
- Repledge and servicing flows are auditable.
- Gold reports match DB totals.

## Suggested npm script

```json
"test:e2e-gold": "tsx tests/e2e-business/goldLoanAutomation.test.ts"
```
