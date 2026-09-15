# ZoloFund Automation Test Sketch — Wallet, Agent Float, Cash Handover, Cash Book

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

Implement automated tests for releasing float to agents, collecting cash into agent wallet, handover request/approval/rejection, branch cash movement, wallet ledger, and cash book balancing.

## Source areas Codex should inspect first

- `app/api/v1/wallet/release/route.ts`
- `app/api/v1/wallet/deposit/route.ts`
- `app/api/v1/wallet/me/route.ts`
- `app/api/v1/wallet/branch/route.ts`
- `app/api/v1/collection/handover/route.ts`
- `lib/wallet.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| WALLET-001 | Admin releases float to agent | AgentAccount increases; BranchCashAccount reduces | API + DB |
| WALLET-002 | Agent cannot release float | Returns 403 | API |
| WALLET-003 | Invalid/negative float amount | Rejected and DB unchanged | API + DB |
| WALLET-004 | Cash collection increases agent cash | WalletTransaction recorded | API + DB |
| WALLET-005 | Agent creates handover request | CashHandover status pending | API + DB |
| WALLET-006 | Admin approves handover | AgentAccount reduces; BranchCashAccount increases | API + DB |
| WALLET-007 | Admin rejects handover | No cash movement; status rejected | API + DB |
| WALLET-008 | Partial handover | Remaining agent balance correct | API + DB |
| WALLET-009 | Agent cannot see another agent wallet | Returns 403/empty | API |
| WALLET-010 | Branch cash book balance | Opening + inflow - outflow = closing balance | API + DB |
| WALLET-011 | Duplicate approval blocked | No double movement | API + DB |
| WALLET-012 | Audit logs for release/handover | AuditLog rows exist | DB |

## Implementation sketch for Codex

1. Seed branch opening cash = 100000, agent balance = 0.
2. Call `/api/v1/wallet/release` using admin token and body `{ agentId, amount, note }`.
3. Call collection flow to create agent cash balance.
4. Call the handover API after inspecting the exact route body.
5. Implement exact balance assertions before and after every wallet operation.
6. Assert `AgentAccount`, `BranchCashAccount`, `WalletTransaction`, `CashHandover`, `AccountEntry`, and `AuditLog`.
7. Add conflict tests for duplicate handover approval/rejection.
8. Add branch/tenant isolation checks for wallet lists and branch cash APIs.

## Manual verification still needed

Manually verify cash handover screen wording, admin approval UX, cash book readability, and whether physical cash process matches field operations.

## Acceptance criteria

- Float release and handover move cash exactly once.
- Rejection does not move cash.
- Cash book matches wallet and branch cash records.
- Agents cannot access other agents’ wallet details.
- All cash operations are auditable.

## Suggested npm script

```json
"test:e2e-wallet": "tsx tests/e2e-business/walletFloatCashHandover.test.ts"
```
