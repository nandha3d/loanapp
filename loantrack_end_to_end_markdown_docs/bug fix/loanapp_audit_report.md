# LoanTrack — Full Codebase Audit Report
**Audited:** May 2026 | **Stack:** Next.js 14+ (App Router), Prisma ORM, MySQL, NextAuth.js, TypeScript

---

## Executive Summary

This is a **genuinely solid foundation** for a multi-tenant micro-lending SaaS. The architecture is well-thought-out, the schema is production-grade, and the code is clean and readable. It is well beyond "MVP" in terms of breadth — covering microlending, auto finance, and chit funds across a multi-tenant model with role-based access, an approval workflow, penalty accrual, and i18n. However, it is **not yet production-ready as a subscription SaaS** — specifically in billing automation, security hardening, data isolation, and several operational gaps. Those are the priority areas before go-live.

---

## Overall Ratings

| Dimension | Score | Grade |
|---|---|---|
| Architecture & Code Quality | 8.5/10 | ★★★★☆ |
| Data Model & Schema | 8/10 | ★★★★☆ |
| Security & Auth | 5.5/10 | ★★★☆☆ |
| Subscription / Billing | 4/10 | ★★☆☆☆ |
| Feature Completeness | 7/10 | ★★★★☆ |
| Multi-tenancy & Isolation | 5/10 | ★★★☆☆ |
| Observability & Ops | 4.5/10 | ★★☆☆☆ |
| UI/UX | 7/10 | ★★★★☆ |
| **Overall** | **6.2/10** | **★★★☆☆** |

---

## 1. Architecture & Code Quality — 8.5/10

**What's Good:**
- Clean Next.js App Router structure with well-separated Server Components and Client Components
- Server Actions (`actions.ts`) per feature — good pattern for form mutations
- Centralized auth context via `requireApiContext()` in `lib/apiAuth.ts` — consistent across all API routes
- `lib/tenant.ts` properly uses React `cache()` for request-scoped tenant ID resolution
- Audit logging built into auth (login events) and actions — shows production maturity
- Multi-language support (English, Hindi, Tamil) via `i18n/` — impressive for a v1
- `appType` column on most entities cleanly separates microlending/autofinance/chitfunds data

**Issues:**
- **Critical:** `getDefaultTenantId()` always fetches the `slug: 'default'` tenant — this means the entire app is **single-tenant at runtime** despite a multi-tenant schema. All API routes and server actions call this one function instead of resolving tenant from subdomain, header, or JWT. This is a fundamental flaw for a SaaS with multiple customers.
- Type casting with `(session.user as any)` is scattered across 15+ files — a proper extended session type in `types/next-auth.d.ts` exists but isn't fully utilized
- `any` type used extensively in dashboard and report data fetching — defeats TypeScript benefits
- No shared Zod/validation schemas — form validation is ad hoc

---

## 2. Data Model & Schema — 8/10

**What's Good:**
- Proper `Tenant → Branch → User/Customer/Loan` hierarchy
- Decimal types correctly used for all money fields (`Decimal @db.Decimal(12,2)`) — no float precision bugs
- `AuditLog` model is comprehensive with IP address, user agent, old/new values
- `ApprovalRequest` workflow with requester/reviewer separation is well-designed
- `TenantSubscription` model has `razorpaySubId`, `trialEndsAt`, `currentPeriodEnd` — subscription-aware
- `ChitGroup`, `ChitMember`, `ChitAuction`, `ChitSubscription` — complete chit fund model
- Proper indexes on all foreign keys and frequently-queried columns

**Issues:**
- `enabledModules` stored as a comma-separated string in `TenantSubscription` — should be a separate `TenantModule` table or JSON column for cleaner querying
- `Penalty` model has no `instalmentId` — can't trace which specific instalment triggered a penalty
- No `Payment` or `Transaction` model — payments are embedded in `CollectionEntry` and `Instalment`. This makes reconciliation and refunds complex to implement later
- `Customer.userId` is unique but nullable — the link between a borrower's login and their customer record is fragile
- `SecurityCheque` has no `loanId` — cheques can't be directly tied to a specific loan disbursement
- No `LoanInterestSchedule` or amortization table — interest is calculated as a flat deduction at origination, which limits flexibility for reducing-balance products

---

## 3. Security & Auth — 5.5/10

**Critical Issues (Fix Before Launch):**

1. **No tenant isolation in API routes.** `requireApiContext()` resolves tenantId from `getDefaultTenantId()` (slug lookup) rather than from the authenticated user's JWT `tenantId` field. A user from Tenant A could potentially query Tenant B's data if they know the API structure.

2. **CRON secret is optional.** In `accrue-penalties/route.ts`:
   ```
   if (cronSecret) { // only validates if env var is set
   ```
   If `CRON_SECRET` is not set in production, the penalty accrual endpoint is **completely open** to unauthenticated calls.

3. **No rate limiting** on login endpoint — brute force attacks on `/api/auth` are not protected.

4. **No CSRF protection** beyond what NextAuth provides — server actions are protected, but custom API routes are not validated for origin.

5. **File upload path** (`/api/upload`) — no file type validation visible in the code. Malicious file uploads (SVGs with scripts, polyglot files) could be an issue.

**Medium Issues:**
- Session duration is 24 hours with no refresh token rotation — a stolen JWT remains valid for the full day
- `developer` role has god-mode access across all tenants with no audit trail separation
- Aadhar numbers stored in plaintext — should be encrypted at rest (PII compliance, especially for India's DPDP Act 2023)
- Password hashing uses `bcryptjs` (correct), but no minimum length/complexity enforcement visible

---

## 4. Subscription & Billing — 4/10

This is the biggest gap for production SaaS readiness.

**What Exists:**
- `TenantSubscription` model with plan, limits, `razorpaySubId`
- `checkLimit()` enforces loan/agent count caps
- `moduleGate.ts` enforces feature access
- Subscription page shows plan info
- Admin billing panel for manual overrides

**What's Missing:**

1. **No Razorpay webhook handler.** The `razorpaySubId` field exists but there's no `/api/webhooks/razorpay` route. Subscription renewals, failures, and cancellations from Razorpay are not handled — subscriptions will silently expire without your system knowing.

2. **No automated trial expiry enforcement.** `trialEndsAt` is stored but never checked during login or API access — a trial tenant continues to work forever after trial ends.

3. **No in-app upgrade flow.** The upgrade page says "Contact us to upgrade" — a SaaS product needs self-serve checkout via Razorpay Subscriptions or Payment Links.

4. **Billing is 100% manual.** Plan changes require a `developer`-role user to manually update the database via the admin panel. Not scalable beyond ~10 tenants.

5. **No invoice generation or billing history.** Tenants can't download invoices or see payment history.

6. **No dunning flow.** When payment fails, there's no retry logic, no email notifications, and no grace period enforcement before account suspension.

7. **Limit checks only on creation.** `checkLimit()` is called on new loan/agent creation but not on login or on each request — a tenant that exceeds limits via bulk import would not be blocked.

---

## 5. Feature Completeness — 7/10

**Implemented Well:**
- Complete loan lifecycle (create → approve → disburse → collect → close)
- Daily collection entry with route/agent scoping
- Penalty accrual via daily cron job with grace period and max cap
- Approval workflow for loan modifications
- KYC document upload and management
- Guarantor and collateral tracking
- Vehicle registration and repo flagging (auto finance)
- Chit group management with auction and dividend tracking
- Credit score calculation (rule-based, 300-850 scale)
- Multi-language UI (EN/HI/TA)
- CSV export for collections, loans, defaulters
- Notification templates

**Missing / Incomplete:**

1. **No WhatsApp/SMS notification delivery.** `NotificationTemplate` model exists, but no actual sending logic (Twilio, MSG91, etc.) — notifications are internal only.

2. **No loan repayment receipt / PDF generation.** Borrowers have no proof of payment document.

3. **No borrower self-service portal.** Customers can't log in to view their loan status, outstanding balance, or instalment schedule (the `Customer.userId` field is prepared but unused).

4. **Foreclosure / early settlement** is not handled — no logic to calculate outstanding + penalty and close a loan before tenure ends.

5. **Bulk operations missing** — no bulk loan disbursement, bulk collection upload (CSV), or bulk customer import.

6. **No NPA (Non-Performing Asset) classification.** Standard lending requires 90-day overdue tracking and NPA flagging.

7. **Chit fund collection payment** — `ChitSubscription` payments have no collection entry integration (separate from the main collection flow).

8. **No dashboard for agents** — agents see only the collection entry page; no personal performance stats.

9. **Reports are read-only static** — no scheduled email reports, no custom date-range exports beyond CSV.

10. **No two-factor authentication** for admin/superadmin roles.

---

## 6. Multi-Tenancy & Isolation — 5/10

**The Core Problem:**

The schema is correctly multi-tenant (every table has `tenantId`). But the runtime tenant resolution is broken for true SaaS:

```typescript
// lib/tenant.ts
export const getDefaultTenantId = cache(async (): Promise<string> => {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  ...
});
```

This hardcodes to a single `default` tenant. For a real SaaS with multiple customers, you need subdomain-based or header-based tenant resolution:

```
customer1.loantrack.app → tenantId = customer1's ID
customer2.loantrack.app → tenantId = customer2's ID
```

**What Needs to Change:**
- Extract tenant slug from `request.headers.get('host')` in middleware
- Resolve tenantId from the slug and inject into the session or request context
- All `getDefaultTenantId()` calls replaced with context-aware resolution
- Add Prisma middleware or Row-Level Security to prevent cross-tenant data leakage as a safety net

---

## 7. Observability & Operations — 4.5/10

**What Exists:**
- `AuditLog` table — good for business events
- `/api/health` endpoint — basic health check
- Cron job returns structured JSON with counts

**Missing:**

1. **No application-level error tracking.** No Sentry, no Datadog, no structured error logging — errors are caught with `console.error()` only.

2. **No performance monitoring.** No query time tracking, no slow query alerts.

3. **Cron job has no idempotency guarantee.** If the penalty cron fires twice in a day, duplicate penalty records could be created (mitigated partially by `findFirst` check, but not fully).

4. **No database backup strategy** documented or configured.

5. **No soft-delete pattern.** Records are hard-deleted in several places — data recovery is impossible without database backups.

6. **No migration strategy** for zero-downtime schema changes — Prisma migrations run as `prisma migrate deploy` which can lock tables.

7. **`lib/db.ts` creates a new PrismaClient per module in dev.** Should use the global singleton pattern to avoid connection pool exhaustion.

---

## 8. UI/UX — 7/10

**What's Good:**
- Consistent design system using CSS variables
- Material Icons throughout
- Mobile-responsive sidebar with overlay
- Badge system, card layouts, filter bars are consistent
- Dark mode CSS variables seem partially set up

**Issues:**
- Subscription "Upgrade" button links to a `mailto:` — not acceptable for a SaaS product
- No loading skeletons — pages flash empty before data loads
- No empty states on many pages (e.g., no loans created yet)
- Form validation errors are not consistently shown inline
- The `globals.css` at 23KB is very large — likely contains unused styles
- No toast/notification system visible for action feedback (success/error)

---

## Priority Action Plan

### 🔴 Critical (Block Launch)

1. **Fix tenant resolution** — Implement subdomain-based tenant detection in Next.js middleware. All `getDefaultTenantId()` calls must be replaced with dynamic resolution.

2. **Fix CRON_SECRET enforcement** — Make the cron secret mandatory (throw if not set), not optional.

3. **Build Razorpay webhook handler** — `/api/webhooks/razorpay` to handle `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`.

4. **Enforce trial expiry** — Add middleware check: if `trialEndsAt < now` and plan is `trial`, block access and redirect to upgrade page.

5. **Encrypt PII** — Aadhar numbers must be encrypted using AES-256 before storage (India DPDP Act compliance).

### 🟡 High Priority (Before Growth)

6. **Add rate limiting** on auth endpoints (use `upstash/ratelimit` or similar).

7. **Build self-serve upgrade flow** — Razorpay Subscription checkout integrated into the billing page.

8. **Implement subdomain routing** — `[tenant].loantrack.in` pattern with middleware-level tenant resolution.

9. **Add SMS/WhatsApp notifications** — MSG91 or Twilio integration for instalment reminders and overdue alerts.

10. **Loan receipt PDF generation** — using `@react-pdf/renderer` or Puppeteer.

11. **Add error tracking** — Sentry integration across API routes and server actions.

12. **Foreclosure / early settlement** flow.

### 🟢 Medium Priority (Competitive Features)

13. **Borrower self-service portal** — Login with OTP, view loan status, download receipts.

14. **Bulk operations** — CSV import for customers and collection data.

15. **Scheduled email reports** — Weekly/monthly summaries to admin email.

16. **NPA classification** — Auto-flag loans overdue 90+ days.

17. **Agent mobile app** (PWA or React Native) — Collection entry on mobile is the primary field agent workflow.

18. **Two-factor auth** for admin accounts.

19. **Dunning emails** — Automated payment failure emails with retry links.

20. **Dashboard for agents** — Personal collection targets, route performance, daily summary.

---

## Positive Highlights Worth Keeping

The following are genuinely impressive for a product at this stage and should be preserved and built upon:

- The **three-module architecture** (microlending + autofinance + chitfunds) under one tenant is a strong differentiator for an Erode/Tamil Nadu market where finance companies often run all three
- **Approval workflow** is production-grade — many competitors skip this entirely
- **Credit scoring engine** (300-850 range with punctuality/completion/volume weights) is a real value-add
- **Tamil language support** — critical for local SMB adoption
- **Route → Agent → Customer hierarchy** maps perfectly to how field collection actually works in South India
- **Penalty accrual cron** with grace periods and caps is operationally sound
- **Audit log** on all actions is a compliance requirement many SaaS products add too late

---

*Report generated by full static analysis of 184 files across the app, prisma, lib, components, and i18n directories.*
