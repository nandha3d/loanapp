# Accounting Module — Playwright E2E Test Suite

## Test File Map

| File | Area | Tests |
|------|------|-------|
| `01-navigation.spec.ts` | Nav bar, auth guards | 9 |
| `02-coa.spec.ts` | Chart of Accounts CRUD | 16 |
| `03-journal.spec.ts` | Journal Entries — create / post / draft / reverse / approve / reject | 22 |
| `04-vendors.spec.ts` | Vendors, Bills, Payments, Ageing | 18 |
| `05-approvals.spec.ts` | Approval workflow — L1 / L2 / reject | 12 |
| `06-period-lock.spec.ts` | Periods — lock / unlock / close / reopen | 14 |
| `07-reports.spec.ts` | P&L, Balance Sheet, Trial Balance, Cash Flow, Export, Tax, Budget, Bank Rec | 28 |
| `08-settings.spec.ts` | Accounting Settings — tabs, toggles, save | 13 |
| `09-dashboard.spec.ts` | Overview / Dashboard — KPIs, chart, nav | 12 |
| `10-edge-cases.spec.ts` | Boundary conditions, race conditions, UI behaviours | 16 |
| `role-admin.spec.ts` | Admin role restrictions vs. superadmin | 8 |

**Total: ~168 test cases**

---

## Setup

### 1. Install Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Create auth directory

```bash
mkdir -p playwright/.auth
```

### 3. Configure environment

Create `.env.test` (or export in shell):

```env
BASE_URL=http://localhost:3000
TEST_MODULE=demo          # tenant slug in the URL (/demo/accounting/...)
SUPERADMIN_EMAIL=superadmin@your-tenant.com
SUPERADMIN_PASS=YourPassword123!
ADMIN_EMAIL=admin@your-tenant.com
ADMIN_PASS=YourPassword123!
```

### 4. Prerequisites

Before running tests, ensure:
- App is running at `BASE_URL`
- Database is seeded (`npm run db:seed`)
- Premium accounting is enabled for the test tenant
- At least two users exist: one `superadmin`, one `admin` role

---

## Running Tests

```bash
# All accounting tests (superadmin)
npx playwright test tests/e2e/accounting --project=accounting-superadmin

# Admin role tests
npx playwright test tests/e2e/accounting/role-admin.spec.ts --project=accounting-admin

# Single test file
npx playwright test tests/e2e/accounting/02-coa.spec.ts

# With UI (headed)
npx playwright test tests/e2e/accounting --headed

# Debug a failing test
npx playwright test tests/e2e/accounting/03-journal.spec.ts --debug

# View HTML report after run
npx playwright show-report
```

---

## Test Design Notes

### Ordering matters
Tests run serially (`workers: 1` in config). Each file builds on state:
- File `02` seeds CoA → `03` needs accounts → `04` needs vendors.
- File `06` locks/closes a period → `10` tests locked-period JE blocking.

### Account codes used
- `9xxx` range reserved for E2E test accounts (`TEST_CODE` = `9{last3digits of Date.now()}`).
- Default CoA must be seeded via Reseed button (or test will `test.skip`).

### Env-dependent skips
Tests that require pre-existing data (vendors, posted JEs, locked periods) call `test.skip()` gracefully when data is absent rather than failing. Re-run after the creating test runs first.

### Role cap values (defaults from schema)
- `adminJeCap`: 50,000 — JE over this → `pending_approval`
- `adminBillCap`: 1,00,000 — Bill over this → `pending_approval`
- `twoLevelApprovalThreshold`: 5,00,000 — L1 approval routes to L2

### GSTIN test value
`27AAPFU0939F1ZV` — Maharashtra (state code 27), matches the server-side regex.

### Period date isolation
The FY used in tests is the current FY. If tests lock April of the current FY, subsequent tests targeting that month will hit `period_locked`. Running tests in a fresh QA database avoids cross-test pollution.
