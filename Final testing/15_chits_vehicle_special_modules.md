# LoanTrack Automation Test Sketch — Chits, Vehicle/Product Finance, Optional Special Modules

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

Implement automation for optional modules that are visible in the source: chits, vehicle/product finance, product repossession/release, module enablement, and branch-specific feature access. Run this after core lending is stable.

## Source areas Codex should inspect first

- `app/api/v1/chits/route.ts`
- `app/api/v1/chits/[id]/route.ts`
- `app/api/v1/chits/[id]/members/route.ts`
- `app/api/v1/chits/[id]/auctions/route.ts`
- `app/api/v1/chits/[id]/payments/route.ts`
- `app/api/v1/chits/[id]/subscriptions/route.ts`
- `app/api/v1/chits/subscriptions/[id]/miss/route.ts`
- `app/api/v1/chits/[id]/cancel/route.ts`
- `app/api/v1/vehicles/route.ts`
- `app/api/v1/vehicles/[id]/route.ts`
- `app/api/v1/loans/[id]/product-repossession/route.ts`
- `app/api/v1/loans/[id]/property-release/route.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| CHIT-001 | Create chit group | ChitGroup saved with tenant/branch scope | API + DB |
| CHIT-002 | Add chit members | ChitMember rows linked correctly | API + DB |
| CHIT-003 | Create chit subscriptions | ChitSubscription schedule created | API + DB |
| CHIT-004 | Create auction | ChitAuction row and winner/state correct | API + DB |
| CHIT-005 | Record chit payment | Payment/subscription status updated | API + DB |
| CHIT-006 | Mark missed chit payment | Missed status/penalty if applicable | API + DB |
| CHIT-007 | Cancel chit group | Group cancelled and future operations blocked | API + DB |
| VEH-001 | Create vehicle/product finance record | Vehicle/ProductFinanceItem linked to loan/customer | API + DB |
| VEH-002 | Repossession flow | Loan/product status updated and audit logged | API + DB |
| VEH-003 | Property/product release | Release blocked before closure, allowed after closure | API + DB |
| MOD-001 | Module disabled branch access | Chit/vehicle endpoints blocked or hidden when module disabled | API/UI optional |
| MOD-002 | Module enabled branch access | Authorized role can access module | API/UI optional |

## Implementation sketch for Codex

1. Treat chits and vehicle/product finance as P1/P2 unless the business actively uses them.
2. Seed module-enabled and module-disabled branches.
3. For chits, implement a full group lifecycle: create group -> add members -> subscriptions -> auction -> payment -> missed payment -> cancel.
4. For vehicle/product finance, create customer + loan + vehicle/product item, then test repossession and release rules.
5. Assert branch/tenant scoping for all optional module APIs.
6. Assert DB rows in `ChitGroup`, `ChitMember`, `ChitAuction`, `ChitSubscription`, `Vehicle`, `ProductFinanceItem`, `LoanCollateral`, `AuditLog`, and any payment/ledger rows.
7. Keep accounting assertions lighter here unless module directly moves money; detailed money checks live in collection/disbursement suites.
8. Add scripts but do not include these in P0 CI until stable.

## Manual verification still needed

Manual verification is needed for chit business rules, auction terminology, vehicle/product detail form usability, repossession/legal workflow, and module navigation.

## Acceptance criteria

- Optional modules work only when enabled.
- Chit and vehicle/product records are correctly linked and scoped.
- Lifecycle state transitions are protected and auditable.
- These tests do not block the core lending P0 pipeline unless the modules are actively sold.

## Suggested npm script

```json
"test:e2e-special-modules": "tsx tests/e2e-business/chitsVehicleSpecialModules.test.ts"
```
