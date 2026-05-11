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
