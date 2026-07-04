# LoanTrack Automation Test Sketch — Loan Package, Loan Creation, EMI Schedule, Approval

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

Implement automated tests for package setup, loan calculation, loan creation by admin/agent, approval/rejection, instalment schedule generation, statement/timeline, and post-approval edit restrictions.

## Source areas Codex should inspect first

- `app/api/v1/packages/route.ts`
- `app/api/v1/packages/[id]/route.ts`
- `app/api/v1/loans/calculate/route.ts`
- `app/api/v1/loans/route.ts`
- `app/api/v1/loans/[id]/route.ts`
- `app/api/v1/loans/[id]/instalments/route.ts`
- `app/api/v1/loans/[id]/statement/route.ts`
- `app/api/v1/loans/[id]/timeline/route.ts`
- `lib/loanPolicy.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| LOAN-001 | Create loan package | LoanPackage saved with expected interest/tenure/frequency | API + DB |
| LOAN-002 | Edit loan package | Allowed fields update correctly | API + DB |
| LOAN-003 | Calculate daily loan schedule | Expected instalment count, due dates, total payable | Unit/API |
| LOAN-004 | Calculate weekly loan schedule | Expected due dates and totals | Unit/API |
| LOAN-005 | Calculate monthly EMI schedule | Expected EMI/rounding/last instalment adjustment | Unit/API |
| LOAN-006 | Create loan for approved customer | Loan row and instalments created | API + DB |
| LOAN-007 | Cannot create loan for rejected/unapproved customer | Fails and no Loan row created | API + DB |
| LOAN-008 | Agent-created loan goes to approval | Loan status pending/review and approval request exists | API + DB |
| LOAN-009 | Admin approves loan | Loan becomes approved/active based on app status rules | API + DB |
| LOAN-010 | Admin rejects loan | Loan not collectible/disbursable | API + DB |
| LOAN-011 | Loan statement correctness | Principal, interest, paid, balance, next due correct | API + DB |
| LOAN-012 | Loan timeline correctness | Creation/approval/status events present | API + DB |
| LOAN-013 | Agent cannot approve own loan | Returns 403 | API |
| LOAN-014 | Post-approval restricted edit | Sensitive fields unchanged | API + DB |

## Implementation sketch for Codex

1. Create deterministic loan package fixtures for daily, weekly, and monthly loans.
2. For calculation tests, assert exact numeric values with a helper that normalizes paise/rupees and rounding.
3. For loan creation tests, seed an approved customer and an unapproved customer.
4. Use admin token and agent token to verify different workflows.
5. Use DB assertions for `LoanPackage`, `Loan`, `Instalment`, `ApprovalRequest`, and `AuditLog`.
6. Test schedule edge cases: month-end start date, leap year date, odd principal amount, last EMI rounding.
7. Confirm loan detail/statement/timeline APIs read back the same values as DB.
8. Keep disbursement out of this file; it belongs in the disbursement ledger suite.

## Manual verification still needed

Manually verify loan creation form labels, field order, calculation preview clarity, approval page usability, and statement readability.

## Acceptance criteria

- Loan package and calculation APIs are deterministic.
- Loan creation creates the right number of instalments.
- Agent and admin loan flows follow approval rules.
- Statement and timeline reflect the saved DB state.
- Restricted loan fields cannot be changed after approval.

## Suggested npm script

```json
"test:e2e-loans": "tsx tests/e2e-business/loanPackageCreationApproval.test.ts"
```
