# LoanTrack Automation Test Sketch — Borrower Portal, Self-Pay, Razorpay Webhook, NACH

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

Implement automated tests for borrower login, borrower loan visibility, self-pay link creation, payment success/failure webhooks, duplicate webhook idempotency, payment allocation, NACH mandate creation/cancellation/presentation, and borrower statement correctness.

## Source areas Codex should inspect first

- `app/api/v1/borrower/auth/login/route.ts`
- `app/api/v1/borrower/auth/logout/route.ts`
- `app/api/v1/borrower/auth/verify/route.ts`
- `app/api/v1/borrower/loans/route.ts`
- `app/api/v1/borrower/pay/route.ts`
- `app/api/v1/collection/self-pay/link/route.ts`
- `app/api/webhooks/razorpay/route.ts`
- `app/api/webhooks/razorpay/collections/route.ts`
- `app/api/webhooks/razorpay/nach/route.ts`
- `app/api/v1/nach/mandate/route.ts`
- `app/api/v1/nach/mandate/[id]/route.ts`
- `app/api/v1/nach/present/route.ts`
- `app/api/v1/nach/loan/[loanId]/route.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| PAY-001 | Borrower login | Borrower token/session created | API + DB |
| PAY-002 | Borrower sees only own loans | Other borrower/tenant loans excluded | API + DB |
| PAY-003 | Borrower statement | Balance and instalments match DB | API + DB |
| PAY-004 | Self-pay link create | Payment/link record created for correct loan/customer | API + DB |
| PAY-005 | Payment success webhook | CollectionEntry/Payment/PaymentAllocation created | Webhook + DB |
| PAY-006 | Payment failure webhook | Payment failure logged; loan unchanged | Webhook + DB |
| PAY-007 | Duplicate webhook | No double credit; WebhookEvent marks duplicate | Webhook + DB |
| PAY-008 | Invalid webhook signature | Rejected and no mutation | Webhook |
| PAY-009 | NACH mandate create | NachMandate row active/pending as expected | API + DB |
| PAY-010 | NACH mandate cancel | Mandate cannot be presented after cancel | API + DB |
| PAY-011 | NACH present eligible EMI | NachPresentation created once | API/Cron + DB |
| PAY-012 | NACH failed presentation | EMI remains unpaid and failure logged | Webhook/API + DB |

## Implementation sketch for Codex

1. Seed borrower/customer with active disbursed loan.
2. Implement borrower API client separate from staff API client.
3. For Razorpay tests, do not hit real Razorpay. Call local webhook route with fixture payloads and valid/invalid test signatures based on app implementation.
4. Assert `Payment`, `PaymentAllocation`, `CollectionEntry`, `WebhookEvent`, `Instalment`, `Loan`, and `AuditLog`.
5. Test duplicate webhook with the same event/payment ID.
6. For NACH, create mandate, present due EMI, simulate success/failure webhook if route exists, and assert balance.
7. Verify borrower cannot pay another borrower’s loan by changing IDs.
8. Keep live checkout UX as manual only.

## Manual verification still needed

Manually verify Razorpay checkout screen, real sandbox/live payment experience, NACH provider portal/bank mandate flow, SMS/email payment notifications, and borrower-facing receipt layout.

## Acceptance criteria

- Borrower portal is strictly scoped.
- Self-pay and webhook flows update loan balances exactly once.
- Duplicate/invalid webhook events are safe.
- NACH mandate and presentation flows are auditable and idempotent.

## Suggested npm script

```json
"test:e2e-payments-nach": "tsx tests/e2e-business/borrowerPaymentsNach.test.ts"
```
