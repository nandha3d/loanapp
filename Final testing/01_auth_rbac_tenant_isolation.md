# LoanTrack Automation Test Sketch — Authentication, RBAC, Branch Scope, Tenant Isolation

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

Implement automated tests proving that login, token handling, role permissions, branch scoping, app type scoping, module permissions, and tenant isolation cannot be bypassed.

## Source areas Codex should inspect first

- `app/api/v1/auth/login/route.ts`
- `app/api/v1/auth/me/route.ts`
- `app/api/v1/auth/refresh/route.ts`
- `app/api/v1/auth/logout/route.ts`
- `lib/api/v1-auth.ts`
- `lib/access.ts`
- `middleware.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| AUTH-001 | Admin login with valid username/password | Returns token, refresh token, active user, tenant slug | API + DB |
| AUTH-002 | Agent login with valid username/password | Returns token and role = agent | API + DB |
| AUTH-003 | Invalid password | Returns 401 and no token | API |
| AUTH-004 | Disabled user login | Returns 401/403 and no token | API + DB |
| AUTH-005 | Expired/invalid token on protected API | Returns 401 | API |
| AUTH-006 | Refresh token flow | Returns new usable access token | API |
| AUTH-007 | Logout | Refresh token/session cannot be reused | API + DB |
| AUTH-008 | Agent calls admin-only API | Returns 403 | API |
| AUTH-009 | Manager branch scope | Manager only sees own branch records | API + DB |
| AUTH-010 | Agent cannot read another branch customer by ID | Returns 403/404 | API + DB |
| AUTH-011 | Tenant A token cannot read Tenant B data by ID | Returns 403/404 and zero leakage | API + DB |
| AUTH-012 | Module disabled for branch/user | Menu/API access blocked | API + UI optional |
| AUTH-013 | Borrower token scope | Borrower sees only own loan/customer data | API + DB |

## Implementation sketch for Codex

1. Add a `seedAuthScenario()` helper that creates two tenants, two branches, admin, manager, two agents, and one borrower.
2. Use the existing `/api/v1/auth/login` route with `x-tenant-slug` header.
3. Build an API client helper that accepts a token and automatically sets `Authorization: Bearer <token>`.
4. Create protected resources under Tenant A and Tenant B.
5. Try legal and illegal reads/writes using different tokens.
6. Assert that forbidden access returns 401/403/404 and does not expose data in the response body.
7. Add direct DB assertions that no cross-tenant or cross-branch mutation happened.
8. Keep this suite fast; it should not use Playwright except optional menu visibility tests.

## Manual verification still needed

Manually verify the visible menus for each role once in the browser because UX/menu naming can change even if API permissions are correct.

## Acceptance criteria

- All protected APIs reject missing/invalid tokens.
- Agents cannot access admin/developer APIs.
- Branch and tenant isolation cannot be bypassed by changing URL IDs.
- Borrower cannot see any other customer or loan.
- Disabled users and expired tokens fail safely.
- Tests can be run repeatedly without data collision.

## Suggested npm script

```json
"test:e2e-auth-rbac": "tsx tests/e2e-business/authRbacTenantIsolation.test.ts"
```
