# LoanTrack Automation Test Sketch — Reports, Exports, Dashboard Totals

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

Implement automated tests proving that all key report APIs and exports match the underlying DB transactions, respect filters, and do not leak tenant/branch data.

## Source areas Codex should inspect first

- `app/api/v1/reports/daily/route.ts`
- `app/api/v1/reports/agent/route.ts`
- `app/api/v1/reports/overdue/route.ts`
- `app/api/v1/reports/[slug]/route.ts`
- `app/api/v1/reports/[slug]/export/route.ts`
- `app/api/reports/route.ts`
- `app/api/reports/pdf/route.ts`
- `app/api/export/collections/route.ts`
- `app/api/export/loans/route.ts`
- `app/api/export/defaulters/route.ts`
- `app/api/v1/dashboard/route.ts`
- `app/api/dashboard/route.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| REP-001 | Daily collection report | Total collected equals CollectionEntry sum | API + DB |
| REP-002 | Agent-wise collection report | Agent totals match DB filtered by agent | API + DB |
| REP-003 | Loan register | Loan count/principal/status totals match DB | API + DB |
| REP-004 | Outstanding report | Outstanding equals instalment/loan balance calculation | API + DB |
| REP-005 | Overdue report | Only overdue loans included | API + DB |
| REP-006 | NPA report | NPA summary matches NpaHistory/Loan state | API + DB |
| REP-007 | Cash book report | Opening + inflows - outflows = closing | API + DB |
| REP-008 | Wallet/float report | Agent balances match WalletTransaction/AgentAccount | API + DB |
| REP-009 | Gold report | Gold collateral/pledge totals match DB | API + DB |
| REP-010 | Dashboard KPI | Dashboard numbers match seeded data | API + DB |
| REP-011 | Date filter | Only records within range included | API + DB |
| REP-012 | Branch filter | Only branch records included | API + DB |
| REP-013 | Agent filter | Only agent records included | API + DB |
| REP-014 | Tenant isolation | Tenant B data never appears | API + DB |
| REP-015 | Excel/CSV/PDF export status | Download returns correct content type/non-empty body | API |

## Implementation sketch for Codex

1. Seed a complete known scenario with two tenants, two branches, two agents, loans, disbursements, collections, overdue loans, wallet handover, and one gold loan.
2. Build DB aggregation helpers for each report. The test should compute expected values directly from DB, not from another report API.
3. Call each report API and compare totals, counts, and key rows.
4. Test filters individually and combined: date + branch + agent + status.
5. Test exports by checking HTTP status, content type, non-empty body, and basic file parse if easy. Do not pixel-test PDF.
6. Add negative tests for forbidden role/branch/tenant access.
7. Add a dashboard KPI test using the same seeded scenario.
8. Avoid broad production-like volumes here; performance testing can be separate.

## Manual verification still needed

Manually verify report column labels, Excel readability, PDF visual formatting, and whether finance/business users accept the report grouping.

## Acceptance criteria

- Report totals are mathematically tied to DB records.
- Filters work correctly and consistently.
- Exports are generated and scoped correctly.
- Reports do not leak other branch/tenant data.

## Suggested npm script

```json
"test:e2e-reports": "tsx tests/e2e-business/reportsExports.test.ts"
```
