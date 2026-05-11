# LoanTrack — Complete System Specification

> Last Updated: 2026-05-11 | Version: 1.2

---

## 1. Database Strategy

### Decision: Shared Database with Row-Level Isolation

| Approach | Pros | Cons |
|----------|------|------|
| **Shared DB** ✅ | Simple ops, lower cost, easy cross-tenant reporting | Requires strict `tenantId` discipline |
| Separate DB | Full isolation, easy backup per tenant | Complex connection management, expensive |

Every query MUST include `tenantId` + `appType`. Enforced at helper level (`getDefaultTenantId()`, `getUserAppType()`), never at component level.

---

## 2. Role Hierarchy

```
Super Admin (developer access only — cannot be created from UI)
├── Micro Lending
│   ├── Branch A
│   │   ├── Branch Admin (sees only Branch A data)
│   │   ├── Field Agent 1 (collection + customer creation)
│   │   └── Field Agent 2 (can share routes with Agent 1)
│   └── Branch B
│       ├── Branch Admin
│       └── Field Agent 3
├── Auto Finance
│   ├── Admin (flat, no branches)
│   ├── Field Agent 4
│   └── Field Agent 5
└── Chit Funds
    ├── Admin (flat, no branches)
    ├── Field Agent 6
    └── Field Agent 7
```

### Role Definitions

| Role | Code | Scope | Created By |
|------|------|-------|------------|
| Super Admin | `superadmin` | All apps, all branches | DB seed / developer only |
| Admin | `admin` | Single `appType`, single `branchId` (ML only) | Super Admin via Master User Mgmt |
| Field Agent | `agent` | Single `appType`, assigned routes (shareable) | Admin or Super Admin |
| Borrower | `borrower` | Self-service (future) | System auto-create |

---

## 3. Field Agent — Complete Capability Document

### 3.1 What Agents CAN Do

| Capability | Details |
|-----------|---------|
| **Create Customers** | Agent can register new customers in the field. `createdByAgentId` is auto-set. Customer is created with `status: 'pending_review'` until Admin approves. |
| **View Collection Schedule** | Agent sees today's due collections, missed/overdue instalments, and upcoming week's schedule. |
| **Submit Collection Entries** | Agent records payment with amount, payment mode, remarks. Agent's `userId`, `name`, and `timestamp` are auto-recorded. |
| **View Own Customers** | Agent can see profile and loan details of customers on their assigned routes. |
| **Share Routes** | Multiple agents can be assigned to the same route/area. Any agent assigned to a route can collect from any customer on that route. |
| **View Notifications** | System alerts for overdue customers, upcoming closures. |

### 3.2 What Agents CANNOT Do

| Restriction | Enforcement |
|------------|-------------|
| **Edit Customers** | After creation, agents cannot modify customer data. Must raise an **Approval Request** for Admin to review. |
| **Delete Anything** | No delete capability on any entity. |
| **Create/Edit Loans** | Loan creation is Admin-only. |
| **View Dashboard** | Redirected to `/collection` instead. |
| **View Reports** | No access. |
| **View Penalties** | No access. |
| **Access Settings** | No access. |
| **Create Users** | No access. |
| **Switch Applications** | No portal access. |

### 3.3 Approval Request Flow

```
Agent creates customer → status = 'pending_review'
Agent wants to edit → submits ApprovalRequest {
  requestType: 'customer_edit',
  entityId: customerId,
  requestedChanges: JSON (field → new value),
  reason: string,
  status: 'pending'
}
Admin sees pending requests → Reviews → Approves or Rejects
If approved → changes applied, status = 'approved'
If rejected → status = 'rejected', reason logged
```

### 3.4 Collection Entry — Agent Tracking

Every collection entry records:

| Field | Source | Purpose |
|-------|--------|---------|
| `agentId` | Auto from session | Which agent collected |
| `agentName` | Resolved from User | Display in ledger |
| `submittedAt` | `new Date()` auto | Exact timestamp of collection |
| `paymentMode` | Agent input | cash / upi / cheque / bank_transfer |
| `geoLocation` | Device GPS (future) | Location verification |
| `remarks` | Agent input | Optional notes |
| `collectionId` | Auto | Links to DailyCollection ledger |

### 3.5 Shared Route Collection

- Multiple agents can be assigned to the **same route**.
- Route assignment is stored in a **many-to-many** relation (new `RouteAgent` model).
- When an agent opens Collection, they see all customers on **all their assigned routes**.
- If Agent A and Agent B both have Route "Town Center", either can collect from any customer on that route.
- The **collecting agent's identity** is always recorded — not the "assigned" agent.
- Dashboard shows: "Collected by: Agent A at 2:35 PM" regardless of who is the primary assigned agent.

### 3.6 Agent's Collection Dashboard

The agent's `/collection` page shows:

| Section | Content |
|---------|---------|
| **Summary Bar** | Total Expected Today, Total Collected, Remaining, Collection Rate % |
| **Today's Schedule** | Table: Customer Name, Loan Code, Due Amount, Status (Pending/Collected), Action Button |
| **Missed/Overdue** | Instalments past due date that are still unpaid — shown at the top with red highlight |
| **Collection History** | Last 7 days of the agent's submissions with timestamps |

---

## 4. Per-Page Access Matrix

| Page / Route | `superadmin` | `admin` | `agent` | Notes |
|---|---|---|---|---|
| `/portal` | ✅ | ❌ → dashboard | ❌ → collection | App selector |
| `/dashboard` | ✅ | ✅ | ❌ → collection | KPIs scoped by appType+branchId |
| `/customers` | ✅ | ✅ | ✅ (read-only, own routes) | Agent sees only assigned route customers |
| `/customers/new` | ✅ | ✅ | ✅ (create only) | Agent-created = `pending_review` status |
| `/customers/[id]` | ✅ | ✅ | ✅ (read-only) | Agent cannot see edit button |
| `/customers/new?edit=` | ✅ | ✅ | ❌ | Agent must use approval request |
| `/loans` | ✅ | ✅ | ❌ | |
| `/loans/new` | ✅ | ✅ | ❌ | |
| `/loans/[id]` | ✅ | ✅ | ❌ | |
| `/collection` | ✅ | ✅ | ✅ | Agent's primary page |
| `/penalties` | ✅ | ✅ | ❌ | |
| `/reports` | ✅ | ✅ | ❌ | |
| `/notifications` | ✅ | ✅ | ✅ | Filtered by appType |
| `/settings` | ✅ | ✅ | ❌ | Admin manages own app config |
| `/admin/users` | ✅ | ❌ | ❌ | Master User Management |
| `/admin/branches` | ✅ | ❌ | ❌ | Branch CRUD (ML only) |
| `/approvals` | ❌ | ✅ | ❌ (can view own) | Admin reviews agent requests |

---

## 5. Per-Action Permission Matrix

| Server Action | `superadmin` | `admin` | `agent` | Validation |
|---|---|---|---|---|
| `saveCustomer` | ✅ | ✅ | ✅ (create only) | Agent: status='pending_review', edit blocked |
| `requestCustomerEdit` | ❌ | ❌ | ✅ | Creates ApprovalRequest |
| `approveRequest` | ✅ | ✅ | ❌ | Applies changes if approved |
| `createLoan` | ✅ | ✅ | ❌ | Customer must belong to same appType |
| `submitCollectionEntry` | ✅ | ✅ | ✅ | Records agentId + timestamp |
| `createRoute` | ✅ | ✅ | ❌ | appType auto-injected |
| `createLoanPackage` | ✅ | ✅ | ❌ | appType auto-injected |
| `createUser` | ✅ | ✅ (agents only) | ❌ | Admin: can only create role=agent in own app |
| `deleteRoute` | ✅ | ✅ | ❌ | Must verify tenantId+appType ownership |
| `deleteLoanPackage` | ✅ | ✅ | ❌ | Must verify tenantId+appType ownership |
| `saveSystemSettings` | ✅ | ✅ | ❌ | Tenant-level |
| `savePenaltySettings` | ✅ | ✅ | ❌ | Tenant-level |
| `selectApp` | ✅ | ❌ | ❌ | Cookie-based app switch |
| `createBranch` | ✅ | ❌ | ❌ | ML appType only |
| `manageMasterUser` | ✅ | ❌ | ❌ | Full user CRUD across all apps |

---

## 6. Configuration-Driven Design (No Hardcoded Values)

### 6.1 Tenant Settings via `AppSetting` Table

| Key | Group | Default | Description |
|-----|-------|---------|-------------|
| `app_name` | system | `LoanTrack` | Display name |
| `currency` | system | `INR` | Currency code |
| `currency_symbol` | system | `₹` | Currency symbol |
| `timezone` | system | `Asia/Kolkata` | Timezone |
| `date_format` | system | `dd MMM yyyy` | Date display format |
| `customer_code_prefix` | system | `CUS` | Customer code prefix |
| `customer_code_counter` | system | `0` | Auto-increment counter |
| `loan_code_prefix` | system | `LN` | Loan code prefix |
| `loan_code_counter` | system | `0` | Auto-increment counter |
| `default_penalty_per_day` | penalty | `50` | Penalty per missed day |
| `penalty_grace_period` | penalty | `0` | Grace days before penalty |
| `penalty_max_cap` | penalty | `0` | Max cap (0=unlimited) |
| `midnight_cutoff` | collection | `true` | Auto-mark missed at midnight |
| `allow_weekend_collection` | collection | `false` | Weekend collection toggle |
| `require_agent_approval` | workflow | `true` | Agent-created customers need approval |
| `collection_edit_window_minutes` | collection | `30` | Minutes agent can edit a submitted entry |

### 6.2 Status Enums (Referenced, never hardcoded)

| Entity | Valid Statuses |
|--------|---------------|
| User | `active`, `inactive`, `suspended` |
| Customer | `active`, `pending_review`, `overdue`, `closed`, `blacklisted` |
| Loan | `active`, `overdue`, `closed`, `settled` |
| Instalment | `upcoming`, `paid`, `missed`, `partial` |
| Penalty | `pending`, `settled`, `waived`, `partial` |
| Route | `active`, `inactive` |
| DailyCollection | `open`, `locked` |
| ApprovalRequest | `pending`, `approved`, `rejected` |
| Branch | `active`, `inactive` |
| Tenant | `active`, `suspended` |

---

## 7. Isolation Rules

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | Every query includes `tenantId` + `appType` | Via `getDefaultTenantId()` + `getUserAppType()` |
| 2 | Every write sets `tenantId` + `appType` from session, never from user input | Server action level |
| 3 | ML Admin queries also filter by `branchId` from session | Query level |
| 4 | No action may operate on entity with different `appType` | Verified before mutation |
| 5 | Delete actions verify entity ownership (tenantId+appType+branchId) | Before `prisma.delete()` |
| 6 | Agent sees only customers on their assigned routes | Route-based query filter |
| 7 | Agent's `userId` auto-stamped on every collection entry | From session, never from form |
| 8 | Agent cannot edit customer after initial creation | Role check in `saveCustomer` |
| 9 | Super Admin has no `branchId` filter (global view within selected app) | Conditional in query builders |
| 10 | Cross-app data is treated as "not found" (no information leakage) | Return 404, don't expose app boundary |

---

## 8. New Schema Required

### 8.1 ApprovalRequest (NEW)

```
ApprovalRequest {
  id              String   @id @default(cuid())
  tenantId        String
  appType         String
  requestType     String   // customer_edit | customer_delete | loan_edit
  entityType      String   // customer | loan
  entityId        String
  requestedById   String   // agent userId
  requestedChanges String  @db.Text  // JSON: { field: newValue }
  reason          String?  @db.Text
  status          String   @default("pending")  // pending | approved | rejected
  reviewedById    String?  // admin userId
  reviewedAt      DateTime?
  reviewNotes     String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 8.2 RouteAgent (NEW — many-to-many for shared routes)

```
RouteAgent {
  id        String   @id @default(cuid())
  routeId   String
  agentId   String
  isPrimary Boolean  @default(false)  // primary agent for this route
  assignedAt DateTime @default(now())

  @@unique([routeId, agentId])
}
```

### 8.3 Vehicle (Phase 2 — Auto Finance)

```
Vehicle {
  id              String   @id @default(cuid())
  tenantId        String
  appType         String   @default("autofinance")
  customerId      String
  registrationNo  String
  make            String
  model           String
  year            Int
  color           String?
  engineNo        String?
  chassisNo       String?
  insuranceExpiry DateTime?
  rcDocPath       String?
  status          String   @default("active")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 8.4 Chit Fund Models (Phase 3)

```
ChitGroup {
  id                  String   @id @default(cuid())
  tenantId            String
  appType             String   @default("chitfunds")
  groupCode           String
  name                String
  totalValue          Decimal
  monthlyContribution Decimal
  duration            Int      // months
  memberCount         Int
  startDate           DateTime
  status              String   @default("active")
}

ChitMember {
  id          String   @id @default(cuid())
  groupId     String
  customerId  String
  ticketNo    Int
  joinedAt    DateTime @default(now())
  status      String   @default("active")
}

ChitAuction {
  id                String   @id @default(cuid())
  groupId           String
  monthNo           Int
  winnerMemberId    String
  bidAmount         Decimal
  dividendPerMember Decimal
  auctionDate       DateTime
  status            String   @default("completed")
}

ChitSubscription {
  id       String   @id @default(cuid())
  memberId String
  monthNo  Int
  amount   Decimal
  paidAt   DateTime?
  status   String   @default("pending")
}
```

---

## 9. Security Gaps in Current Code (Must Fix)

| # | Gap | Severity | File | Fix |
|---|-----|----------|------|-----|
| 1 | `/penalties` no `appType` filter | HIGH | penalties/page.tsx | Add `getUserAppType()` |
| 2 | `/reports` no `appType` filter | HIGH | reports/page.tsx | Add `getUserAppType()` |
| 3 | `/notifications` no `appType` filter | MEDIUM | notifications/page.tsx | Add filter |
| 4 | `/customers/new` queries lack `appType` | HIGH | customers/new/page.tsx | Add to route/agent queries |
| 5 | `/loans/new` queries lack `appType` | HIGH | loans/new/page.tsx | Add to all queries |
| 6 | `deleteRoute` no ownership check | HIGH | settings/actions.ts | Verify before delete |
| 7 | `deleteLoanPackage` no ownership check | HIGH | settings/actions.ts | Verify before delete |
| 8 | `submitCollectionEntry` no `appType` on DailyCollection | MEDIUM | collection/actions.ts | Add appType |
| 9 | `settings/page.tsx` missing import | CRITICAL | settings/page.tsx | Add `getUserAppType` import |
| 10 | No middleware for route-level auth | MEDIUM | middleware.ts (new) | Create Next.js middleware |

---

## 10. Implementation Phases

### Phase 0: Fix Security Gaps (Section 9) — 1 day

### Phase 1: Master User Management + Permissions — 5 days
- Master user list page (`/admin/users`)
- Create/edit/deactivate users with app+branch assignment
- Branch management (`/admin/branches`, ML only)
- Next.js middleware for route-level auth
- Approval request system for agent edits
- Shared route assignment (RouteAgent model)

### Phase 2: Auto Finance Module — 7 days
- Vehicle schema + CRUD
- EMI loan templates
- Repo flagging (90+ day overdue)
- AF-specific dashboard
- Document vault

### Phase 3: Chit Fund Module — 10 days
- ChitGroup, ChitMember, ChitAuction, ChitSubscription schema
- Group lifecycle management
- Monthly auction flow
- Dividend calculator
- Subscription ledger

### Phase 4: Production Readiness — 10 days
- File upload service (local → S3)
- Subscription billing (Razorpay/Stripe)
- Tenant self-service onboarding
- Rate limiting, password policy
- Data export (CSV/PDF)

---

## 11. Error Handling Standards

| Scenario | Response |
|----------|----------|
| Not authenticated | `redirect('/login')` |
| Not authorized (wrong role) | `redirect('/dashboard')` or `redirect('/collection')` |
| Entity not found | `redirect` to list page |
| Entity belongs to different app/tenant | Treat as "not found" (no info leak) |
| Validation failure | Return `{ success: false, error: 'message' }` |
| Database error | Log to AuditLog, return generic error |

---

## 12. Audit Logging Rules

Every mutation MUST log to `AuditLog`:
- `tenantId` — from session
- `userId` — from session
- `action` — `create`, `update`, `delete`, `login`, `logout`, `switch_app`, `approve`, `reject`
- `entityType` — `customer`, `loan`, `collection`, `penalty`, `user`, `route`, `package`, `branch`, `approval`
- `entityId` — the affected record's ID
- `newValue` — JSON snapshot of key changed fields
- `oldValue` — for updates, JSON of previous values

---

## 13. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (App Router, Server Actions, Turbopack) |
| ORM | Prisma 5.22 (MySQL, schema-first) |
| Database | MySQL 8 (single DB, multi-tenant) |
| Auth | NextAuth v5 (JWT, role+appType in token) |
| Styling | Vanilla CSS (design system in globals.css) |
| Icons | Material Icons Outlined |
| Fonts | Inter (Google Fonts) |

---

## 14. Subscription Model (Future)

| Tier | Apps | Branches | Users | Features |
|------|------|----------|-------|----------|
| Starter | 1 app | 1 | 5 | Core features |
| Professional | 2 apps | 3 | 15 | Reports, Export |
| Enterprise | All 3 | Unlimited | Unlimited | API, White-label |

Enforced via `Tenant.plan` field + middleware checks on feature access.
