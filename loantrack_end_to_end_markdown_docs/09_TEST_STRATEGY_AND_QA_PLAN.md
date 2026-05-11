# Test Strategy and QA Plan

## 1. Testing Objectives

The objective is to validate LoanTrack from local development through release readiness:

- Application builds successfully.
- Core Micro Lending workflow works end-to-end.
- Role-based access is enforced.
- Tenant/app/branch/route isolation is not bypassable.
- Collections and loan ledgers calculate correctly.
- Audit logs are generated for critical changes.
- Negative/security tests pass before production.

---

## 2. Test Levels

| Level | Purpose | Owner |
|---|---|---|
| Static checks | TypeScript, lint, Prisma validation | Developer |
| Unit tests | Utility functions and calculation rules | Developer |
| Integration tests | Server actions, DB mutations, API routes | Developer/QA |
| Functional tests | Module-level behavior | QA/Product |
| RBAC/security tests | Unauthorized access and isolation | QA/Security |
| E2E tests | End-to-end role journeys | QA/Automation |
| UAT | Business validation | Product/Admin/Agent users |
| Regression | Ensure no previous flow breaks | QA |

---

## 3. Test Environment

### Local Dev

- Developer machine.
- MySQL local database.
- Seed data.

### QA/UAT

- Separate MySQL database.
- Production-like `.env`.
- Seed + controlled test data.
- Test users for all roles.

### Production

- No demo passwords.
- Real users only.
- Database backup enabled.
- Monitoring/logging enabled.

---

## 4. Entry Criteria for QA

QA should start only when:

- `npm install` completes.
- `npx prisma validate` passes.
- `npm run build` passes.
- Seed users exist for developer, superadmin, admin and agent.
- P0 security fixes are completed.
- Known environment variables are documented.

---

## 5. Exit Criteria for MVP UAT

MVP UAT can be signed off when:

- Admin can create route, agent, customer, loan.
- Agent can create pending customer.
- Admin can approve agent customer.
- Agent can collect assigned/shared route instalment.
- Loan and instalment totals update correctly.
- Reports show correct totals.
- Unauthorized pages are blocked.
- App isolation tests pass.
- No P0/P1 defects are open.

---

## 6. Recommended Test Data

| Data | Example |
|---|---|
| Tenant | Default tenant |
| Branch A | Head Office / Erode |
| Branch B | Bhavani Branch |
| Admin A | `admin` |
| Admin B | `admin_b` |
| Agent A | `karthik` |
| Agent B | `agent_b` |
| Route 1 | Erode |
| Route 2 | Bhavani |
| Customer 1 | Active customer in Route 1 |
| Customer 2 | Pending customer created by Agent A |
| Loan 1 | Daily loan with 5 instalments for quick testing |
| Loan 2 | Overdue loan |

---

## 7. Build and Static Verification

Run:

```bash
npx prisma validate
npm run lint
npm run build
```

Expected result:

- No Prisma validation errors.
- No lint errors.
- Production build succeeds.

---

## 8. Unit Test Areas

| Area | Test Cases |
|---|---|
| Date calculation | Daily, weekly, monthly instalment dates |
| End date calculation | Tenure-based end date |
| Currency formatting | INR formatting with decimals/string/Decimal |
| Pagination | Page, limit, skip, hasNext, hasPrev |
| Badge class | Known statuses and fallback status |
| Code generation | Prefix and padded counters |

---

## 9. Integration Test Areas

| Action/API | Test Focus |
|---|---|
| `saveCustomer` | Admin create active, agent create pending, agent edit blocked |
| `requestCustomerEdit` | Creates pending approval request |
| `reviewRequest` | Applies safe changes only and logs review |
| `createLoan` | Creates loan and instalments with correct scope |
| `submitCollectionEntry` | Updates collection, instalment, loan and audit |
| `markInstalmentPaid` | Admin payment from loan detail |
| `settleLoanPenalty` | Penalty amount/status update |
| `deleteRoute` | Ownership validation before delete |
| API customers | Role and app-scoped response |
| API loans | Agent blocked, admin scoped |

---

## 10. E2E Automation Recommendation

Use Playwright.

Install:

```bash
npm install -D @playwright/test
npx playwright install
```

Add script:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

Minimum E2E journeys:

1. Admin login → create customer → create loan.
2. Agent login → collection entry.
3. Agent cannot access admin-only pages.
4. Superadmin login → app switch → dashboard scoped data.
5. Agent creates customer → admin approves.
6. Shared route assignment → two agents collect same route.

---

## 11. Defect Severity

| Severity | Definition | Example |
|---|---|---|
| Blocker | Cannot build/login/use core app | `settings/page.tsx` build failure |
| Critical | Data leakage/security issue | Agent sees all customers |
| High | Core workflow broken | Collection does not update loan totals |
| Medium | Feature issue with workaround | Report filter incorrect |
| Low | Cosmetic/text issue | Label mismatch |

---

## 12. Regression Scope

Run regression after every RBAC/security change:

- Login redirects.
- Dashboard loads for admin.
- Customer create/list/detail.
- Loan create/detail/payment.
- Collection page and submit.
- Penalty page and actions.
- Reports.
- Settings create/delete route/package.
- Admin users.
- Notifications.
- App selector.

---

## 13. UAT Sign-Off Template

| Area | Business Owner | Status | Remarks |
|---|---|---|---|
| Login and roles |  | Pass/Fail |  |
| Customer onboarding |  | Pass/Fail |  |
| Loan creation |  | Pass/Fail |  |
| Field collection |  | Pass/Fail |  |
| Penalty handling |  | Pass/Fail |  |
| Reports |  | Pass/Fail |  |
| Settings |  | Pass/Fail |  |
| Approval workflow |  | Pass/Fail |  |
| RBAC/security |  | Pass/Fail |  |
| Final sign-off |  | Approved/Rejected |  |
