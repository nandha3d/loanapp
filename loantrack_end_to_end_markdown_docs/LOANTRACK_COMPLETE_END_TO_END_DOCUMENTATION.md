---

<!-- Source file: 00_DOCUMENTATION_INDEX.md -->

# LoanTrack — End-to-End Development & Testing Documentation Pack

**Prepared date:** 11 May 2026  
**Input 1:** `SYSTEM_SPECIFICATION.md` — product idea and target specification  
**Input 2:** `loanapp.zip` — inspected implementation source code  
**Output:** Developer-ready markdown documentation from current implementation to tested release.

---

## Document Map

| # | Document | Purpose |
|---|---|---|
| 00 | `00_DOCUMENTATION_INDEX.md` | Navigation index for the documentation pack |
| 01 | `01_EXECUTIVE_SUMMARY_AND_SCOPE.md` | One-page summary, product scope, current state, target state |
| 02 | `02_CURRENT_IMPLEMENTATION_AUDIT.md` | Detailed review of what is already implemented in the zip and what is pending |
| 03 | `03_SYSTEM_ARCHITECTURE_AND_DATA_MODEL.md` | Architecture, folder structure, database model, tenancy and app isolation |
| 04 | `04_RBAC_SECURITY_AND_ISOLATION_REQUIREMENTS.md` | Role access, permission rules, security fixes, isolation checklist |
| 05 | `05_CORE_WORKFLOWS_AND_FUNCTIONAL_REQUIREMENTS.md` | Customer, loan, collection, approval, settings, notification workflows |
| 06 | `06_DEVELOPMENT_BACKLOG_AND_IMPLEMENTATION_TICKETS.md` | Phase-wise development tickets with priority and acceptance criteria |
| 07 | `07_SETUP_LOCAL_DEVELOPMENT_AND_ENVIRONMENT.md` | Local setup, environment variables, database commands, seed data |
| 08 | `08_CODE_FIX_GUIDE_AND_RECOMMENDED_PATCHES.md` | Exact technical fix guide for current high-priority gaps |
| 09 | `09_TEST_STRATEGY_AND_QA_PLAN.md` | Testing approach from developer testing to UAT and release testing |
| 10 | `10_FUNCTIONAL_TEST_CASES.md` | Functional test cases by module |
| 11 | `11_SECURITY_AND_RBAC_TEST_CASES.md` | Negative tests, app isolation tests, role-based tests |
| 12 | `12_E2E_UAT_SCRIPTS.md` | End-to-end test scripts for Admin, Agent, Super Admin, app switching |
| 13 | `13_RELEASE_READINESS_CHECKLIST.md` | Build, migration, test, deployment and production readiness checklist |
| 14 | `14_CODEX_IMPLEMENTATION_PROMPT.md` | Ready-to-use Codex/AI coding prompt to implement and test remaining work |

---

## Recommended Usage Order

1. Read `01_EXECUTIVE_SUMMARY_AND_SCOPE.md` for the product goal.
2. Read `02_CURRENT_IMPLEMENTATION_AUDIT.md` to understand the current zip implementation.
3. Fix issues in `08_CODE_FIX_GUIDE_AND_RECOMMENDED_PATCHES.md` first.
4. Execute the backlog in `06_DEVELOPMENT_BACKLOG_AND_IMPLEMENTATION_TICKETS.md`.
5. Use `09` to `12` for complete testing.
6. Use `13_RELEASE_READINESS_CHECKLIST.md` before deployment.

---

## Important Immediate Finding

The project has a likely build-blocking issue in:

```text
app/(dashboard)/settings/page.tsx
```

`userRole` is referenced before being declared. This should be fixed before running a production build.

Required fix:

```ts
const session = await auth();
const userRole = (session?.user as any)?.role;
```


---

<!-- Source file: 01_EXECUTIVE_SUMMARY_AND_SCOPE.md -->

# Executive Summary and Scope

## 1. Product Summary

LoanTrack is a multi-application loan and collections management platform. The specification defines a shared database model with strict row-level isolation using `tenantId` and `appType`. The application is planned to support three business verticals:

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

At the end of the development and testing cycle, LoanTrack should support:

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


---

<!-- Source file: 02_CURRENT_IMPLEMENTATION_AUDIT.md -->

# Current Implementation Audit

## 1. Reviewed Source

The implementation zip contains a Next.js project named `loantrack`. The important directories/files are:

```text
app/
  (dashboard)/
    approvals/
    collection/
    customers/
    dashboard/
    loans/
    notifications/
    penalties/
    reports/
    settings/
  admin/
  api/
  login/
  portal/
components/
lib/
prisma/
prototype/
middleware.ts
package.json
SYSTEM_SPECIFICATION.md
```

---

## 2. Technology Stack Found in Code

| Layer | Implementation Found |
|---|---|
| Frontend/backend framework | Next.js `16.2.6` with App Router |
| React | React `19.2.4` |
| ORM | Prisma `5.22.0` |
| Database provider | MySQL |
| Authentication | NextAuth v5 beta credentials provider |
| Password hashing | `bcryptjs` |
| Styling | Global CSS and custom components |
| Seed command | `npx tsx prisma/seed.ts` |
| Build script | `npx prisma generate && next build` |

---

## 3. Modules Already Implemented

### 3.1 Authentication

Implemented files:

```text
lib/auth.ts
app/login/page.tsx
app/api/auth/[...nextauth]/route.ts
```

Current behavior:

- Credentials login using username or phone.
- Password validation using bcrypt compare.
- JWT session includes `role`, `appType`, `tenantId`, `branchId`, phone and username.
- User status must be `active`.

Observations:

- Login does not currently resolve tenant from domain/subdomain or input.
- If the platform becomes true SaaS with duplicate usernames across tenants, login needs tenant-aware lookup.
- Login audit log is not currently created.

---

### 3.2 Tenant and App Context

Implemented files:

```text
lib/tenant.ts
lib/appConfig.ts
app/portal/*
```

Current behavior:

- `getDefaultTenantId()` returns the default tenant by slug.
- `getUserAppType()` reads `active_app_type` cookie for `superadmin`/`developer` users.
- Admin/agent users use app type from session.
- App configs exist for `microlending`, `autofinance`, `chitfunds`.

Observations:

- Default tenant caching is fine for single-tenant mode, but should be reviewed for SaaS mode.
- App switching is only available to superadmin/developer.

---

### 3.3 Database Schema

Implemented models include:

```text
Tenant
Branch
AppSetting
User
Route
Customer
KycDocument
SecurityCheque
LoanPackage
Loan
Instalment
Penalty
DailyCollection
CollectionEntry
SystemNotification
NotificationTemplate
AuditLog
Guarantor
LoanCollateral
ApprovalRequest
RouteAgent
```

Schema observations:

- `ApprovalRequest` and `RouteAgent` are already present.
- Auto Finance `Vehicle` model is not yet present.
- Chit Fund models are not yet present.
- `SystemNotification` does not have `appType`, although the specification expects notification filtering by app.
- Many major models include `tenantId` and `appType`.

---

### 3.4 Customer Management

Implemented files:

```text
app/(dashboard)/customers/page.tsx
app/(dashboard)/customers/actions.ts
app/(dashboard)/customers/new/page.tsx
app/(dashboard)/customers/new/CustomerForm.tsx
app/(dashboard)/customers/[id]/page.tsx
app/(dashboard)/customers/[id]/CustomerProfileClient.tsx
```

Current behavior:

- Customer list supports search, route filter and status filter.
- Customer creation supports route, agent, profile photo filename, documents, cheques and guarantors.
- Agent-created customers are saved with `status = pending_review`.
- Admin-created customers are saved with `status = active`.
- Agent direct edit is blocked in `saveCustomer`.
- Basic `requestCustomerEdit()` server action exists.

Gaps:

- Middleware currently blocks agents from `/customers`, although the target matrix allows read-only customer access for agents.
- Customer profile client displays `Edit` and `New Loan` buttons without role-aware hiding.
- Customer detail query uses `tenantId`, but should also include `appType` and agent/route restrictions for agents.
- Customer edit fetch uses `tenantId`, but should also include `appType`.
- File upload is mocked by storing file name only.
- `createdByAgentId` is not explicitly present; current schema uses `agentId` and route assignment.

---

### 3.5 Loan Management

Implemented files:

```text
app/(dashboard)/loans/page.tsx
app/(dashboard)/loans/actions.ts
app/(dashboard)/loans/new/page.tsx
app/(dashboard)/loans/new/LoanForm.tsx
app/(dashboard)/loans/[id]/page.tsx
app/(dashboard)/loans/[id]/actions.ts
app/(dashboard)/loans/[id]/LoanDetailClient.tsx
```

Current behavior:

- Loan list and loan detail are implemented.
- Loan creation generates loan code using `loan_code_prefix` and `loan_code_counter`.
- Instalment dates are generated based on frequency and tenure.
- Loan supports cheque/gold/property-like collateral details in UI.
- Admin can mark instalment paid from loan detail.
- Loan can be closed.
- Penalties can be settled or waived from loan detail.

Gaps:

- `createLoan()` accepts `appType` from form data, falling back to session app type. For security, appType should be taken only from session/context.
- Customer and loan package ownership should be validated before loan creation.
- Loan detail query should include `appType`.
- Agent must not access loans, and UI/server action checks should be hardened beyond middleware.
- Branch isolation is not consistently applied.

---

### 3.6 Collection Management

Implemented files:

```text
app/(dashboard)/collection/page.tsx
app/(dashboard)/collection/actions.ts
app/(dashboard)/collection/CollectionClient.tsx
```

Current behavior:

- Agents/admins can see due and missed instalments.
- Agents are filtered using `customer.agentId = userId`.
- Collection entry records received amount, payment mode, remarks and agent ID.
- Instalment, loan totals and daily collection totals are updated.
- Audit log is created for collection entry.

Gaps:

- Shared route requirement is not fully implemented. Schema has `RouteAgent`, but collection uses `customer.agentId` and `route.assignedAgentId`.
- `DailyCollection.findFirst()` filters only by `agentId` and date, not by `tenantId` and `appType`.
- `submitCollectionEntry()` validates tenant but should also validate appType, branch and route assignment.
- Payment modes should include `bank_transfer` if following the specification.
- Overdue marking and penalty auto-generation jobs are not implemented.

---

### 3.7 Approvals

Implemented files:

```text
app/(dashboard)/approvals/page.tsx
app/(dashboard)/approvals/actions.ts
app/(dashboard)/approvals/ApprovalsClient.tsx
```

Current behavior:

- Admin can view approval requests.
- Agent-specific filter exists in page logic.
- Admin can approve or reject requests.
- Customer creation can be approved from the customer list.

Gaps:

- Middleware blocks agents from `/approvals`, but page logic suggests agents can view own requests.
- `reviewRequest()` does not validate app ownership of the target customer before applying changes.
- Requested changes are applied directly without field allow-list/sanitization.
- Approval/rejection is not audit-logged.
- Customer edit request UI is not fully visible from customer profile.

---

### 3.8 Settings

Implemented files:

```text
app/(dashboard)/settings/page.tsx
app/(dashboard)/settings/actions.ts
app/(dashboard)/settings/SettingsClient.tsx
```

Current behavior:

- Settings page loads routes, packages, users and tenant settings by app type.
- Route create/delete exists.
- Loan package create/delete exists.
- Basic user creation exists inside app settings.
- System and penalty settings save actions exist.

Critical bug:

```text
app/(dashboard)/settings/page.tsx
```

`userRole` is referenced before declaration.

Current code pattern:

```ts
const session = await auth();
if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
  redirect('/dashboard');
}
```

Required fix:

```ts
const session = await auth();
const userRole = (session?.user as any)?.role;
if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
  redirect('/dashboard');
}
```

Other gaps:

- Admin `createUser()` should restrict role to `agent` only.
- Branch assignment for Micro Lending users is not fully handled in settings user creation.
- Settings mutations are not fully audit-logged.
- RouteAgent many-to-many assignment UI is not implemented.

---

### 3.9 Admin Module

Implemented files:

```text
app/admin/layout.tsx
app/admin/users/page.tsx
app/admin/users/UsersClient.tsx
app/admin/branches/page.tsx
app/admin/branches/BranchesClient.tsx
app/admin/actions.ts
```

Current behavior:

- Superadmin/developer can manage master users.
- Developer-only branch page exists.
- User activate/deactivate exists.

Gaps:

- Specification states `/admin/branches` is available to superadmin, but code restricts it to developer.
- Seed file does not create a superadmin or developer user.
- `manageMasterUser()` should prevent non-developer users from creating/editing a `developer` role.
- User management actions need audit logging.

---

### 3.10 Notifications

Implemented files:

```text
app/(dashboard)/notifications/page.tsx
app/(dashboard)/notifications/actions.ts
app/(dashboard)/notifications/NotificationsClient.tsx
app/api/notifications/route.ts
prisma/seed.ts
```

Current behavior:

- Notifications page exists.
- Mark read and mark all read actions exist.
- API endpoint returns unread count.
- Notification templates are seeded.

Gaps:

- `SystemNotification` schema has no `appType`.
- Page imports appType but does not filter notifications by appType.
- Mark-read actions do not filter by appType.
- API endpoint is unauthenticated and tenant-only; should require auth and appType.

---

## 4. Specification Security Gap Status

| Spec Gap | Current Zip Status | Status |
|---|---|---|
| `/penalties` no appType filter | Page now uses `getUserAppType()` and filters via loan appType | Mostly Done |
| `/reports` no appType filter | Page uses `getUserAppType()` | Done |
| `/notifications` no appType filter | Imported but not applied; schema lacks appType | Pending |
| `/customers/new` route/agent queries lack appType | Route/agent queries include appType | Mostly Done |
| `/loans/new` queries lack appType | Customer/package/route/agent queries include appType | Done |
| `deleteRoute` no ownership check | Verifies `tenantId` + `appType` before delete | Done |
| `deleteLoanPackage` no ownership check | Verifies `tenantId` + `appType` before delete | Done |
| `submitCollectionEntry` no appType on DailyCollection | Create includes appType; lookup still lacks tenant/app filters | Partial |
| `settings/page.tsx` missing import | Import exists, but `userRole` variable is missing | Bug Introduced |
| No route-level middleware | Middleware exists | Partial because matrix mismatch remains |

---

## 5. Immediate Development Recommendation

Before adding new modules, complete these first:

1. Fix `settings/page.tsx` compile bug.
2. Align middleware with the access matrix.
3. Add `appType` to notifications schema and queries.
4. Complete RouteAgent-based shared route logic.
5. Add strict server-side permission checks to all actions.
6. Add appType/tenant/branch filters to detail pages and APIs.
7. Add audit logging to all mutations.
8. Add tests before adding Auto Finance and Chit Funds.


---

<!-- Source file: 03_SYSTEM_ARCHITECTURE_AND_DATA_MODEL.md -->

# System Architecture and Data Model

## 1. Architecture Overview

LoanTrack uses a single Next.js application with server-rendered pages, client components and server actions.

```text
Browser
  ↓
Next.js App Router Pages
  ↓
Server Actions / API Routes
  ↓
Prisma ORM
  ↓
MySQL Database
```

### Main Principles

- Use a **shared database** with row-level isolation.
- Every query must be scoped by `tenantId` and `appType` unless the entity is truly global.
- Branch filtering applies for Micro Lending branch admins.
- Superadmin/developer can switch app context through portal cookie.
- Field agents must only see collection/customer data for assigned/shared routes.

---

## 2. Folder Architecture

```text
app/
  page.tsx                         # Root redirect based on role
  login/                           # Login page
  portal/                          # App selector for superadmin/developer
  (dashboard)/                     # Main authenticated app pages
    dashboard/                     # KPIs and charts
    customers/                     # Customer list, create/edit, profile
    loans/                         # Loan list, create, detail
    collection/                    # Field collection page
    penalties/                     # Penalty ledger and actions
    reports/                       # Reports
    settings/                      # App-level configuration
    approvals/                     # Approval request review
  admin/                           # Master admin area
    users/                         # Cross-app user management
    branches/                      # Branch management
  api/                             # JSON endpoints
components/
  layout/                          # Sidebar, Topbar
  ui/                              # Shared small UI components
lib/
  auth.ts                          # NextAuth configuration
  tenant.ts                        # Tenant and app context helpers
  appConfig.ts                     # App metadata and themes
  db.ts                            # Prisma client
  utils.ts                         # Formatting, dates, calculations
prisma/
  schema.prisma                    # Database schema
  seed.ts                          # Demo seed data
middleware.ts                      # Route-level access control
```

---

## 3. Core Context Helpers

### `getDefaultTenantId()`

Current purpose:

- Resolves the default tenant using slug `default`.
- Caches tenant id in memory.

Production consideration:

- For real SaaS, tenant should be resolved by subdomain, request host, organization selection, or login context.

### `getUserAppType()`

Current purpose:

- For superadmin/developer, reads `active_app_type` cookie.
- For admin/agent, returns session app type.

Production consideration:

- Should validate allowed app types.
- Should not allow arbitrary cookie value.

Recommended hardening:

```ts
const allowedAppTypes = ['microlending', 'autofinance', 'chitfunds'];
if (!allowedAppTypes.includes(activeApp)) return 'microlending';
```

---

## 4. Database Model Grouping

### 4.1 Multi-Tenant and Organization

| Model | Purpose |
|---|---|
| Tenant | Tenant/company record |
| Branch | Branches under tenant, primarily Micro Lending |
| AppSetting | Configurable settings like currency, prefixes, penalty rates |

### 4.2 User and Access

| Model | Purpose |
|---|---|
| User | Admins, agents, superadmins and future borrowers |
| Route | Collection route/area |
| RouteAgent | Many-to-many route assignment for shared routes |

### 4.3 Customer and KYC

| Model | Purpose |
|---|---|
| Customer | Borrower/customer profile |
| KycDocument | Uploaded KYC documents |
| SecurityCheque | Cheque details and cheque image path |
| Guarantor | Guarantor/surety details |

### 4.4 Loan and Collection

| Model | Purpose |
|---|---|
| LoanPackage | Configurable loan templates |
| Loan | Loan contract/ledger root |
| Instalment | Instalment schedule and payment state |
| DailyCollection | Daily collection ledger per agent |
| CollectionEntry | Individual payment submission |
| Penalty | Penalty ledger for missed payments |
| LoanCollateral | Collateral document/file record |

### 4.5 Notifications, Audit and Workflow

| Model | Purpose |
|---|---|
| SystemNotification | In-app notification message |
| NotificationTemplate | SMS/WhatsApp/email templates |
| AuditLog | Mutation audit trail |
| ApprovalRequest | Agent request workflow for customer changes |

---

## 5. Required Data Model Enhancements

### 5.1 Add `appType` to SystemNotification

Current issue:

- Notifications cannot be reliably scoped by app because `SystemNotification` has `tenantId` but not `appType`.

Recommended schema change:

```prisma
model SystemNotification {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  appType   String   @default("microlending") @map("app_type")
  type      String
  icon      String?
  title     String?
  message   String   @db.Text
  link      String?
  isRead    Boolean  @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  expiresAt DateTime? @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, appType, isRead])
  @@index([createdAt])
  @@map("system_notifications")
}
```

---

### 5.2 Add Auto Finance Model

Recommended Phase 2 model:

```prisma
model Vehicle {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  appType         String   @default("autofinance") @map("app_type")
  customerId      String   @map("customer_id")
  registrationNo  String   @map("registration_no")
  make            String
  model           String
  year            Int
  color           String?
  engineNo        String?  @map("engine_no")
  chassisNo       String?  @map("chassis_no")
  insuranceExpiry DateTime? @map("insurance_expiry")
  rcDocPath       String?  @map("rc_doc_path")
  status          String   @default("active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  customer        Customer @relation(fields: [customerId], references: [id])

  @@unique([tenantId, appType, registrationNo])
  @@map("vehicles")
}
```

---

### 5.3 Add Chit Fund Models

Recommended Phase 3 models:

```prisma
model ChitGroup {
  id                  String   @id @default(cuid())
  tenantId            String   @map("tenant_id")
  appType             String   @default("chitfunds") @map("app_type")
  groupCode           String   @map("group_code")
  name                String
  totalValue          Decimal  @map("total_value") @db.Decimal(12, 2)
  monthlyContribution Decimal  @map("monthly_contribution") @db.Decimal(12, 2)
  duration            Int
  memberCount         Int      @map("member_count")
  startDate           DateTime @map("start_date") @db.Date
  status              String   @default("active")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  members             ChitMember[]
  auctions            ChitAuction[]

  @@unique([tenantId, appType, groupCode])
  @@map("chit_groups")
}
```

Add `ChitMember`, `ChitAuction` and `ChitSubscription` as separate related tables.

---

## 6. Query Isolation Pattern

Every query should follow this pattern:

```ts
const tenantId = await getDefaultTenantId();
const appType = await getUserAppType();
const session = await auth();
const role = (session?.user as any)?.role;
const branchId = (session?.user as any)?.branchId;

const where: any = { tenantId, appType };

if (appType === 'microlending' && role === 'admin') {
  where.branchId = branchId;
}
```

For detail pages:

```ts
const customer = await prisma.customer.findFirst({
  where: {
    id,
    tenantId,
    appType,
    ...(role === 'agent' ? { routeId: { in: assignedRouteIds } } : {}),
  },
});
```

Do not rely only on UI hiding. Server-side filtering is mandatory.

---

## 7. Audit Model Usage

Every mutation should create an `AuditLog` entry.

Minimum audit payload:

```ts
await prisma.auditLog.create({
  data: {
    tenantId,
    userId,
    action: 'create',
    entityType: 'customer',
    entityId: customer.id,
    oldValue: null,
    newValue: JSON.stringify({ customerCode: customer.customerCode, status: customer.status }),
  },
});
```

Critical actions requiring audit:

- Login/logout.
- App switch.
- Customer create/update/approval.
- Loan create/close.
- Collection entry.
- Penalty settle/waive.
- Settings changes.
- Route/package/user/branch changes.


---

<!-- Source file: 04_RBAC_SECURITY_AND_ISOLATION_REQUIREMENTS.md -->

# RBAC, Security and Isolation Requirements

## 1. Role Definitions

| Role | Scope | Key Access |
|---|---|---|
| `developer` | Technical/internal role | All apps, admin portal, branch setup, seed/debug support |
| `superadmin` | Business platform owner | App selector, master users, all app data within tenant |
| `admin` | Application admin | One app type, branch-limited for Micro Lending |
| `agent` | Field collection user | Own/shared route customers and collection only |
| `borrower` | Future self-service | Own profile/loan view only |

---

## 2. Target Page Access Matrix

| Route | Developer | Super Admin | Admin | Agent | Notes |
|---|---:|---:|---:|---:|---|
| `/portal` | ✅ | ✅ | ❌ | ❌ | App selection |
| `/admin/users` | ✅ | ✅ | ❌ | ❌ | Master user management |
| `/admin/branches` | ✅ | ✅ | ❌ | ❌ | Branch management, ML only |
| `/dashboard` | ✅ | ✅ | ✅ | ❌ | Agent redirects to collection |
| `/customers` | ✅ | ✅ | ✅ | ✅ read-only | Agent only assigned/shared route customers |
| `/customers/new` | ✅ | ✅ | ✅ | ✅ create only | Agent creation = pending review |
| `/customers/[id]` | ✅ | ✅ | ✅ | ✅ read-only | Agent cannot edit or create loan |
| `/customers/new?edit=` | ✅ | ✅ | ✅ | ❌ | Agent must raise approval request |
| `/loans` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/loans/new` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/loans/[id]` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/collection` | ✅ | ✅ | ✅ | ✅ | Agent primary page |
| `/penalties` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/reports` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/notifications` | ✅ | ✅ | ✅ | ✅ | Filtered by app and user scope |
| `/settings` | ✅ | ✅ | ✅ | ❌ | Admin manages own app settings |
| `/approvals` | ✅ | ✅ | ✅ | ✅ own requests | Admin reviews; agent views own requests |

---

## 3. Middleware Alignment Required

Current middleware treats `/customers` and `/approvals` as admin routes. This conflicts with the target matrix because agents should access customers read-only and view own approvals.

Recommended middleware route groups:

```ts
const superAdminRoutes = ['/portal', '/admin'];
const adminOnlyRoutes = ['/dashboard', '/loans', '/penalties', '/reports', '/settings'];
const sharedRoutes = ['/customers', '/collection', '/notifications', '/approvals'];
```

Rules:

- Agent accessing `/dashboard`, `/loans`, `/penalties`, `/reports`, `/settings` → redirect `/collection`.
- Agent accessing `/customers/new?edit=` → redirect customer profile or approval request page.
- Agent accessing `/customers` → allowed, but server-side query must be route-scoped.
- Agent accessing `/approvals` → allowed, but query must filter by `requestedById`.

---

## 4. Server-Side Permission Rules

Do not rely only on middleware. Every server action must validate the session.

### Customer Actions

| Action | Developer/Superadmin | Admin | Agent |
|---|---:|---:|---:|
| Create customer | ✅ | ✅ | ✅ pending review |
| Edit customer | ✅ | ✅ | ❌ direct edit blocked |
| View customer | ✅ | ✅ | ✅ assigned/shared routes only |
| Delete customer | ❌ | ❌ | ❌ |
| Request edit | ❌ optional | ❌ optional | ✅ |

### Loan Actions

| Action | Developer/Superadmin | Admin | Agent |
|---|---:|---:|---:|
| Create loan | ✅ | ✅ | ❌ |
| View loan | ✅ | ✅ | ❌ |
| Mark instalment paid from loan detail | ✅ | ✅ | ❌ |
| Close loan | ✅ | ✅ | ❌ |

### Collection Actions

| Action | Developer/Superadmin | Admin | Agent |
|---|---:|---:|---:|
| View collection page | ✅ | ✅ | ✅ |
| Submit collection | ✅ | ✅ | ✅ assigned/shared route only |
| Edit locked entry | Optional | Optional | ❌ except configured edit window |

---

## 5. Isolation Checklist

Every data access must answer these questions:

| Question | Required Answer |
|---|---|
| Is the user authenticated? | Yes |
| What is the user's `tenantId`? | From session or tenant resolver |
| What is the current `appType`? | From session/cookie helper |
| Is branch restriction required? | Yes for Micro Lending admin |
| Is route restriction required? | Yes for agent customer/collection access |
| Is the entity in same app? | Must be verified |
| Is the entity in same tenant? | Must be verified |
| Should wrong app data return 403 or 404? | Prefer 404/not found to avoid leakage |

---

## 6. Critical Security Fixes

### 6.1 Do Not Trust `appType` From Form Data

Current loan action reads:

```ts
const appType = (formData.get('appType') as string) || sessionAppType;
```

Recommended:

```ts
const appType = await getUserAppType();
```

The server must own app context.

---

### 6.2 Use `findFirst` With Full Ownership Filter for Mutations

Example:

```ts
const customer = await prisma.customer.findFirst({
  where: { id: customerId, tenantId, appType },
});

if (!customer) {
  return { success: false, error: 'Customer not found' };
}
```

---

### 6.3 Field Allow-List for Approval Requests

Never apply arbitrary JSON directly:

```ts
const allowedCustomerFields = ['name', 'phone', 'address', 'routeId'];
const safeChanges = Object.fromEntries(
  Object.entries(changes).filter(([key]) => allowedCustomerFields.includes(key))
);
```

---

### 6.4 Agent Route Validation for Collection

Agent can collect only if:

- Customer is on one of agent's assigned `RouteAgent` routes, or
- Customer is explicitly assigned to that agent as fallback during transition.

Recommended helper:

```ts
async function getAgentRouteIds(agentId: string) {
  const routeAgents = await prisma.routeAgent.findMany({
    where: { agentId },
    select: { routeId: true },
  });
  return routeAgents.map(r => r.routeId);
}
```

---

## 7. API Route Security

API routes must apply the same security as pages.

Current API gaps:

| API | Gap | Fix |
|---|---|---|
| `/api/customers` | tenant-only filter | Add `appType`, branch, role route scope |
| `/api/loans` | tenant-only filter | Add `appType`, branch, admin-only restriction |
| `/api/notifications` | no auth check and no appType | Require auth, add `appType` field/filter |

---

## 8. Password and Session Requirements

Minimum recommended standards:

- Password hash cost should be consistent. Current code uses cost 12 in seed/settings and 10 in admin action. Standardize to 12.
- Enforce minimum password length and complexity for admin-created users.
- Do not allow inactive/suspended users to log in.
- Add login audit entry.
- Add logout audit entry if possible.

---

## 9. Production Security Checklist

| Check | Required Before Release |
|---|---:|
| All server actions have auth checks | ✅ |
| All queries include tenant and app filters | ✅ |
| Branch filter applied for ML admins | ✅ |
| Agent route filter applied | ✅ |
| Middleware matches route matrix | ✅ |
| API routes hardened | ✅ |
| No form-provided tenant/app/agent IDs trusted blindly | ✅ |
| File uploads validate MIME/size/path | ✅ |
| Audit logging complete | ✅ |
| Superadmin/developer cannot be created by normal admin | ✅ |


---

<!-- Source file: 05_CORE_WORKFLOWS_AND_FUNCTIONAL_REQUIREMENTS.md -->

# Core Workflows and Functional Requirements

## 1. Login and Role-Based Landing

### Flow

```text
User enters username/phone + password
  ↓
System validates active user and password
  ↓
JWT session is created with role, tenantId, appType, branchId
  ↓
Redirect based on role
```

### Expected Redirects

| Role | Landing Page |
|---|---|
| `developer` | `/portal` |
| `superadmin` | `/portal` |
| `admin` | `/dashboard` |
| `agent` | `/collection` |

### Acceptance Criteria

- Invalid username/password shows a clear error.
- Inactive/suspended user cannot login.
- Session contains role, appType, tenantId and branchId.
- Role-based landing works consistently.

---

## 2. App Selector Workflow

### Users

- Developer
- Super Admin

### Flow

```text
Open /portal
  ↓
View Micro Lending / Auto Finance / Chit Funds cards
  ↓
Select one app
  ↓
System stores active_app_type cookie
  ↓
Redirect to /dashboard
```

### Rules

- Admin/agent cannot access `/portal`.
- Cookie value must be validated against allowed app types.
- App-specific theme and data scope should update after selection.

---

## 3. Customer Creation Workflow

### Admin Creates Customer

```text
Admin opens /customers/new
  ↓
Enters customer details, route, agent, cheques, guarantors, documents
  ↓
Submit
  ↓
System generates customer code
  ↓
Customer saved as active
  ↓
Redirect to customer profile
```

### Agent Creates Customer

```text
Agent opens /customers/new
  ↓
Enters customer details
  ↓
Submit
  ↓
System generates customer code
  ↓
Customer saved as pending_review
  ↓
Admin reviews and approves
  ↓
Customer becomes active
```

### Functional Requirements

| Requirement | Details |
|---|---|
| Customer code | Generated using configurable prefix and counter |
| Agent creation status | `pending_review` |
| Admin creation status | `active` |
| KYC documents | Store via production upload service, not only filename |
| Security cheques | Store bank, cheque number, image path |
| Guarantors | Store name, phone, relation, address and photo |

---

## 4. Customer Edit and Approval Workflow

### Target Flow

```text
Agent views customer profile
  ↓
Agent clicks Request Edit
  ↓
Agent enters requested changes and reason
  ↓
ApprovalRequest created with status pending
  ↓
Admin reviews request
  ↓
Admin approves or rejects
  ↓
If approved, safe changes are applied
  ↓
Audit log records approval/rejection
```

### Required Rules

- Agents cannot directly edit customers.
- Admin can directly edit customers within app/branch scope.
- Approval changes must use field allow-list.
- Approval review must verify target entity belongs to same tenant and app.

---

## 5. Loan Creation Workflow

### Flow

```text
Admin opens /loans/new
  ↓
Selects customer and package or enters custom loan values
  ↓
System calculates disbursed amount and per instalment
  ↓
System generates loan code
  ↓
System creates Loan and Instalment schedule
  ↓
Audit log records loan creation
  ↓
Redirect to loan detail
```

### Functional Requirements

| Field | Rule |
|---|---|
| Principal | Required, positive amount |
| Deduction | Required, cannot exceed principal |
| Disbursed | principal - deduction |
| Frequency | daily / weekly / monthly |
| Tenure | Positive integer |
| Per instalment | principal / tenure, with rounding rules documented |
| Loan code | Generated using prefix + counter |
| Customer | Must belong to same tenant/app/branch scope |
| Package | Must belong to same tenant/app |
| Agent | Inherited from route/customer assignment |

---

## 6. Collection Workflow

### Agent Collection Flow

```text
Agent opens /collection
  ↓
System loads missed instalments and today's due instalments
  ↓
Agent selects customer instalment
  ↓
Agent enters received amount, payment mode, remarks
  ↓
System creates CollectionEntry
  ↓
System updates Instalment
  ↓
System updates Loan totals
  ↓
System updates DailyCollection totals
  ↓
Audit log records collection
```

### Rules

- Agent can collect only for assigned/shared route customers.
- Collection entry must stamp `agentId` from session.
- Agent identity must never come from form data.
- If amount >= due amount → status `paid`.
- If amount < due amount → status `partial`.
- Already paid instalment cannot be collected again.
- Daily collection should be scoped by tenant, app, agent and date.

---

## 7. Shared Route Workflow

### Target Flow

```text
Admin creates route
  ↓
Admin assigns Agent A and Agent B to same route using RouteAgent
  ↓
Both agents open /collection
  ↓
Both see customers on that route
  ↓
Either agent can collect
  ↓
CollectionEntry stores actual collecting agentId
```

### Required Implementation

- Use `RouteAgent` as source of route assignment.
- Keep `Route.assignedAgentId` only as optional primary/backward compatibility field.
- Collection query should use route IDs from `RouteAgent`.
- Reports should show both primary route owner and actual collecting agent.

---

## 8. Penalty Workflow

### Current Manual Flow

```text
Loan detail / penalty page
  ↓
Admin settles or waives penalty
  ↓
Penalty status updates
  ↓
Audit log created
```

### Required Future Automation

```text
Scheduled job runs after midnight
  ↓
Find overdue unpaid instalments
  ↓
Mark instalment as missed
  ↓
Calculate missed days and penalty amount
  ↓
Create/update Penalty record
  ↓
Create notification for admin/agent/customer
```

---

## 9. Reports Workflow

Reports should support:

- Collection efficiency by date range.
- Defaulter aging buckets.
- Penalty accrued/settled/waived.
- Loan disbursement summary.
- Agent performance.
- Route filters and agent filters.

Rules:

- Reports must filter by tenant and app.
- ML admin reports must filter by branch.
- Agent should not access reports.

---

## 10. Settings Workflow

Settings modules:

| Settings Area | Purpose |
|---|---|
| System settings | App name, currency, date/time, code prefixes |
| Penalty settings | Per-day penalty, grace period, cap |
| Routes | Create/delete routes and assign agents |
| Loan packages | Create/delete package templates |
| Users | Admin creates agents within own app |

Rules:

- Agent cannot access settings.
- Admin can create only agents in own app.
- Superadmin can manage app users from master user management.
- Settings changes must be audit-logged.

---

## 11. Notification Workflow

Expected flow:

```text
Event occurs: payment overdue, loan created, collection missed
  ↓
System creates SystemNotification with tenantId + appType
  ↓
Users see notifications in /notifications
  ↓
Unread count API returns scoped count
  ↓
User marks read or mark all read
```

Required change:

- Add `appType` to `SystemNotification`.
- All notification reads/updates must filter by `tenantId + appType`.


---

<!-- Source file: 06_DEVELOPMENT_BACKLOG_AND_IMPLEMENTATION_TICKETS.md -->

# Development Backlog and Implementation Tickets

## 1. Priority Legend

| Priority | Meaning |
|---|---|
| P0 | Must fix before local build / secure testing |
| P1 | Must fix before MVP/UAT |
| P2 | Needed before production release |
| P3 | Future phase / enhancement |

---

## Phase 0 — Stabilize Build and Critical Security

### LT-P0-001 — Fix Settings Page Compile Bug

**Priority:** P0  
**File:** `app/(dashboard)/settings/page.tsx`

**Problem:** `userRole` is used before it is declared.

**Implementation:**

```ts
const session = await auth();
const userRole = (session?.user as any)?.role;
```

**Acceptance Criteria:**

- `npm run build` does not fail because of `userRole`.
- Agent cannot access settings.
- Admin/superadmin/developer can access settings based on route rules.

---

### LT-P0-002 — Align Middleware With Target Access Matrix

**Priority:** P0  
**File:** `middleware.ts`

**Problem:** Current middleware blocks agents from `/customers` and `/approvals`, but target behavior allows read-only customer access and own approval request view.

**Implementation:**

- Move `/customers` and `/approvals` out of admin-only group.
- Add special check for `/customers/new?edit=` for agents.
- Keep `/loans`, `/penalties`, `/reports`, `/settings`, `/dashboard` admin-only.

**Acceptance Criteria:**

- Agent can access `/collection`.
- Agent can access `/customers` with scoped data.
- Agent can access `/approvals` with own requests.
- Agent cannot access `/loans`, `/reports`, `/penalties`, `/settings`.

---

### LT-P0-003 — Add AppType to Notifications

**Priority:** P0  
**Files:**

```text
prisma/schema.prisma
app/(dashboard)/notifications/page.tsx
app/(dashboard)/notifications/actions.ts
app/api/notifications/route.ts
prisma/seed.ts
```

**Problem:** Notifications cannot be scoped by app because `SystemNotification` lacks `appType`.

**Implementation:**

- Add `appType` field to `SystemNotification`.
- Update queries and mutations to include appType.
- Require auth in notification count API.

**Acceptance Criteria:**

- Micro Lending notifications do not appear in Auto Finance/Chit Funds.
- Mark all read updates only current app notifications.
- API unread count returns scoped count only.

---

### LT-P0-004 — Harden API Routes

**Priority:** P0  
**Files:**

```text
app/api/customers/route.ts
app/api/loans/route.ts
app/api/notifications/route.ts
```

**Problem:** API routes are not fully app/role/branch scoped.

**Implementation:**

- Add session role validation.
- Add `appType` filter.
- Add branch filter for ML admin.
- Add route filter for agent customer API.
- Restrict loan API to admin/superadmin/developer.

**Acceptance Criteria:**

- Agent cannot fetch all loans via API.
- Agent customer API returns only assigned/shared route customers.
- Wrong app data is not returned.

---

### LT-P0-005 — Stop Trusting AppType from Forms

**Priority:** P0  
**File:** `app/(dashboard)/loans/actions.ts`

**Problem:** `createLoan()` accepts `appType` from form data.

**Implementation:**

- Use `const appType = await getUserAppType();` only.
- Validate selected customer and package belong to same tenant/app.

**Acceptance Criteria:**

- Tampering hidden form field cannot create cross-app loan.
- Customer/package mismatch returns error.

---

## Phase 1 — Complete Micro Lending MVP

### LT-P1-001 — Complete RouteAgent Shared Route Assignment

**Priority:** P1  
**Files:**

```text
app/(dashboard)/settings/SettingsClient.tsx
app/(dashboard)/settings/actions.ts
app/(dashboard)/collection/page.tsx
app/(dashboard)/reports/page.tsx
prisma/schema.prisma
```

**Problem:** `RouteAgent` exists but is not used for shared route collection.

**Implementation:**

- Add multi-select route-agent assignment UI.
- Create/update `RouteAgent` rows.
- Collection page should fetch customers by assigned route IDs.
- Reports should use actual collection agent and route-agent mapping.

**Acceptance Criteria:**

- Two agents assigned to same route can both see that route's customers.
- Collection entry records actual collecting agent.
- Removing an agent from a route removes access.

---

### LT-P1-002 — Agent Customer Read-Only Experience

**Priority:** P1  
**Files:**

```text
app/(dashboard)/customers/page.tsx
app/(dashboard)/customers/[id]/page.tsx
app/(dashboard)/customers/[id]/CustomerProfileClient.tsx
```

**Implementation:**

- Add role-aware query scoping.
- Hide edit and new loan buttons for agents.
- Add Request Edit button for agents.

**Acceptance Criteria:**

- Agent sees only own/shared route customers.
- Agent cannot see edit/new-loan options.
- Agent can create approval request.

---

### LT-P1-003 — Complete Approval Request UI and Safety

**Priority:** P1

**Implementation:**

- Add agent request edit form.
- Add field-level allow-list for requested changes.
- Validate target entity ownership before applying changes.
- Add audit logs for approve/reject.

**Acceptance Criteria:**

- Agent can submit request with reason.
- Admin can approve/reject.
- Rejected changes do not update customer.
- Approved changes update only allowed fields.

---

### LT-P1-004 — Apply Branch Isolation for Micro Lending Admin

**Priority:** P1

**Implementation:**

- Create helper to build scoped where clauses.
- Apply branch filter to dashboard, customers, loans, collection, reports, penalties, settings where applicable.

**Acceptance Criteria:**

- Branch A admin cannot view Branch B customers, loans, routes or reports.
- Superadmin/developer can view all branches in selected app.

---

### LT-P1-005 — Complete Audit Logging

**Priority:** P1

**Implementation:**

Add audit logs to:

- Customer create/update.
- Customer approval/rejection.
- User create/update/deactivate.
- Branch create.
- Route create/delete.
- Loan package create/delete.
- Settings changes.
- App switch.
- Login.

**Acceptance Criteria:**

- Audit logs are created for all mutation flows.
- Audit log includes userId, tenantId, action, entityType and entityId.

---

### LT-P1-006 — Replace Mock File Uploads

**Priority:** P1/P2

**Current issue:** Customer files are stored as filenames only.

**Implementation options:**

- Local storage for MVP.
- S3-compatible object storage for production.
- Store path, MIME type, file size and uploadedBy.

**Acceptance Criteria:**

- Uploaded file is physically saved.
- Invalid file type is rejected.
- File path is not user-controlled.
- File size is limited.

---

## Phase 2 — Production Readiness

### LT-P2-001 — Add Seed Users for All Roles

**Priority:** P2

Seed should include:

| Username | Role | Purpose |
|---|---|---|
| `developer` | developer | Technical/admin setup |
| `superadmin` | superadmin | Cross-app business admin |
| `admin` | admin | Micro Lending admin |
| `karthik` | agent | Demo field agent |

**Acceptance Criteria:**

- All major role flows can be tested after seed.
- Developer/superadmin can access portal.

---

### LT-P2-002 — Add Database Migration Discipline

**Priority:** P2

**Implementation:**

- Use Prisma migrations instead of only `db push`.
- Create migration for notification appType, Vehicle and Chit models when implemented.
- Add migration rollback notes.

---

### LT-P2-003 — Add Automated Test Framework

**Priority:** P2

Recommended tools:

- Unit tests: Vitest.
- E2E tests: Playwright.
- API/server action tests: Vitest + test database or integration scripts.

**Acceptance Criteria:**

- Test command runs in CI.
- E2E covers admin and agent flows.
- RBAC negative tests are automated.

---

## Phase 3 — Auto Finance

### LT-P3-001 — Vehicle Module

**Priority:** P3

Build:

- Vehicle model.
- Vehicle CRUD.
- Link vehicle to customer and loan.
- RC and insurance document upload.
- Registration number search.

---

### LT-P3-002 — Auto Finance EMI Rules

**Priority:** P3

Build:

- EMI-style package templates.
- Monthly collection schedule.
- 90+ day overdue repo flag.
- AF-specific dashboard cards.

---

## Phase 4 — Chit Funds

### LT-P4-001 — Chit Group Lifecycle

Build:

- ChitGroup CRUD.
- Member onboarding.
- Ticket number allocation.
- Monthly subscription ledger.
- Auction entry and winner selection.
- Dividend calculation.

---

## 2. Development Sequencing Recommendation

Do not start Auto Finance/Chit Funds until these are complete:

1. Build passes.
2. RBAC access matrix passes.
3. RouteAgent shared route logic passes.
4. App/tenant/branch isolation tests pass.
5. Micro Lending happy path works end-to-end.


---

<!-- Source file: 07_SETUP_LOCAL_DEVELOPMENT_AND_ENVIRONMENT.md -->

# Setup, Local Development and Environment Guide

## 1. Prerequisites

Install:

- Node.js 22.x recommended.
- npm 10.x or compatible package manager.
- MySQL 8.x.
- Git.

Check versions:

```bash
node -v
npm -v
mysql --version
```

---

## 2. Install Dependencies

From the project root:

```bash
npm install
```

---

## 3. Environment Variables

Create `.env` in the project root.

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/loantrack"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

For NextAuth v5, `AUTH_SECRET` is important.

Generate a strong secret:

```bash
openssl rand -base64 32
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Maximum 256}))
```

---

## 4. Create Database

Login to MySQL:

```bash
mysql -u root -p
```

Create database:

```sql
CREATE DATABASE loantrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 5. Prisma Commands

Generate Prisma client:

```bash
npm run db:generate
```

Push schema to database:

```bash
npm run db:push
```

Seed demo data:

```bash
npm run db:seed
```

Open Prisma Studio:

```bash
npm run db:studio
```

---

## 6. Start Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 7. Existing Seed Logins

Current seed creates:

| User | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `karthik` | `agent123` | agent |

Recommended addition before full testing:

| User | Password | Role |
|---|---|---|
| `developer` | `dev123` | developer |
| `superadmin` | `super123` | superadmin |

---

## 8. Build and Quality Commands

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

Validate Prisma schema:

```bash
npx prisma validate
```

Format Prisma schema:

```bash
npx prisma format
```

---

## 9. Database Reset During Development

Only use in local development:

```bash
npm run db:reset
```

Or:

```bash
npx prisma migrate reset
```

Then seed again:

```bash
npm run db:seed
```

---

## 10. Recommended Local Test Flow

After setup:

1. Login as admin.
2. Create a route.
3. Create an agent.
4. Create a customer.
5. Create a loan for the customer.
6. Login as agent.
7. Open collection page.
8. Submit a collection entry.
9. Login as admin.
10. Check dashboard, loan detail, reports and audit log.

---

## 11. Troubleshooting

### Issue: `Default tenant not found`

Run:

```bash
npm run db:seed
```

### Issue: Prisma client mismatch

Run:

```bash
npm run db:generate
```

### Issue: Build fails in settings page

Fix:

```ts
const session = await auth();
const userRole = (session?.user as any)?.role;
```

### Issue: Superadmin cannot login

Current seed does not create superadmin. Add superadmin/developer to `prisma/seed.ts`.

### Issue: Agent cannot open customers page

Current middleware blocks `/customers` for agents. Align middleware with target access matrix.


---

<!-- Source file: 08_CODE_FIX_GUIDE_AND_RECOMMENDED_PATCHES.md -->

# Code Fix Guide and Recommended Patches

This document lists recommended patches for the current zip implementation.

---

## 1. Fix `settings/page.tsx` Build Issue

### File

```text
app/(dashboard)/settings/page.tsx
```

### Current Issue

`userRole` is referenced before declaration.

### Patch

```ts
export default async function SettingsPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;

  if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
    redirect('/dashboard');
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  // existing logic continues...
}
```

---

## 2. Update Middleware Route Groups

### File

```text
middleware.ts
```

### Recommended Logic

```ts
const superAdminRoutes = ['/portal', '/admin'];
const adminOnlyRoutes = ['/dashboard', '/loans', '/penalties', '/reports', '/settings'];
const sharedRoutes = ['/customers', '/collection', '/notifications', '/approvals'];

if (superAdminRoutes.some(route => pathname.startsWith(route))) {
  if (role !== 'superadmin' && role !== 'developer') {
    return NextResponse.redirect(new URL(role === 'agent' ? '/collection' : '/dashboard', request.url));
  }
}

if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
  if (role !== 'admin' && role !== 'superadmin' && role !== 'developer') {
    return NextResponse.redirect(new URL('/collection', request.url));
  }
}

if (role === 'agent' && pathname.startsWith('/customers/new') && request.nextUrl.searchParams.has('edit')) {
  return NextResponse.redirect(new URL('/customers', request.url));
}
```

---

## 3. Add AppType to Notifications

### Prisma Patch

```prisma
model SystemNotification {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  appType   String   @default("microlending") @map("app_type")
  type      String
  icon      String?
  title     String?
  message   String   @db.Text
  link      String?
  isRead    Boolean  @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  expiresAt DateTime? @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, appType, isRead])
  @@index([createdAt])
  @@map("system_notifications")
}
```

After schema change:

```bash
npx prisma migrate dev --name add-notification-app-type
npx prisma generate
```

### Notifications Page Patch

```ts
const notifications = await prisma.systemNotification.findMany({
  where: { tenantId, appType },
  orderBy: { createdAt: 'desc' },
});
```

### Mark Read Action Patch

```ts
const appType = await getUserAppType();

await prisma.systemNotification.updateMany({
  where: { id, tenantId, appType },
  data: { isRead: true, readAt: new Date() },
});
```

Use `updateMany` because it safely handles scoped where filters.

---

## 4. Harden `createLoan()`

### File

```text
app/(dashboard)/loans/actions.ts
```

### Key Changes

- Remove form-provided `appType`.
- Validate session role.
- Validate customer ownership.
- Validate package ownership.

### Patch Pattern

```ts
const session = await auth();
const role = (session?.user as any)?.role;
const createdById = (session?.user as any)?.id;
const tenantId = await getDefaultTenantId();
const appType = await getUserAppType();

if (!createdById || role === 'agent') {
  return { success: false, error: 'Unauthorized' };
}

const customer = await prisma.customer.findFirst({
  where: { id: customerId, tenantId, appType, status: 'active' },
});

if (!customer) {
  return { success: false, error: 'Customer not found or not approved' };
}

if (packageId) {
  const pkg = await prisma.loanPackage.findFirst({
    where: { id: packageId, tenantId, appType, status: 'active' },
  });
  if (!pkg) return { success: false, error: 'Loan package not found' };
}
```

---

## 5. Implement RouteAgent-Based Collection Scope

### Helper

Create a helper in `lib/access.ts`:

```ts
import prisma from '@/lib/db';

export async function getAgentRouteIds(agentId: string) {
  const rows = await prisma.routeAgent.findMany({
    where: { agentId },
    select: { routeId: true },
  });
  return rows.map(r => r.routeId);
}
```

### Collection Page Patch

```ts
const customerFilter: any = { tenantId, appType };

if (userRole === 'agent') {
  const routeIds = await getAgentRouteIds(userId);
  customerFilter.OR = [
    { routeId: { in: routeIds } },
    { agentId: userId }, // fallback during migration
  ];
}
```

### Submit Collection Validation

Before accepting payment:

```ts
if (userRole === 'agent') {
  const routeIds = await getAgentRouteIds(userId);
  const customerRouteId = instalment.loan.customer.routeId;
  const explicitlyAssigned = instalment.loan.customer.agentId === userId;

  if (!explicitlyAssigned && (!customerRouteId || !routeIds.includes(customerRouteId))) {
    return { success: false, error: 'You are not assigned to this route' };
  }
}
```

---

## 6. Fix DailyCollection Lookup

### Current Risk

`findFirst` uses only `agentId` and date.

### Patch

```ts
let dailyCollection = await prisma.dailyCollection.findFirst({
  where: { tenantId, appType, agentId: userId, date: today },
});
```

### Recommended Schema Improvement

```prisma
@@unique([tenantId, appType, agentId, date])
```

Remove or replace old:

```prisma
@@unique([agentId, date])
```

---

## 7. Harden Customer Detail and Loan Detail Pages

### Customer Detail

```ts
const customer = await prisma.customer.findFirst({
  where: {
    id: resolvedParams.id,
    tenantId,
    appType,
    ...(userRole === 'agent' ? { routeId: { in: assignedRouteIds } } : {}),
  },
  include: { ... },
});
```

### Loan Detail

```ts
const loan = await prisma.loan.findFirst({
  where: { id: resolvedParams.id, tenantId, appType },
  include: { ... },
});
```

---

## 8. Hide Agent-Restricted UI Actions

### Customer Profile Client

Pass `userRole` from server to client.

```tsx
{userRole !== 'agent' && (
  <Link href={`/customers/new?edit=${customer.id}`} className="btn btn-secondary btn-sm">Edit</Link>
)}

{userRole !== 'agent' && (
  <Link href={`/loans/new?customerId=${customer.id}`} className="btn btn-primary btn-sm">New Loan</Link>
)}

{userRole === 'agent' && (
  <button className="btn btn-secondary btn-sm">Request Edit</button>
)}
```

---

## 9. Harden Approval Review

### Current Risk

Requested changes are applied directly.

### Patch Pattern

```ts
const request = await prisma.approvalRequest.findFirst({
  where: { id: requestId, tenantId, appType, status: 'pending' },
});

const targetCustomer = await prisma.customer.findFirst({
  where: { id: request.entityId, tenantId, appType },
});

if (!targetCustomer) return { success: false, error: 'Customer not found' };

const changes = JSON.parse(request.requestedChanges);
const allowedFields = ['name', 'phone', 'address', 'routeId'];
const safeChanges = Object.fromEntries(
  Object.entries(changes).filter(([key]) => allowedFields.includes(key))
);

await prisma.customer.update({
  where: { id: targetCustomer.id },
  data: safeChanges,
});
```

---

## 10. Harden Admin User Management

Rules:

- Only developer can create developer.
- Superadmin can create admin/agent but not developer.
- Admin can create only agent in own app.
- Password hash cost should be standardized to 12.

Patch rule:

```ts
if (userRole === 'superadmin' && role === 'developer') {
  return { success: false, error: 'Only developer can create developer users' };
}
```

---

## 11. Add Audit Helper

Create `lib/audit.ts`:

```ts
import prisma from '@/lib/db';

export async function auditLog({ tenantId, userId, action, entityType, entityId, oldValue, newValue }: any) {
  return prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}
```

Use this in every mutation.

---

## 12. Add Superadmin and Developer to Seed

```ts
const developerPassword = await hash('dev123', 12);
await prisma.user.upsert({
  where: { tenantId_username: { tenantId: tenant.id, username: 'developer' } },
  update: { passwordHash: developerPassword },
  create: {
    tenantId: tenant.id,
    name: 'Developer User',
    phone: '9000000001',
    username: 'developer',
    passwordHash: developerPassword,
    role: 'developer',
    appType: 'microlending',
    status: 'active',
  },
});

const superPassword = await hash('super123', 12);
await prisma.user.upsert({
  where: { tenantId_username: { tenantId: tenant.id, username: 'superadmin' } },
  update: { passwordHash: superPassword },
  create: {
    tenantId: tenant.id,
    name: 'Super Admin',
    phone: '9000000002',
    username: 'superadmin',
    passwordHash: superPassword,
    role: 'superadmin',
    appType: 'microlending',
    status: 'active',
  },
});
```


---

<!-- Source file: 09_TEST_STRATEGY_AND_QA_PLAN.md -->

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


---

<!-- Source file: 10_FUNCTIONAL_TEST_CASES.md -->

# Functional Test Cases

## 1. Login and Landing

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-FUNC-001 | Admin login | Login with admin credentials | Redirects to `/dashboard` |
| LT-FUNC-002 | Agent login | Login with agent credentials | Redirects to `/collection` |
| LT-FUNC-003 | Invalid login | Enter invalid password | Error is shown, no session created |
| LT-FUNC-004 | Inactive user login | Set user status inactive and login | Login blocked |
| LT-FUNC-005 | Superadmin login | Login as superadmin | Redirects to `/portal` |

---

## 2. Customer Management

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-CUST-001 | Admin creates customer | Admin opens `/customers/new`, enters details and submits | Customer created with `active` status |
| LT-CUST-002 | Agent creates customer | Agent creates customer | Customer created with `pending_review` status |
| LT-CUST-003 | Customer code generation | Create multiple customers | Codes increment based on counter |
| LT-CUST-004 | Customer list search | Search by name/phone/customer code | Matching customers shown |
| LT-CUST-005 | Route filter | Filter by route | Only that route's customers shown |
| LT-CUST-006 | Admin edits customer | Admin edits name/phone/address | Changes saved |
| LT-CUST-007 | Agent direct edit blocked | Agent attempts edit URL | Redirected or blocked |
| LT-CUST-008 | Customer profile view | Open customer detail | Loans, cheques, route and profile displayed |
| LT-CUST-009 | Agent customer scope | Agent opens customer list | Only assigned/shared route customers shown |
| LT-CUST-010 | Pending customer approval | Admin approves pending customer | Status changes to `active` |

---

## 3. Approval Workflow

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-APP-001 | Agent requests edit | Agent submits customer edit request | ApprovalRequest created with `pending` |
| LT-APP-002 | Admin approves request | Admin approves pending request | Customer changes applied |
| LT-APP-003 | Admin rejects request | Admin rejects request with notes | Request status becomes `rejected`, customer unchanged |
| LT-APP-004 | Agent views own requests | Agent opens `/approvals` | Only own requests are shown |
| LT-APP-005 | Approval audit | Approve/reject request | AuditLog entry created |

---

## 4. Loan Management

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-LOAN-001 | Create loan from customer | Admin creates loan | Loan and instalments created |
| LT-LOAN-002 | Loan code generation | Create two loans | Loan codes increment correctly |
| LT-LOAN-003 | Package selection | Select loan package | Principal, deduction, tenure and instalment populate |
| LT-LOAN-004 | Daily schedule | Create daily loan with 5 tenure | 5 instalments created for 5 dates |
| LT-LOAN-005 | Weekly schedule | Create weekly loan | Due dates are 7 days apart |
| LT-LOAN-006 | Monthly schedule | Create monthly loan | Due dates are monthly |
| LT-LOAN-007 | Mark instalment paid | Admin marks instalment paid | Instalment status paid; loan total updates |
| LT-LOAN-008 | Partial payment | Pay less than due | Instalment status partial |
| LT-LOAN-009 | Close loan | Admin closes loan | Loan status closed and closedAt set |
| LT-LOAN-010 | Agent blocked from loan | Agent opens `/loans` | Redirected to collection |

---

## 5. Collection

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-COLL-001 | Agent sees today schedule | Agent opens `/collection` | Due instalments displayed |
| LT-COLL-002 | Agent sees missed instalments | Make due date in past | Missed/past due entries displayed first |
| LT-COLL-003 | Submit full payment | Agent submits full due amount | CollectionEntry created; instalment paid |
| LT-COLL-004 | Submit partial payment | Agent submits lower amount | Instalment partial |
| LT-COLL-005 | Duplicate paid collection blocked | Try to collect paid instalment again | Error shown |
| LT-COLL-006 | Daily collection total | Submit multiple collections same day | DailyCollection totals update |
| LT-COLL-007 | Agent identity stamped | Submit collection as Agent A | CollectionEntry agentId = Agent A |
| LT-COLL-008 | Shared route access | Assign Agent A and B same route | Both agents can collect route customers |
| LT-COLL-009 | Unassigned route blocked | Agent attempts unassigned route instalment | Error / not visible |

---

## 6. Penalties

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-PEN-001 | Penalty list loads | Admin opens `/penalties` | Penalties displayed with KPIs |
| LT-PEN-002 | Filter by status | Select pending/settled/waived | Matching records shown |
| LT-PEN-003 | Route filter | Select route | Only route penalties shown |
| LT-PEN-004 | Settle penalty | Enter settlement amount | settledAmount and status update |
| LT-PEN-005 | Waive penalty | Enter waive amount | waivedAmount and status update |
| LT-PEN-006 | Agent blocked | Agent opens `/penalties` | Redirected to collection |

---

## 7. Reports

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-REP-001 | Reports load | Admin opens `/reports` | KPIs and tables load |
| LT-REP-002 | Date filter | Select date range | Reports recalculate |
| LT-REP-003 | Route filter | Select route | Reports scoped to route |
| LT-REP-004 | Agent filter | Select agent | Performance data scoped |
| LT-REP-005 | Collection efficiency | Compare due vs collected | Percentage is correct |
| LT-REP-006 | Agent blocked | Agent opens `/reports` | Redirected to collection |

---

## 8. Settings

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-SET-001 | Settings page loads | Admin opens `/settings` | No build/runtime error |
| LT-SET-002 | Create route | Admin creates route | Route appears in list |
| LT-SET-003 | Delete route | Admin deletes route | Route removed if no dependencies/blocking rules satisfied |
| LT-SET-004 | Create package | Admin creates loan package | Package appears in list |
| LT-SET-005 | Delete package | Admin deletes package | Package removed if valid |
| LT-SET-006 | Save penalty settings | Update penalty amount | Setting saved |
| LT-SET-007 | Save system settings | Update currency symbol/prefix | Setting saved and reflected |
| LT-SET-008 | Create app agent | Admin creates agent | Agent created in same app |
| LT-SET-009 | Agent blocked | Agent opens `/settings` | Redirected to collection |

---

## 9. Admin Portal

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-ADM-001 | App selector | Superadmin opens `/portal` | App cards displayed |
| LT-ADM-002 | Switch app | Select Auto Finance | Active app cookie set and dashboard scoped |
| LT-ADM-003 | Master users | Superadmin opens `/admin/users` | Users listed |
| LT-ADM-004 | Create admin | Superadmin creates admin | User created with selected app/branch |
| LT-ADM-005 | Deactivate user | Superadmin deactivates user | User cannot login |
| LT-ADM-006 | Branch management | Superadmin/developer opens `/admin/branches` | Branches listed |

---

## 10. Notifications

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-NOT-001 | Notifications page | User opens `/notifications` | App-scoped notifications shown |
| LT-NOT-002 | Mark one read | Click mark read | Only that notification marked read |
| LT-NOT-003 | Mark all read | Click mark all | Only current app notifications marked read |
| LT-NOT-004 | Unread API | Call unread count API | Returns scoped unread count |


---

<!-- Source file: 11_SECURITY_AND_RBAC_TEST_CASES.md -->

# Security and RBAC Test Cases

## 1. Access Control Tests

| Test ID | Role | Attempt | Expected Result |
|---|---|---|---|
| LT-SEC-001 | Anonymous | Open `/dashboard` | Redirect to `/login` |
| LT-SEC-002 | Agent | Open `/dashboard` | Redirect to `/collection` |
| LT-SEC-003 | Agent | Open `/loans` | Redirect to `/collection` |
| LT-SEC-004 | Agent | Open `/reports` | Redirect to `/collection` |
| LT-SEC-005 | Agent | Open `/penalties` | Redirect to `/collection` |
| LT-SEC-006 | Agent | Open `/settings` | Redirect to `/collection` |
| LT-SEC-007 | Agent | Open `/customers/new?edit=<id>` | Redirect/block; direct edit not allowed |
| LT-SEC-008 | Admin | Open `/portal` | Redirect to `/dashboard` |
| LT-SEC-009 | Admin | Open `/admin/users` | Redirect/block |
| LT-SEC-010 | Superadmin | Open `/admin/users` | Allowed |
| LT-SEC-011 | Superadmin | Open `/admin/branches` | Allowed if aligned to spec |

---

## 2. App Isolation Tests

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-APPISO-001 | Customer isolation | Create customer in Micro Lending, switch to Auto Finance | Customer not visible in Auto Finance |
| LT-APPISO-002 | Loan isolation | Create loan in Micro Lending, query in Chit Funds | Loan not visible |
| LT-APPISO-003 | Route isolation | Create route in Micro Lending | Route not visible in other apps |
| LT-APPISO-004 | Package isolation | Create package in Auto Finance | Package not visible in Micro Lending |
| LT-APPISO-005 | Notification isolation | Create notification in app A | App B user does not see it |
| LT-APPISO-006 | API customer isolation | Call `/api/customers` after app switch | Only current app customers returned |
| LT-APPISO-007 | API loan isolation | Call `/api/loans` after app switch | Only current app loans returned |

---

## 3. Branch Isolation Tests

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-BR-001 | Branch customer isolation | Branch A admin opens customers | Branch B customers not shown |
| LT-BR-002 | Branch loan isolation | Branch A admin opens loans | Branch B loans not shown |
| LT-BR-003 | Branch reports isolation | Branch A admin opens reports | Branch B totals excluded |
| LT-BR-004 | Branch route isolation | Branch A admin opens settings | Branch B routes excluded |
| LT-BR-005 | Superadmin branch view | Superadmin opens dashboard | Can view all branches within selected app |

---

## 4. Agent Route Isolation Tests

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-AG-001 | Assigned route customer visible | Assign Agent A to Route 1 | Route 1 customers visible to Agent A |
| LT-AG-002 | Unassigned route customer hidden | Customer belongs to Route 2 | Agent A cannot see customer |
| LT-AG-003 | Shared route customer visible | Assign Agent A and B to Route 1 | Both see Route 1 customer |
| LT-AG-004 | Removed agent loses access | Remove Agent B from Route 1 | Agent B no longer sees Route 1 customers |
| LT-AG-005 | Direct URL protection | Agent opens unassigned customer URL | Not found or redirected |
| LT-AG-006 | Collection protection | Agent posts unassigned instalment ID | Server returns unauthorized/error |

---

## 5. Server Action Tampering Tests

| Test ID | Attack | Expected Result |
|---|---|---|
| LT-TAMP-001 | Agent posts edit customer form with customer ID | Server blocks direct edit |
| LT-TAMP-002 | User changes hidden appType in loan form | Server ignores form appType |
| LT-TAMP-003 | User posts different tenantId if added manually | Server ignores user-provided tenantId |
| LT-TAMP-004 | Agent posts instalment ID from another route | Server blocks |
| LT-TAMP-005 | Admin deletes route from another app | Server returns access denied |
| LT-TAMP-006 | Admin deletes package from another app | Server returns access denied |
| LT-TAMP-007 | Approval request contains unsafe field like `status` | Unsafe field ignored |
| LT-TAMP-008 | Superadmin tries to create developer if not allowed | Block unless current user is developer |

---

## 6. API Security Tests

| Test ID | API | Scenario | Expected Result |
|---|---|---|---|
| LT-API-001 | `/api/customers` | No session | 401 unauthorized |
| LT-API-002 | `/api/customers` | Agent session | Only agent assigned/shared route customers |
| LT-API-003 | `/api/customers` | App switch | Current app customers only |
| LT-API-004 | `/api/loans` | Agent session | 403 or no access |
| LT-API-005 | `/api/loans` | Admin session | Current app/branch loans only |
| LT-API-006 | `/api/notifications` | No session | 401 unauthorized |
| LT-API-007 | `/api/notifications` | Valid session | Current app unread count only |

---

## 7. Data Integrity Tests

| Test ID | Scenario | Expected Result |
|---|---|---|
| LT-DATA-001 | Duplicate customer code | Database prevents duplicate per tenant |
| LT-DATA-002 | Duplicate loan code | Database prevents duplicate per tenant |
| LT-DATA-003 | Duplicate route-agent assignment | Database unique constraint prevents duplicate |
| LT-DATA-004 | Duplicate instalment number in loan | Database prevents duplicate |
| LT-DATA-005 | Collection entry linked to one instalment | Unique relation prevents duplicate mapping |
| LT-DATA-006 | Paid instalment collected again | Server blocks |
| LT-DATA-007 | Delete route with customers | Should block or handle safely based on rule |

---

## 8. Audit Log Tests

| Test ID | Action | Expected Audit |
|---|---|---|
| LT-AUD-001 | Customer create | `action=create`, `entityType=customer` |
| LT-AUD-002 | Loan create | `action=create`, `entityType=loan` |
| LT-AUD-003 | Collection submit | `action=create`, `entityType=collection` |
| LT-AUD-004 | Penalty settle | `action=update`, `entityType=penalty` |
| LT-AUD-005 | Approval approve | `action=approve`, `entityType=approval` |
| LT-AUD-006 | Approval reject | `action=reject`, `entityType=approval` |
| LT-AUD-007 | Route delete | `action=delete`, `entityType=route` |
| LT-AUD-008 | App switch | `action=switch_app`, `entityType=app` |


---

<!-- Source file: 12_E2E_UAT_SCRIPTS.md -->

# End-to-End UAT Scripts

## Script 1 — Admin Micro Lending Happy Path

**User:** Admin  
**Goal:** Validate customer onboarding, loan creation and reports.

### Steps

1. Login as `admin`.
2. Confirm landing page is `/dashboard`.
3. Go to `/settings`.
4. Create a route named `Test Route A`.
5. Create an agent named `Test Agent A`.
6. Go to `/customers/new`.
7. Create customer:
   - Name: `Test Customer A`
   - Phone: `9876500001`
   - Route: `Test Route A`
   - Agent: `Test Agent A`
8. Confirm customer profile opens.
9. Confirm customer status is `active`.
10. Click `New Loan`.
11. Create loan:
    - Principal: `10000`
    - Deduction: `1000`
    - Frequency: `daily`
    - Tenure: `5`
    - Penalty: `50`
12. Confirm loan detail opens.
13. Confirm 5 instalments are created.
14. Go to `/reports`.
15. Confirm disbursement count and amount updated.

### Expected Result

- Customer, loan and instalments are created successfully.
- Dashboard and reports reflect new data.
- Audit logs exist for customer and loan creation.

---

## Script 2 — Agent Collection Happy Path

**User:** Agent  
**Goal:** Validate field agent collection.

### Preconditions

- Agent is assigned to customer's route.
- Customer has active loan with due instalment today.

### Steps

1. Login as agent.
2. Confirm landing page is `/collection`.
3. Verify customer due instalment appears.
4. Click collect/pay action.
5. Enter received amount equal to due amount.
6. Select payment mode `cash` or `upi`.
7. Add remarks.
8. Submit.
9. Refresh collection page.
10. Login as admin.
11. Open loan detail.
12. Verify instalment is paid.
13. Verify loan total collected increased.
14. Verify daily collection total increased.

### Expected Result

- Collection entry is created.
- Instalment status changes to `paid`.
- Collecting agent ID is recorded.
- Audit log exists.

---

## Script 3 — Agent Creates Customer and Admin Approves

**User:** Agent then Admin  
**Goal:** Validate pending review workflow.

### Steps

1. Login as agent.
2. Open `/customers/new`.
3. Create customer `Pending Customer A`.
4. Confirm customer status is `pending_review`.
5. Logout.
6. Login as admin.
7. Open `/customers`.
8. Find `Pending Customer A`.
9. Click approve.
10. Confirm customer status changes to `active`.

### Expected Result

- Agent-created customer is not directly active.
- Admin approval activates customer.

---

## Script 4 — Agent Edit Request Workflow

**User:** Agent then Admin  
**Goal:** Validate customer edit approval request.

### Steps

1. Login as agent.
2. Open one assigned customer profile.
3. Click `Request Edit`.
4. Request phone/address change with reason.
5. Submit request.
6. Open `/approvals` as agent.
7. Confirm own request is visible as `pending`.
8. Logout and login as admin.
9. Open `/approvals`.
10. Review the request.
11. Approve request.
12. Open customer profile.
13. Confirm approved fields changed.

### Expected Result

- Agent cannot direct edit customer.
- Approval request is created and applied only after admin approval.
- Audit log records approval.

---

## Script 5 — Shared Route Collection

**User:** Admin, Agent A, Agent B  
**Goal:** Validate multiple agents collecting on same route.

### Steps

1. Login as admin.
2. Create route `Shared Route A`.
3. Assign Agent A and Agent B to `Shared Route A` using RouteAgent assignment.
4. Create customer under `Shared Route A`.
5. Create active loan with due instalment.
6. Login as Agent A.
7. Confirm customer appears in collection list.
8. Logout and login as Agent B.
9. Confirm same customer appears in collection list.
10. Agent B submits collection.
11. Admin opens loan detail.
12. Confirm collection entry says collected by Agent B.

### Expected Result

- Both agents can access shared route.
- Collection is stamped to actual collecting agent.

---

## Script 6 — RBAC Negative Journey

**User:** Agent  
**Goal:** Confirm agent cannot access restricted admin pages.

### Steps and Expected Results

| Step | Expected Result |
|---|---|
| Open `/dashboard` | Redirects to `/collection` |
| Open `/loans` | Redirects to `/collection` |
| Open `/reports` | Redirects to `/collection` |
| Open `/penalties` | Redirects to `/collection` |
| Open `/settings` | Redirects to `/collection` |
| Open `/admin/users` | Redirects to `/collection` or `/dashboard` based on middleware |
| Open `/customers/new?edit=<customerId>` | Blocked/redirected; no direct edit |

---

## Script 7 — App Switching and App Isolation

**User:** Super Admin  
**Goal:** Validate app switching and data isolation.

### Steps

1. Login as superadmin.
2. Confirm `/portal` opens.
3. Select Micro Lending.
4. Create or verify Micro Lending customer.
5. Return to `/portal`.
6. Select Auto Finance.
7. Open customers/loans/dashboard.
8. Confirm Micro Lending data is not visible.
9. Return to `/portal`.
10. Select Chit Funds.
11. Confirm app-specific data scope.

### Expected Result

- Active app changes based on selected app.
- Data is scoped to selected app.
- No cross-app customer/loan/package/route leakage.

---

## Script 8 — Penalty Settlement

**User:** Admin  
**Goal:** Validate penalty settlement and waiver.

### Steps

1. Prepare a loan with pending penalty.
2. Login as admin.
3. Open `/penalties`.
4. Filter by pending.
5. Select penalty and enter settlement amount.
6. Submit.
7. Confirm status updates to `settled` or `partial`.
8. Test waive flow for another penalty.

### Expected Result

- Penalty amounts update correctly.
- Status updates correctly.
- Audit log is created.

---

## Script 9 — Settings and Package Configuration

**User:** Admin  
**Goal:** Validate configurable settings.

### Steps

1. Login as admin.
2. Open `/settings`.
3. Update currency symbol.
4. Update customer code prefix.
5. Create a loan package.
6. Create a route.
7. Create an agent.
8. Create customer and verify new prefix/package availability.

### Expected Result

- Settings persist.
- New prefix/package/route is used by later forms.
- Agent is created in same app.

---

## Script 10 — Production Smoke Test

Run after deployment:

1. Open login page.
2. Login as admin.
3. Dashboard loads.
4. Customer list loads.
5. Loan list loads.
6. Collection page loads.
7. Reports page loads.
8. Settings page loads.
9. Logout.
10. Login as agent.
11. Agent lands on collection page.
12. Agent cannot open restricted pages.

Expected result: no runtime errors, redirects correct, data visible only within scope.


---

<!-- Source file: 13_RELEASE_READINESS_CHECKLIST.md -->

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


---

<!-- Source file: 14_CODEX_IMPLEMENTATION_PROMPT.md -->

# Codex Implementation Prompt

Use this prompt in Codex or an AI coding agent to implement the remaining work safely.

---

## Prompt

You are working on a Next.js + Prisma + MySQL application named **LoanTrack**.

The project uses:

- Next.js 16 App Router
- React 19
- Prisma 5.22
- MySQL
- NextAuth v5 credentials login
- Server Actions
- Custom CSS

The application is a multi-app loan management system with these app types:

- `microlending`
- `autofinance`
- `chitfunds`

The application uses a shared database with row-level isolation. Every query and mutation must be scoped by:

```text
tenantId + appType
```

For Micro Lending admins, branch isolation must also apply using session `branchId`.

Agents must only see customers and collections for their assigned/shared routes.

---

## Current Critical Issue to Fix First

Fix build issue in:

```text
app/(dashboard)/settings/page.tsx
```

`userRole` is referenced before declaration. Add:

```ts
const userRole = (session?.user as any)?.role;
```

after:

```ts
const session = await auth();
```

Then run:

```bash
npm run build
```

---

## Work Package 1 — RBAC and Middleware

Update `middleware.ts` to follow this access matrix:

- `/portal`, `/admin/*` → developer and superadmin only.
- `/dashboard`, `/loans`, `/penalties`, `/reports`, `/settings` → admin, superadmin, developer only.
- `/collection`, `/notifications` → admin, superadmin, developer, agent.
- `/customers` → admin, superadmin, developer, agent, but agent read-only and scoped.
- `/customers/new` → agent can create, but cannot edit using `?edit=`.
- `/approvals` → admin/superadmin/developer can review; agent can view own requests.

Add server-side checks too. Do not rely only on middleware.

---

## Work Package 2 — Notification App Isolation

Add `appType` to `SystemNotification` in Prisma schema.

Update:

- `app/(dashboard)/notifications/page.tsx`
- `app/(dashboard)/notifications/actions.ts`
- `app/api/notifications/route.ts`
- seed data if needed

Rules:

- Notifications must be filtered by `tenantId + appType`.
- Unread count API must require authentication.
- Mark one and mark all read must update only current app notifications.

Create and run migration:

```bash
npx prisma migrate dev --name add-notification-app-type
npx prisma generate
```

---

## Work Package 3 — Harden API Routes

Update:

- `app/api/customers/route.ts`
- `app/api/loans/route.ts`
- `app/api/notifications/route.ts`

Rules:

- Require auth.
- Apply `tenantId + appType` filters.
- Apply branch filter for Micro Lending admin.
- Apply agent route filter for customer API.
- Block agent from loan API.

---

## Work Package 4 — RouteAgent Shared Route Collection

`RouteAgent` already exists in schema. Make it functional.

Implement:

1. Helper `getAgentRouteIds(agentId)`.
2. Settings UI for assigning multiple agents to a route.
3. Collection page query using RouteAgent route IDs.
4. Collection submit validation to ensure agent is assigned to route.
5. Reports should show actual collecting agent.

Acceptance criteria:

- Agent A and Agent B can both be assigned to Route X.
- Both can see Route X customers.
- Either can collect.
- Collection entry records actual collecting agent ID.

---

## Work Package 5 — Customer Agent Read-Only and Approval Flow

Update customer pages:

- Agent can view only assigned/shared route customers.
- Agent cannot see `Edit` or `New Loan` buttons.
- Agent sees `Request Edit` button.
- Request edit creates ApprovalRequest.
- Admin can approve/reject.
- Approval applies only allowed fields: `name`, `phone`, `address`, `routeId`.
- Approval/rejection is audit logged.

---

## Work Package 6 — Harden Loan Creation

Update `app/(dashboard)/loans/actions.ts`:

- Do not read `appType` from form.
- Use `getUserAppType()` only.
- Block agent role.
- Validate customer belongs to same tenant/app and is active.
- Validate package belongs to same tenant/app.
- Add branch check for Micro Lending admin.
- Add audit log.

---

## Work Package 7 — Complete Audit Logging

Create helper:

```text
lib/audit.ts
```

Add audit logging to all mutations:

- Customer create/update.
- Customer approval/rejection.
- Loan create/close.
- Collection submit.
- Penalty settle/waive.
- Settings save.
- Route create/delete.
- Loan package create/delete.
- User create/update/deactivate.
- Branch create.
- App switch.

---

## Work Package 8 — Seed Users

Update `prisma/seed.ts` to create:

| Username | Password | Role |
|---|---|---|
| `developer` | `dev123` | developer |
| `superadmin` | `super123` | superadmin |
| `admin` | `admin123` | admin |
| `karthik` | `agent123` | agent |

Use bcrypt cost 12 consistently.

---

## Work Package 9 — Testing

After implementation, run:

```bash
npx prisma validate
npm run lint
npm run build
```

Then manually test:

1. Admin login and dashboard.
2. Agent login and collection.
3. Customer create by admin.
4. Customer create by agent and admin approval.
5. Loan create and instalment generation.
6. Collection entry and loan total update.
7. Reports.
8. Agent blocked from restricted pages.
9. App switching and app isolation.
10. Shared route collection.

Add automated Playwright tests if possible.

---

## Important Rules

- Do not introduce a new UI framework unless required.
- Keep current CSS style system.
- Keep TypeScript strictness reasonable.
- Do not trust tenantId, appType, role or agentId from form inputs.
- Prefer `findFirst` with full `tenantId + appType` ownership filter when validating records.
- Return generic not found/access denied messages to avoid data leakage.
- Keep changes incremental and run build after each major work package.
