> **SUPERSEDED — do not follow.** This file was auto-generated and has drifted from the codebase.
> The current, binding reference is `ENGINEERING_REFERENCE.md` at the repo root. Kept only as history.

# ARCHITECTURE.md — System Design & Data Flow

> Auto-generated from `loanapp` codebase analysis

---

## System Overview

ZoloFund is a **multi-tenant SaaS** micro-lending management platform supporting three vertical applications:
1. **Micro Lending** — Loans, collections, penalties, customers, routes
2. **Auto Finance** — Vehicle financing, EMI tracking, repo flagging
3. **Chit Funds** — Group chits, auctions, member subscriptions

All three apps share a **single MySQL database** with **row-level tenant isolation**.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Client                      │
│  (Subdomain routing: tenant.domain.com)                  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Next.js Middleware                     │
│  - Tenant slug extraction from subdomain                 │
│  - Auth token validation (NextAuth JWT)                  │
│  - Role-based route protection                           │
│  - Header injection (x-zolofund-tenant-slug)            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  App Router (Next.js 16)                 │
│  ┌──────────┬──────────┬──────────┬──────────────────┐  │
│  │ /(dash)  │ /admin   │/borrower │ /api/* (routes)  │  │
│  │ Dashboard│ Superadm │ Self-svc │ REST endpoints   │  │
│  │ Collection│ in only │ portal   │ Webhooks, Cron   │  │
│  │ Customers│ Billing  │          │                  │  │
│  │ Loans    │ Users    │          │                  │  │
│  │ Penalties│ Branches │          │                  │  │
│  │ Reports  │          │          │                  │  │
│  │ Settings │          │          │                  │  │
│  │ Chits    │          │          │                  │  │
│  │ Vehicles │          │          │                  │  │
│  └──────────┴──────────┴──────────┴──────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Server Actions / Lib                   │
│  - lib/auth.ts         (NextAuth config, 2FA)            │
│  - lib/tenant.ts       (Tenant resolution, settings)     │
│  - lib/db.ts           (Prisma singleton)                │
│  - lib/repayments.ts   (Payment allocation logic)        │
│  - lib/penalties.ts    (Penalty calculation)             │
│  - lib/rateLimit.ts    (MySQL-backed rate limiting)      │
│  - lib/subscription.ts (Tenant subscription checks)      │
│  - lib/razorpay.ts     (Payment gateway integration)     │
│  - lib/fileUpload.ts   (File handling with sharp)        │
│  - lib/sms.ts          (SMS notifications)               │
│  - lib/i18n.ts         (Internationalization)            │
│  - lib/logger.ts       (Structured JSON logging)         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Prisma ORM (MySQL)                     │
│  25+ models: Tenant, User, Customer, Loan, Instalment,   │
│  Penalty, DailyCollection, CollectionEntry, Vehicle,     │
│  ChitGroup, ChitMember, ChitAuction, ChitSubscription,   │
│  Route, RouteAgent, ApprovalRequest, AuditLog,           │
│  TenantSubscription, BillingInvoice, RateLimit,          │
│  WebhookEvent, Payment, PaymentAllocation, etc.          │
└─────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy Model

### Subdomain-Based Tenant Resolution

```
tenant-a.domain.com  →  Tenant(slug='tenant-a')
tenant-b.domain.com  →  Tenant(slug='tenant-b')
localhost            →  Fallback to Tenant(slug='default')
```

**Flow:**
1. Middleware extracts slug from `Host` header
2. Slug resolved to `Tenant.id` via DB lookup
3. `x-zolofund-tenant-slug` header injected
4. Server-side code uses `getCurrentTenantId()` (cached per request)
5. All queries filtered by `tenantId` + `appType`

### Isolation Rules

| Rule | Enforcement |
|------|------------|
| Every query includes `tenantId` + `appType` | Via `getDefaultTenantId()`, `getUserAppType()` |
| Writes set `tenantId` + `appType` from session | Server action level, never from user input |
| ML Admin queries also filter by `branchId` | From session context |
| Cross-app data returns 404 | No information leakage |

---

## Role Hierarchy & Access Control

```
superadmin / developer
  ├── Can access all apps via /portal app selector
  ├── Can switch app context (cookie: active_app_type)
  └── Bypasses tenant host matching
       │
       ├── admin
       │   ├── Scoped to single appType + branchId
       │   ├── Can create agents, loans, routes, packages
       │   ├── Reviews agent approval requests
       │   └── Blocked from /portal, /admin
       │
       └── agent
           ├── Primary page: /collection
           ├── Can create customers (pending_review status)
           ├── Can submit collection entries
           ├── Cannot edit customers (approval request flow)
           ├── Cannot access /dashboard, /loans, /penalties, /reports, /settings
           └── Redirected to /collection for blocked routes
```

**Middleware enforcement** (`middleware.ts`):
- Public paths: `/login`, `/_next`, `/api`, `/assets`, `/fonts`, `/favicon.ico`
- Auth required for all other paths
- Role-based redirects for agent/admin boundaries
- `SUPERADMIN_ONLY`: `/portal`, `/admin`

---

## Authentication Flow

```
1. User visits tenant.domain.com/login
2. Enters username/phone + password (+ TOTP if enabled)
3. NextAuth Credentials provider:
   a. Rate limit check (MySQL-backed, per-IP + per-user)
   b. Tenant resolution from Host header
   c. User lookup (tenant-scoped)
   d. bcrypt password comparison
   e. TOTP verification (if totpSecret set)
   f. Update lastLoginAt
4. JWT token created with: role, appType, tenantId, branchId, userId
5. Token stored in secure HTTP-only cookie
6. Middleware validates token on each request
```

**Session durations:**
- Without "Remember Me": 24 hours
- With "Remember Me": 30 days

---

## Data Flow: Collection Entry

```
Agent opens /collection
  → middleware validates auth + role
  → page loads via Server Component
  → getCurrentTenantId() + getUserAppType() resolve context
  → Query: DailyCollection for today + agent's route-assigned customers
  → Agent submits collection entry (Server Action)
  → Action validates: tenantId, appType, agentId from session
  → Creates CollectionEntry + updates Instalment + DailyCollection totals
  → AuditLog entry created
  → Response returned to client
```

---

## Approval Request Flow

```
Agent wants to edit customer
  → Cannot edit directly (blocked in saveCustomer action)
  → Submits ApprovalRequest via Server Action
  → Request: { requestType, entityType, entityId, requestedChanges (JSON), reason }
  → Admin views pending requests at /approvals
  → Admin approves or rejects
  → If approved: changes applied to entity, status = 'approved'
  → If rejected: status = 'rejected', reason logged
  → AuditLog entry created
```

---

## Subscription & Billing

```
TenantSubscription model enforces plan limits:
  - plan: trial | starter | professional | enterprise
  - maxActiveLoans, maxAgents limits
  - enabledModules (JSON)
  - razorpaySubId for recurring billing
  - gracePeriodEnd for payment delays

BillingInvoice model tracks:
  - amount, tax, total
  - status: pending | paid
  - razorpayId, invoiceUrl
  - billingPeriod

assertTenantSubscriptionAccess() called on every request
  (except /subscription, /portal, /admin paths)
```

---

## Webhook Processing

```
Razorpay webhooks → /api/webhooks/razorpay
  → WebhookEvent idempotency check (provider + eventId unique)
  → Signature verification
  → Event type routing (subscription events)
  → Update TenantSubscription status
  → Create/update BillingInvoice
```

---

## Cron Jobs

```
Penalty accrual cron → /api/cron/penalties
  → CronLock prevents concurrent execution
  → Finds overdue instalments past grace period
  → Calculates penalty based on settings
  → Creates Penalty records
  → Updates Instalment.penaltyApplied flag

Rate limit cleanup → /api/cron/cleanup
  → Deletes expired RateLimit rows
```

---

## Security Headers

| Header | Value |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |
| CSP | default-src 'self', script-src 'self' 'unsafe-inline' 'unsafe-eval', ... |
| Cache-Control (login) | no-store, no-cache, must-revalidate, proxy-revalidate |
