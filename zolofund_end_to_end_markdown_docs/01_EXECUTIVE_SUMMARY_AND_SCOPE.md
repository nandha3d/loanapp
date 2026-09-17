# Executive Summary and Scope

## 1. Product Summary

ZoloFund is a multi-application loan and collections management platform. The specification defines a shared database model with strict row-level isolation using `tenantId` and `appType`. The application is planned to support three business verticals:

1. **Micro Lending** — customer onboarding, route-wise field collection, daily instalments, penalties, reports.
2. **Auto Finance** — vehicle-backed loans, EMI tracking, repo/overdue flagging, document vault.
3. **Chit Funds** — chit groups, members, auctions, dividend calculation and subscription ledger.

The implementation in `loanapp.zip` currently focuses mainly on the **Micro Lending** flow, with early multi-app infrastructure already started.

---

## 2. Current Implementation Summary

The zip already contains a working Next.js application structure with:

| Area | Current Status |
|---|---|
| Framework | Next.js App Router with Server Actions |
| Auth | NextAuth credentials login with JWT session fields |
| ORM | Prisma schema using MySQL |
| Multi-tenancy | `tenantId` is present across major models |
| Multi-app | `appType` exists in key models and many queries |
| Customer management | Customer list, create/edit form, profile page, documents, cheques, guarantors |
| Loan management | Loan create, detail page, instalment generation, close loan |
| Collection | Agent/admin collection page and collection entry submission |
| Penalty | Penalty listing and settlement/waiver actions |
| Reports | Collection efficiency, aging, penalty, disbursement and agent performance |
| Settings | Routes, loan packages, users, system and penalty settings |
| Admin | Master user page and branch page |
| Approval | ApprovalRequest model and basic review actions |
| App selector | Portal for superadmin/developer app switching |
| Prototype | HTML prototype files are included |

---

## 3. Key Gaps Before Production-Grade Development

| Priority | Gap | Why It Matters |
|---|---|---|
| P0 | Build issue in `settings/page.tsx` | Application may fail TypeScript build |
| P0 | RBAC mismatch between middleware and page access matrix | Agent access and approval access do not fully match the target specification |
| P0 | Some app/tenant filters are incomplete | Cross-app or cross-role data leakage risk |
| P0 | `RouteAgent` exists in schema but is not fully used in collection queries | Shared route assignment requirement is not complete |
| P0 | Notifications do not have `appType` in schema | Cannot correctly filter notifications by application |
| P1 | API routes lack full `appType` and branch isolation | API can expose wider data than UI |
| P1 | Audit logging is partial | Required for traceability and regulatory-style control |
| P1 | File uploads are mocked by filename only | KYC/cheque/collateral uploads are not production-ready |
| P1 | Super Admin/Developer seed is missing | App selector/admin flows cannot be tested from seed alone |
| P2 | Auto Finance and Chit Fund modules are mostly future-phase | Data models/pages/workflows need implementation |

---

## 4. Target Development Outcome

At the end of the development and testing cycle, ZoloFund should support:

- Secure login with role and app context.
- Super Admin app switching across Micro Lending, Auto Finance and Chit Funds.
- Admin-level operational management within one assigned application and branch rules.
- Field Agent restricted experience focused on assigned/shared route collection.
- Customer onboarding with approval workflow for agent-created customers.
- Loan creation, instalment schedule generation, payments, penalties and closure.
- Route-based and app-based reporting.
- Complete audit logging for all critical mutations.
- Automated and manual test coverage for happy paths, negative paths and RBAC isolation.

---

## 5. Suggested Delivery Phases

| Phase | Name | Outcome |
|---|---|---|
| Phase 0 | Stabilize Build and Security | Fix build errors and close P0 isolation gaps |
| Phase 1 | Complete Micro Lending MVP | Customer, loan, collection, approval, reports and settings fully tested |
| Phase 2 | Shared Route and RBAC Hardening | RouteAgent-based collection and strict access matrix enforcement |
| Phase 3 | Production Readiness | Uploads, audit logs, seed users, database migration discipline |
| Phase 4 | Auto Finance | Vehicle-backed loan module and AF dashboards |
| Phase 5 | Chit Funds | Chit groups, members, auctions and subscription ledger |
| Phase 6 | End-to-End Testing and Release | Functional, security, regression, UAT and release checklist completed |
