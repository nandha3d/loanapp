# Release Readiness Checklist

## 1. Build Readiness

| Check | Status |
|---|---|
| `.env` configured for target environment | ☐ |
| `npm install` successful | ☐ |
| `npx prisma validate` successful | ☐ |
| `npm run lint` successful | ☐ |
| `npm run build` successful | ☐ |
| No TypeScript errors | ☐ |
| No runtime error in settings page | ☐ |
| No console errors in key journeys | ☐ |

---

## 2. Database Readiness

| Check | Status |
|---|---|
| Database backup taken | ☐ |
| Prisma migrations prepared | ☐ |
| Migration tested in QA | ☐ |
| Seed not using production demo passwords | ☐ |
| Required indexes created | ☐ |
| Notification `appType` migration applied | ☐ |
| RouteAgent migration verified | ☐ |
| AuditLog table verified | ☐ |

---

## 3. Security Readiness

| Check | Status |
|---|---|
| All routes require authentication except login/auth | ☐ |
| Middleware matches RBAC matrix | ☐ |
| Server actions validate session and role | ☐ |
| APIs validate session and role | ☐ |
| All major queries include tenantId and appType | ☐ |
| Branch restriction applied for ML admins | ☐ |
| Agent route restriction applied | ☐ |
| Form-provided appType/tenantId ignored | ☐ |
| Unsafe approval fields blocked | ☐ |
| File upload validation enabled | ☐ |
| Password policy implemented | ☐ |

---

## 4. Functional Readiness

| Area | Status |
|---|---|
| Login | ☐ |
| App selector | ☐ |
| Dashboard | ☐ |
| Customer create/edit/profile | ☐ |
| Agent pending customer flow | ☐ |
| Customer approval flow | ☐ |
| Loan create/detail | ☐ |
| Instalment payment | ☐ |
| Collection page | ☐ |
| Shared route collection | ☐ |
| Penalty settle/waive | ☐ |
| Reports | ☐ |
| Settings | ☐ |
| Admin users | ☐ |
| Branches | ☐ |
| Notifications | ☐ |

---

## 5. Test Readiness

| Check | Status |
|---|---|
| Functional test cases executed | ☐ |
| RBAC/security test cases executed | ☐ |
| API security tests executed | ☐ |
| E2E UAT scripts executed | ☐ |
| Regression testing completed | ☐ |
| Test evidence captured | ☐ |
| P0 defects closed | ☐ |
| P1 defects closed or accepted with sign-off | ☐ |

---

## 6. Data and Configuration Readiness

| Check | Status |
|---|---|
| App settings verified | ☐ |
| Currency and timezone verified | ☐ |
| Customer and loan prefixes verified | ☐ |
| Penalty settings verified | ☐ |
| Routes configured | ☐ |
| Loan packages configured | ☐ |
| Users and roles configured | ☐ |
| Branches configured | ☐ |

---

## 7. Deployment Readiness

| Check | Status |
|---|---|
| Hosting environment ready | ☐ |
| Environment variables configured | ☐ |
| Database reachable from app | ☐ |
| Build artifact generated | ☐ |
| Migration runbook ready | ☐ |
| Rollback plan ready | ☐ |
| Smoke test checklist ready | ☐ |
| Monitoring/logging enabled | ☐ |

---

## 8. Post-Deployment Smoke Test

| Step | Expected Result | Status |
|---|---|---|
| Open login page | Page loads | ☐ |
| Admin login | Dashboard opens | ☐ |
| Agent login | Collection opens | ☐ |
| Create customer | Customer created | ☐ |
| Create loan | Loan and instalments created | ☐ |
| Submit collection | Totals update | ☐ |
| Open reports | Data loads | ☐ |
| Agent opens restricted page | Redirected | ☐ |
| Superadmin switches app | Data scoped | ☐ |

---

## 9. Go/No-Go Decision

| Area | Decision |
|---|---|
| Build | Go / No-Go |
| Database | Go / No-Go |
| Security | Go / No-Go |
| Functional | Go / No-Go |
| UAT | Go / No-Go |
| Production Support | Go / No-Go |

Final decision:

```text
Approved for release: Yes / No
Approved by:
Date:
Remarks:
```
