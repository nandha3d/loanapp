# LoanTrack Automation Test Sketch — Collection, Repayment Allocation, Receipt

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

Implement automated tests for EMI/collection submission, allocation across instalments, partial/advance/overpayment handling, receipt generation, GPS capture metadata, wallet effect, idempotency, and loan statement updates.

## Source areas Codex should inspect first

- `app/api/v1/collection/collect/route.ts`
- `app/api/v1/collection/entry/route.ts`
- `app/api/v1/collection/confirm/route.ts`
- `app/api/v1/receipts/[entryId]/route.ts`
- `app/api/v1/loans/[id]/statement/route.ts`
- `lib/collectionWrite.ts`
- `lib/schemas/collectionEntry.ts`
- `scripts/collectionSharedService.test.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| COLL-001 | Full EMI collection | Oldest open instalment paid; loan balance reduced | API + DB |
| COLL-002 | Partial EMI collection | Instalment partial; remaining due correct | API + DB |
| COLL-003 | Advance payment | Future instalments allocated oldest-first as per rule | API + DB |
| COLL-004 | Overpayment | Rejected or excess handled as per business rule without data corruption | API + DB |
| COLL-005 | Cash collection wallet impact | AgentAccount/WalletTransaction increases | API + DB |
| COLL-006 | UPI/bank payment mode | Payment mode stored and ledger route correct | API + DB |
| COLL-007 | Duplicate idempotency key | No double CollectionEntry/PaymentAllocation | API + DB |
| COLL-008 | Failed collection rollback | No balance or instalment mutation | API + DB |
| COLL-009 | Backdated collection | Accepted/rejected based on business rule | API + DB |
| COLL-010 | GPS capture included | GPS metadata saved when tracking enabled | API + DB |
| COLL-011 | Receipt API | Receipt shows amount, customer, loan, date, mode, receipt no | API |
| COLL-012 | Statement after collection | Paid/balance values match DB | API + DB |
| COLL-013 | Collection audit log | Actor and amount saved | DB |

## Implementation sketch for Codex

1. Seed an active/disbursed loan with 3+ instalments and an agent token.
2. Use `/api/v1/collection/collect` because the route documents body `{ loanId, amount, paymentMode, remarks?, collectionDate?, idempotencyKey?, gps... }`.
3. Test cash and non-cash payment modes separately.
4. For each collection, assert `CollectionEntry`, `DailyCollection` if used, `Instalment`, `Loan`, `WalletTransaction`, `PaymentAllocation` if used, and `AuditLog`.
5. Use unique idempotency keys and repeat a request with the same key to prove no double-credit.
6. Add helper `assertLoanStatementMatchesDb(loanId)`.
7. Add helper `assertInstalmentAllocation(loanId, expectedSchedule)`.
8. Receipt test should validate data fields, not pixel-perfect PDF layout.

## Manual verification still needed

Manually verify receipt visual layout, print/download experience, collection screen usability, and real device GPS permission behaviour.

## Acceptance criteria

- Collection allocation is correct for full, partial, advance, and duplicate cases.
- Loan, instalment, wallet, and receipt data stay consistent.
- Duplicate API calls cannot double-credit money.
- Collection statement and receipt match the DB.

## Suggested npm script

```json
"test:e2e-collection": "tsx tests/e2e-business/collectionRepaymentReceipt.test.ts"
```
