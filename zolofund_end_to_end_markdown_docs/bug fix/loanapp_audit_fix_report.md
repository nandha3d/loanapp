# ZoloFund Audit Fix Remediation Report
**Remediated:** May 14, 2026 | **Stack:** Next.js 16.2.6, Prisma ORM, MySQL, NextAuth.js, TypeScript

---

## Executive Summary

This remediation pass focused on the launch-blocking audit findings that could be safely fixed in the current codebase without adding paid external infrastructure. The critical runtime tenant flaw has been corrected from a hardcoded default tenant lookup to session-first tenant resolution with host/subdomain validation. Billing state now has automated Razorpay webhook ingestion, trial expiry is enforced, cron execution requires a configured secret, login has fixed-window rate limiting, and Aadhaar values are encrypted before storage.

Browser Use visual verification was not used because the project instructions state that the Browser Use runtime is blocked on this machine. Validation was completed through focused regression tests and a production build.

---

## Overall Remediation Status

| Dimension | Previous Risk | Current Status |
|---|---:|---|
| Tenant Resolution | Critical | Fixed for authenticated app/API context |
| Tenant Host Isolation | Critical | Fixed with host/session mismatch checks |
| CRON Secret Enforcement | Critical | Fixed |
| Razorpay Webhooks | Critical | Implemented |
| Trial Expiry Enforcement | Critical | Implemented |
| Aadhaar Encryption | Critical | Implemented for customer/API/approval write paths |
| Login Rate Limiting | High | Implemented with in-memory fixed window |
| Upload Validation | High | Already present before this pass |
| Prisma Singleton | Ops | Already present before this pass |
| Full Browser Visual Check | Blocked | Not run due Browser Use runtime issue |

---

## Fixes Completed

### 1. Tenant Resolution and Isolation

**Files changed:**
- `lib/tenant.ts`
- `lib/apiAuth.ts`
- `proxy.ts`
- Removed deprecated `middleware.ts`
- Removed unused `app/proxy.ts`

**What changed:**
- `getDefaultTenantId()` is now an alias for dynamic `getCurrentTenantId()`.
- Authenticated users resolve tenant from `session.user.tenantId`.
- Superadmin/developer can still use host-based tenant context where appropriate.
- Tenant slug is extracted from subdomain-style hosts.
- Host tenant mismatch is blocked for normal tenant-scoped users.
- API context now uses `getCurrentTenantId()` instead of the old default tenant lookup.
- Project now uses the Next.js 16 root `proxy.ts` convention instead of deprecated `middleware.ts`.

**Impact:**
The app no longer forces every request into the `slug: "default"` tenant. This materially improves SaaS tenant isolation.

---

### 2. Trial Expiry and Subscription Access

**Files changed:**
- `lib/subscription.ts`
- `lib/tenant.ts`
- `proxy.ts`

**What changed:**
- Added trial-expiry detection.
- Added subscription access assertion for tenant-scoped data access.
- Expired or inactive tenants are redirected to `/subscription` at the page layer.
- API/data access also fails when the tenant subscription is inactive or trial-expired.

**Impact:**
Trial tenants can no longer continue using tenant-scoped app areas indefinitely after trial expiry.

---

### 3. Razorpay Webhook Handler

**Files changed:**
- `lib/razorpay.ts`
- `lib/subscription.ts`
- `app/api/webhooks/razorpay/route.ts`

**What changed:**
- Added `/api/webhooks/razorpay`.
- Requires `RAZORPAY_WEBHOOK_SECRET`.
- Verifies `x-razorpay-signature` with HMAC-SHA256.
- Handles:
  - `subscription.activated`
  - `subscription.charged`
  - `subscription.halted`
  - `subscription.cancelled`
- Updates `TenantSubscription.status` and `currentPeriodEnd` by `razorpaySubId`.

**Impact:**
Subscription changes from Razorpay are now reflected automatically in the app.

---

### 4. CRON Secret Enforcement

**Files changed:**
- `app/api/cron/accrue-penalties/route.ts`

**What changed:**
- `CRON_SECRET` is now mandatory.
- If missing, the endpoint returns `500`.
- If present but the bearer token is missing or wrong, the endpoint returns `401`.

**Impact:**
The penalty accrual endpoint is no longer accidentally public when the environment variable is omitted.

---

### 5. Aadhaar Encryption at Rest

**Files changed:**
- `lib/pii.ts`
- `app/(dashboard)/customers/actions.ts`
- `app/(dashboard)/customers/[id]/page.tsx`
- `app/(dashboard)/approvals/actions.ts`
- `app/api/customers/[id]/route.ts`
- `app/api/approvals/[id]/review/route.ts`

**What changed:**
- Added AES-256-GCM encryption helper.
- Customer create/update paths encrypt Aadhaar before saving.
- Customer API patch path encrypts Aadhaar before saving.
- Approval request paths encrypt Aadhaar values before storing pending changes.
- Customer profile/API responses mask Aadhaar values for display.
- Legacy plaintext Aadhaar values can still be read and masked.

**Required environment variable:**

```bash
PII_ENCRYPTION_KEY=<32-byte secret or any strong secret string>
```

**Impact:**
New Aadhaar values are no longer stored as plaintext in customer or approval write paths.

---

### 6. Login Rate Limiting

**Files changed:**
- `lib/rateLimit.ts`
- `lib/auth.ts`

**What changed:**
- Added fixed-window login attempt limiter.
- Default: 10 attempts per 15 minutes per username.
- Tunable with:

```bash
LOGIN_MAX_ATTEMPTS=10
LOGIN_WINDOW_MS=900000
```

**Impact:**
Basic brute-force resistance is now present for credentials login.

---

## Verification Evidence

### Focused Security Regression Tests

**Command:**

```bash
npm run test:security
```

**Result:** Passed.

**Coverage:**
- Aadhaar encryption/decryption/masking
- Tenant slug parsing
- Tenant host/session mismatch rules
- Trial expiry detection
- Razorpay event status mapping
- Fixed-window rate limiting
- Razorpay webhook signature verification

### Production Build

**Command:**

```bash
npm run build
```

**Result:** Passed.

**Confirmed routes include:**
- `/api/webhooks/razorpay`
- Root Next.js Proxy
- Existing app/API routes

### Lint Baseline

**Command:**

```bash
npm run lint
```

**Result:** Failed before remediation with 265 pre-existing errors, mostly broad `any` usage and React lint findings across the app.

**Status:** Not treated as a regression gate for this pass because the failure existed before these fixes.

---

## Remaining Gaps

These items are still product or infrastructure work and were not completed in this focused security remediation pass:

1. Self-serve Razorpay checkout or subscription creation flow.
2. Invoice generation and billing history.
3. Dunning emails and payment retry communication.
4. SMS/WhatsApp delivery integration.
5. Receipt/PDF generation.
6. Borrower self-service portal.
7. Foreclosure/early settlement workflow.
8. Bulk imports and bulk operations.
9. NPA classification.
10. Two-factor authentication for admin roles.
11. Durable distributed login rate limiting with Redis/Upstash for multi-instance deployments.
12. Backfill migration to encrypt existing plaintext Aadhaar values already in the database.
13. Full browser visual verification after Browser Use runtime is updated.

---

## Environment Checklist Before Deployment

Set these before deploying:

```bash
CRON_SECRET=<strong cron bearer token>
RAZORPAY_WEBHOOK_SECRET=<secret from Razorpay dashboard>
PII_ENCRYPTION_KEY=<32-byte or strong application secret>
NEXT_PUBLIC_ROOT_DOMAIN=<your root SaaS domain, for example loantrack.in>
APP_ROOT_DOMAIN=<same root domain for server-side fallback>
LOGIN_MAX_ATTEMPTS=10
LOGIN_WINDOW_MS=900000
```

---

## Updated Production Readiness Assessment

| Area | Status |
|---|---|
| Critical tenant isolation | Significantly improved |
| Critical cron hardening | Fixed |
| Razorpay webhook automation | Implemented |
| Trial expiry enforcement | Implemented |
| Aadhaar encryption for new writes | Implemented |
| Existing Aadhaar migration | Still required |
| SaaS billing completeness | Partially complete |
| Browser visual verification | Blocked by local Browser Use runtime |

---

## Recommendation

The app is now meaningfully safer than the audited baseline for the highest-risk launch blockers. Before production launch, run a one-time database migration to encrypt existing plaintext Aadhaar values, configure the required secrets, and complete a real browser smoke test once the Browser Use/Codex Node runtime issue is resolved.
