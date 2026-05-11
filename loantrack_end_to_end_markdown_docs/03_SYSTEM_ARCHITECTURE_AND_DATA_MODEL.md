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
