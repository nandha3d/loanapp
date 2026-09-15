# ZoloFund Automation Test Sketch — Web UI Playwright E2E, Critical User Journeys

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

Implement a small but valuable Playwright suite for the most important browser journeys: admin/agent login, customer create, loan create/approve, collection, report view, and RBAC menu visibility.

## Source areas Codex should inspect first

- `playwright.config.ts`
- `e2e/example.spec.ts`
- `e2e/link-check.spec.ts`
- `app/(dashboard)/[module]/customers/page.tsx`
- `app/(dashboard)/[module]/customers/new/page.tsx`
- `app/(dashboard)/[module]/loans/page.tsx`
- `app/(dashboard)/[module]/loans/new/page.tsx`
- `app/(dashboard)/[module]/collection/page.tsx`
- `app/(dashboard)/[module]/approvals/page.tsx`
- `app/(dashboard)/[module]/reports/page.tsx`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| UI-001 | Admin login and dashboard load | Dashboard visible with expected module navigation | Playwright |
| UI-002 | Agent login and dashboard load | Agent dashboard visible; admin menus absent | Playwright |
| UI-003 | Create customer from web | Success message and customer visible in list | Playwright + DB optional |
| UI-004 | Create loan from web | Loan visible with expected status | Playwright + DB optional |
| UI-005 | Approve customer/loan | Status changes in approval list/detail | Playwright + DB optional |
| UI-006 | Record collection from web | Receipt/confirmation visible; balance changes | Playwright + API/DB optional |
| UI-007 | Open report page | Report loads with seeded row/total | Playwright |
| UI-008 | RBAC menu visibility | Agent cannot see users/settings/accounting admin menus | Playwright |
| UI-009 | Direct URL forbidden page | Agent direct navigation to admin page is blocked | Playwright |
| UI-010 | Mobile viewport smoke | Critical pages render without horizontal breakage | Playwright mobile viewport |

## Implementation sketch for Codex

1. Keep UI tests minimal. Do not duplicate all API business checks in Playwright.
2. Configure Playwright `baseURL` and `webServer` if missing for local test runs.
3. Create stable selectors using `data-testid`. Codex should add test IDs only where needed and avoid brittle text-only selectors.
4. Seed data before Playwright test using Node/Prisma helper or a setup project.
5. Use admin and agent storage state files to avoid repeated login in every test.
6. Prefer one full happy-path UI journey plus small role/menu tests.
7. For money correctness, call helper APIs/DB assertions after UI action, but keep deep money testing in API+DB suites.
8. Capture trace/video only on failure to keep test output manageable.

## Manual verification still needed

Manual UX verification is still required for page layout, form comfort, visual design, receipt formatting, mobile browser responsiveness, and business wording.

## Acceptance criteria

- Critical browser journeys work.
- Role-based menu restrictions are visible.
- UI tests use stable selectors and do not become the main source of business-rule validation.
- Playwright can run locally and in CI.

## Suggested npm script

```json
"test:e2e-ui-critical": "npx playwright test e2e/zolofund-critical-flow.spec.ts"
```
