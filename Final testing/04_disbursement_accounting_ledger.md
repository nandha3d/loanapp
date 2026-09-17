# ZoloFund Automation Test Sketch — Disbursement, Accounting Ledger, Branch Cash

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

Implement automated tests proving that disbursement correctly updates loan outstanding, branch cash/bank balance, agent float when applicable, account entries, and audit logs without duplicate disbursement.

## Source areas Codex should inspect first

- `app/api/v1/loans/route.ts`
- `app/api/v1/loans/[id]/route.ts`
- `lib/wallet.ts`
- `app/(dashboard)/[module]/accounting/actions.ts`
- `app/api/v1/accounting/route.ts`
- `app/api/v1/accounting/journal/route.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| DISB-001 | Cash disbursement from branch | BranchCashAccount reduces by disbursed amount | API + DB |
| DISB-002 | Loan outstanding after disbursement | Loan principal/outstanding set correctly | API + DB |
| DISB-003 | Account entry created | Debit/credit rows or AccountEntry saved correctly | API + DB |
| DISB-004 | Bank disbursement if supported | BankAccount/account ledger reduces correctly | API + DB |
| DISB-005 | Agent float disbursement if supported | Agent balance affected only when configured | API + DB |
| DISB-006 | Wrong branch unaffected | Only loan branch balance changes | DB assertion |
| DISB-007 | Duplicate disbursement blocked | Second call returns conflict and no double ledger | API + DB |
| DISB-008 | Failed disbursement rollback | No partial Loan/AccountEntry/WalletTransaction remains | API + DB |
| DISB-009 | Disbursement reversal if supported | Reversal ledger balances exactly offset original | API + DB |
| DISB-010 | Disbursement audit log | AuditLog contains actor, entity, amount | DB |

## Implementation sketch for Codex

1. Seed branch opening cash = 100000 and approved loan principal = 10000.
2. Identify the actual disbursement path in the current code. If disbursement happens inside loan create/approve, isolate that flow and assert it there. If there is a dedicated route/action, call it directly.
3. Implement `assertLedgerBalanced()` helper: total debits must equal total credits if double-entry models are used.
4. Implement `assertBranchCashDelta(branchId, before, after, -amount)`.
5. Verify `Loan`, `BranchCashAccount`, `AccountEntry`, `WalletTransaction` if used, and `AuditLog`.
6. Force a failure with invalid loan/insufficient branch cash and assert database rollback.
7. Add an idempotency/duplicate call test to avoid accidental double-disbursement.
8. Add report cross-check only for disbursement total; full report testing goes in reports suite.

## Manual verification still needed

Manual accounting sign-off is required for debit/credit naming, cash book presentation, and whether the ledger terminology matches finance expectations.

## Acceptance criteria

- Disbursement cannot create unbalanced accounting data.
- Branch cash/bank cash is reduced exactly once.
- Loan outstanding is correct.
- Duplicate/failed disbursement leaves no incorrect money movement.
- Audit log exists for every disbursement/reversal.

## Suggested npm script

```json
"test:e2e-disbursement": "tsx tests/e2e-business/disbursementAccountingLedger.test.ts"
```
