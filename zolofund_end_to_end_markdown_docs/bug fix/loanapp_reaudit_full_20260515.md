# ZoloFund Re-Audit Report — Source Zip Review

**Audit date:** 15 May 2026  
**Reviewed source:** `loanapp_source_20260515_112214.zip`  
**Review type:** Static source-code audit against the earlier ZoloFund audit report  
**Stack identified from package/schema:** Next.js 16.2.6, React 19.2.4, NextAuth 5 beta, Prisma 5.22.0, MySQL

---

## 1. Executive Summary

The new zip shows meaningful improvement compared with the earlier audit. Several previously critical items have been attempted or partially fixed:

- Tenant resolution is no longer only a hardcoded `default` tenant.
- Host/subdomain-based tenant detection has been added.
- MySQL-backed rate limiting has been added, which is suitable for a Hostinger shared-plan/free setup.
- CRON secret enforcement has been hardened.
- Razorpay webhook route has been added.
- Trial/subscription access checks have been added.
- Aadhaar encryption helpers have been added.
- File uploads are now moving toward private tenant-scoped storage.
- Prisma singleton pattern is implemented.

However, the application is **not yet production-ready** for a real multi-tenant lending SaaS. Important issues still remain in security, workflow logic, payment/billing, data model design, tenant isolation, and operations.

**Overall conclusion:**

> The codebase is better than the previous version and can be treated as a stronger MVP or pilot foundation, but all audit fixes are not fully implemented. It should not be launched with real customer/KYC/payment data until the remaining critical issues are fixed.

---

## 2. Important Review Limitation

I could not run a full build, lint, or test execution because the zip does not include installed dependencies.

Attempted command:

```bash
npm run test:security --silent
```

Result:

```text
tsx: not found
```

So this report is based on **static code review**, file inspection, schema review, and workflow reasoning. Build-time, runtime, browser UI, and database migration execution must still be verified separately.

---

## 3. Updated Scorecard

| Area | Previous Audit Score | Current Re-Audit Score | Status |
|---|---:|---:|---|
| Architecture & Code Quality | 8.5/10 | 7.5/10 | Good structure, but many `any` usages, missing migrations, workflow bugs |
| Data Model & Schema | 8/10 | 7.2/10 | Strong base, but missing Payment ledger, invoices, NPA, soft delete |
| Security & Auth | 5.5/10 | 6.8/10 | Improved, but still tenant-login, MFA, upload scanning, CSP issues |
| Subscription & Billing | 4/10 | 5.2/10 | Webhook added, but no checkout, invoices, dunning, billing ledger |
| Feature Completeness | 7/10 | 7/10 | Core features exist, but key SaaS/lending features still missing |
| Multi-Tenancy & Isolation | 5/10 | 6.8/10 | Much improved, but several cross-tenant action gaps remain |
| Observability & Operations | 4.5/10 | 4.8/10 | Very limited improvement; still weak for production |
| UI & UX | 7/10 | 7.1/10 | Decent UI, but feedback, billing UX, skeleton usage need work |
| Logic Workflow | Not separately scored | 6.2/10 | Core flows exist, but loan edit/close/renew/payment logic needs hardening |
| Link / Route / Slug Management | Not separately scored | 7/10 | Mostly consistent, but tenant slug and customer canonical routing need improvement |
| **Overall** | **6.2/10** | **6.6/10** | Improved, but still not launch-ready |

---

## 4. Fix Status Compared with Earlier Audit

| Previous Finding / Suggestion | Current Status | Evidence / Comment |
|---|---|---|
| Fix hardcoded default tenant resolution | **Partially fixed** | `lib/tenant.ts` now has host/subdomain tenant resolution, session tenant checks, and subscription access checks. But fallback to `default` tenant still exists. Root-domain login can still be globally ambiguous. |
| Mandatory CRON secret | **Fixed** | `app/api/cron/accrue-penalties/route.ts` now returns error when `CRON_SECRET` is missing and rejects invalid secret. |
| Razorpay webhook handler | **Partially fixed** | `app/api/webhooks/razorpay/route.ts` exists and verifies signature. It handles subscription events, but billing ledger, invoices, retries, and full idempotency are still incomplete. |
| Trial expiry enforcement | **Mostly fixed** | `lib/subscription.ts` and `proxy.ts` enforce trial/subscription status. But if a tenant has no subscription row, access is permissive. |
| Aadhaar encryption | **Partially fixed** | `lib/pii.ts` supports AES-256-GCM encryption. Existing plaintext data still needs migration. Masking can be risky if encrypted value is passed directly. |
| Rate limiting | **Mostly fixed** | `lib/rateLimit.ts` implements MySQL-backed rate limiting. This is good for Hostinger shared hosting without Redis/Upstash. Needs broader endpoint coverage and cleanup scheduling verification. |
| Self-serve upgrade flow | **Not fixed** | Billing page still uses email/contact flow. No Razorpay checkout/subscription creation flow. |
| Invoice generation / billing history | **Not fixed** | No invoice/payment history models or tenant-facing invoice UI. |
| Dunning flow | **Not fixed** | No failed-payment retry, reminder email, grace-period job, or automated suspension workflow. |
| SMS/WhatsApp notifications | **Not fixed** | Notification templates exist, but no actual SMS/WhatsApp provider integration. |
| PDF repayment receipts | **Not fixed** | No receipt PDF generation. |
| Borrower self-service portal | **Not fixed** | Portal exists for admin/billing-style access, not borrower loan self-service. |
| Foreclosure / early settlement | **Not fixed** | No proper early settlement calculation and closure flow. |
| Bulk operations | **Not fixed** | No bulk loan/customer/collection import workflow found. |
| NPA classification | **Not fixed** | No 90+ day overdue NPA flagging/classification workflow. |
| Agent dashboard | **Not fixed** | Agent collection entry exists, but no strong performance dashboard. |
| Error tracking / Sentry | **Not fixed** | No Sentry/APM/structured logging implementation found. |
| Prisma singleton | **Fixed** | `lib/db.ts` uses global Prisma singleton pattern. |
| Private file storage | **Partially fixed** | Uploads now use private tenant-scoped paths and `/api/files`. Some document fields still allow free text paths/URLs. |

---

## 5. UI & UX Audit

### What is good

- Consistent dashboard layout and sidebar structure.
- Responsive layout exists.
- CSS variables and common components support a consistent visual language.
- Empty state styles exist and are used in some important areas like loans/customers/vehicles/chits/approvals.
- Login page has loading state and inline error display.
- Multi-language support is a strong local-market advantage.

### Issues

1. **Toast system is incomplete**  
   CSS and a `toast-container` exist, but many UI actions still use browser `alert()`. This gives a basic/non-premium SaaS experience.

2. **Subscription upgrade UX is still weak**  
   The billing page still uses a contact/email-based upgrade flow instead of self-serve Razorpay checkout.

3. **Skeleton loading is not consistently used**  
   Skeleton CSS exists, but pages are not consistently using skeleton loaders for better perceived performance.

4. **Form validation is inconsistent**  
   Some forms show good inline validation. Others rely on submit-time server errors or alerts.

5. **Vehicle document upload UX is not aligned with secure upload flow**  
   Vehicle RC/insurance fields allow URL or file path text entry. This is not ideal for a secure SaaS workflow. It should use the same private upload component.

6. **Remember me checkbox is misleading**  
   The login page has a remember-me UI option, but the session duration is not dynamically changed based on it.

### UI/UX score: **7.1/10**

---

## 6. Logic Workflow Audit

### Strong areas

- Loan lifecycle is mostly present: create, approve, disburse, collect, close.
- Daily collection flow exists.
- Penalty accrual exists.
- Approval workflow exists.
- Customer, guarantor, KYC, vehicle, chit fund, and collection modules are broad enough for a serious MVP.

### Critical logic issues

#### 6.1 Loan update mutates data before payment-history validation

In `app/(dashboard)/loans/actions.ts`, the loan update flow updates loan/guarantor data before checking whether paid or partial instalments exist. After mutation, it returns an error if paid instalments exist.

**Impact:**  
A user can change core loan fields even though the system says the update failed. This is a serious data integrity bug.

**Required fix:**  
Move all validation before mutation and wrap the entire update in a Prisma transaction.

---

#### 6.2 Loan schedule can be deleted/recreated too easily

When core loan fields change, instalments may be deleted and regenerated. This is dangerous after collections, approvals, penalties, or partial payments exist.

**Required fix:**  
Do not regenerate instalments once a loan has financial activity. Use a controlled reschedule workflow with audit trail.

---

#### 6.3 Loan close does not verify full settlement

`closeLoan` marks the loan as closed without strongly verifying that all instalments, penalties, and outstanding amounts are settled.

**Required fix:**  
Before closing a loan, validate:

- principal due = 0
- interest/charges due = 0
- penalty due = 0
- all instalments are paid/settled
- no pending approval requests

---

#### 6.4 Loan renewal is not transaction-safe

The renew flow closes the old loan and creates the new loan, but it is not wrapped as one atomic transaction.

**Impact:**  
If new loan creation fails after old loan closure, data becomes inconsistent.

**Required fix:**  
Wrap old loan closure and new loan creation in one transaction.

---

#### 6.5 Collection payment flow lacks a proper ledger

`CollectionEntry` is used to track collection activity, but there is no immutable `Payment` / `Transaction` model.

**Impact:**  
Refunds, reversals, reconciliation, partial payment history, audit, and payment-provider mapping will become difficult.

**Required fix:**  
Add `Payment` and `PaymentAllocation` models.

---

#### 6.6 Overpayment and negative adjustment controls need hardening

The collection flow allows delta-style updates. This is useful for correction, but without a proper ledger and approval category, it may create confusing financial history.

**Required fix:**  
Separate normal payment, correction, reversal, refund, waiver, and settlement as different transaction types.

### Logic workflow score: **6.2/10**

---

## 7. Link / Route Management Audit

### What is good

- Internal dashboard links are mostly consistent.
- Customer profile route supports both customer ID and customer code.
- Tenant routing is now considered through host/subdomain resolution.
- API routes are generally protected by auth/context helpers.

### Issues

1. **No canonical customer slug redirect**  
   Customer profile supports both ID and customer code, but there is no automatic redirect to the canonical customer code URL.

2. **Notification links can be arbitrary internal links**  
   Notification links should be restricted to safe internal paths beginning with `/`.

3. **Upgrade link is still `mailto:`**  
   For SaaS, billing route should point to checkout/plan selection, not email.

4. **APIs are excluded from proxy public path checks**  
   This is acceptable only if every API route has strong route-level auth. Continue auditing all APIs individually.

5. **Some appType filters are missing in page/detail views**  
   A few routes filter by tenant but not always by `appType`, which can cause cross-module visibility inside the same tenant.

### Link/route score: **7/10**

---

## 8. Slug Check Audit

### What is good

- Tenant slug extraction from host/subdomain exists.
- Root domain environment variables are considered.
- Host tenant and session tenant mismatch check exists.

### Issues

1. **Fallback default tenant remains**  
   Fallback to the `default` tenant is useful for local development, but risky in production.

2. **Root-domain login can be ambiguous**  
   If two tenants have the same username, login from root domain may select the first active matching user.

3. **No reserved slug validation found**  
   Tenant slugs should block reserved names like `www`, `api`, `admin`, `app`, `portal`, `support`, `static`, `assets`.

4. **No tenant not-found branded page**  
   Unknown tenant slug should show a clear tenant-not-found screen instead of falling back silently.

5. **No canonical tenant URL enforcement**  
   If the tenant is known, users should be redirected to the correct tenant subdomain where applicable.

### Slug score: **7/10**

---

## 9. Security & Auth Audit

### Improvements found

- MySQL-backed rate limiting exists.
- CRON secret is mandatory.
- Razorpay webhook signature verification exists.
- Aadhaar encryption helper exists.
- Private tenant-scoped file serving exists.
- Basic security headers exist in `next.config.ts`.
- Tenant mismatch check exists between host and session.

### Remaining security issues

1. **Login is not fully tenant-safe on root domain**  
   Login filters by tenant only when host/subdomain tenant is resolved. On root domain or local/default context, username/phone lookup can be global.

2. **No MFA / 2FA for privileged users**  
   Admin, superadmin, and developer roles need 2FA before real production use.

3. **CSP is weak**  
   Current CSP includes `unsafe-inline` and `unsafe-eval`. This weakens XSS protection.

4. **Upload validation is incomplete**  
   MIME type and extension checks exist, but file magic-byte validation and malware scanning are not implemented.

5. **Vehicle document path fields are unsafe from a product design perspective**  
   Free text document paths/URLs should be replaced with secure upload references.

6. **Some server actions lack strict tenant validation**  
   Examples include vehicle clear repo flag, vehicle loan linking, route assigned agent, chit member IDs, and some collection edit request paths.

7. **Password policy needs hardening**  
   Password hashing exists, but strong password rules and password reset controls are not clearly implemented.

8. **No audit trail for file downloads**  
   KYC/document access should be logged.

### Security & Auth score: **6.8/10**

---

## 10. Architecture & Code Quality Audit

### What is good

- Good App Router structure.
- Domain modules are separated under dashboard routes.
- Prisma singleton fixed.
- Central `apiAuth` and tenant helpers exist.
- Rate limiter is reusable.
- Subscription helper is centralized.
- Code is readable and mostly organized.

### Issues

1. **No Prisma migration folder**  
   The project has Prisma schema but no migration history. This is risky for production.

2. **Too many `any` usages**  
   Static scan found around 250+ `any` usages. This weakens TypeScript benefits.

3. **Shared validation schema is missing**  
   There is no consistent Zod/schema validation layer across forms and server actions.

4. **`serverActionAuth.ts` is not widely used**  
   Role and tenant checks are duplicated in many actions.

5. **Transaction boundaries are missing in important workflows**  
   Loan update, loan renewal, payment corrections, and some billing actions need stronger transactions.

6. **Some raw SQL uses unsafe API shape**  
   Even if variables are parameterized, prefer Prisma tagged templates over `$executeRawUnsafe` wherever possible.

### Architecture & Code Quality score: **7.5/10**

---

## 11. Data Model & Schema Audit

### What is good

- MySQL datasource matches Hostinger-friendly deployment.
- Strong multi-tenant base model: Tenant, Branch, User, Customer, Loan.
- Decimal values are used for money.
- AuditLog exists.
- ApprovalRequest exists.
- TenantSubscription exists.
- Chit fund models exist.
- RateLimit model added.
- WebhookEvent model added.

### Issues

1. **No Payment / Transaction ledger**  
   This is the biggest data model gap for a finance application.

2. **No PaymentAllocation model**  
   You need to track how a payment is split across principal, interest, penalty, fees, and instalments.

3. **No invoice/billing history model**  
   SaaS billing cannot be audited properly.

4. **No NPA classification fields/model**  
   90+ overdue classification is missing.

5. **No soft delete pattern**  
   Hard deletes are risky in finance and SaaS admin operations.

6. **Penalty is not linked to a specific instalment**  
   Aggregate penalty per loan reduces traceability.

7. **SecurityCheque has no loanId**  
   Cheques cannot be cleanly tied to a specific loan.

8. **enabledModules is a comma-separated string**  
   Better as JSON or a `TenantModule` table.

9. **No DB-level tenant consistency constraints**  
   The database does not prevent linking records across tenants in some relationships.

### Data Model & Schema score: **7.2/10**

---

## 12. Feature Completeness Audit

### Implemented / available

- Customer management.
- Loan creation.
- Loan disbursement and status handling.
- Instalment generation.
- Collection entry.
- Daily collection concept.
- Penalty accrual cron.
- Approval workflow.
- KYC upload and private file serving.
- Vehicle finance support.
- Chit fund support.
- Internal notifications/templates.
- CSV-style exports/reports.
- i18n support.

### Still missing / incomplete

- Borrower self-service portal.
- OTP/customer login flow.
- PDF repayment receipts.
- SMS/WhatsApp notification delivery.
- Foreclosure/early settlement.
- Bulk customer import.
- Bulk collection upload.
- Bulk disbursement.
- NPA classification.
- Agent performance dashboard.
- Scheduled email reports.
- 2FA for admins.
- Full chit collection integration with common daily collection/payment ledger.

### Feature Completeness score: **7/10**

---

## 13. Subscription & Billing Audit

### Improvements found

- `TenantSubscription` exists.
- Subscription access checks exist.
- Trial expiry logic exists.
- Razorpay webhook route exists.
- Webhook signature verification exists.
- WebhookEvent model exists.
- Module limits and module gating exist.

### Remaining issues

1. **No self-serve Razorpay checkout**  
   Tenants cannot upgrade directly.

2. **No invoice generation**  
   Tenants cannot download invoices.

3. **No payment history**  
   No proper billing transaction table.

4. **No dunning**  
   Failed payment recovery emails, retry links, and staged suspension are missing.

5. **No billing event retry system**  
   Webhook processing should be durable and retryable.

6. **Webhook idempotency is partial**  
   If Razorpay event ID header is missing, idempotency is weaker.

7. **No plan checkout or subscription creation route**  
   Webhook receives events but app does not appear to create subscriptions from the UI.

8. **No invoice GST/tax readiness**  
   For an Indian SaaS, billing records should support tax invoice needs if monetized.

### Subscription & Billing score: **5.2/10**

---

## 14. Multi-Tenancy & Isolation Audit

### Improvements found

- Tenant host resolution exists.
- Tenant/session mismatch check exists.
- API context generally includes tenantId.
- Many queries are tenant-scoped.
- Private files are tenant-scoped.

### Remaining isolation gaps

1. **Root-domain/default tenant fallback is risky**  
   Production should not silently use default tenant for normal users.

2. **Some actions update by ID without tenant check**  
   Example: clear vehicle repo flag by ID.

3. **Cross-tenant relation linking is possible in some flows**  
   Examples: vehicle `loanId`, route `assignedAgentId`, chit `memberIds`.

4. **Some detail pages filter by tenant but not appType**  
   Cross-module leakage inside the same tenant is possible.

5. **Admin/developer role boundaries need clearer policy**  
   Developer god-mode may be acceptable, but superadmin cross-tenant behavior should be explicit and audited.

6. **No Prisma middleware or DB-level safety net**  
   Tenant filtering depends on each query/action being correct.

### Multi-Tenancy & Isolation score: **6.8/10**

---

## 15. Observability & Operations Audit

### What exists

- AuditLog model.
- Basic health endpoint.
- Cron JSON response.
- Rate-limit cleanup helper.
- Some console logging.

### Missing

1. **No Sentry or error monitoring**
2. **No structured logging**
3. **No slow-query/performance monitoring**
4. **No cron lock table**
5. **No backup/restore plan**
6. **No migration strategy**
7. **No deployment runbook**
8. **No PII key rotation plan**
9. **No webhook retry/dead-letter table**
10. **No file access audit trail**

### Observability & Operations score: **4.8/10**

---

## 16. Hostinger Shared Plan / Free-Only Readiness

The newly added MySQL-backed rate limiter is the right approach for your Hostinger shared/free-only preference.

### Suitable for Hostinger shared plan

- MySQL database-backed rate limiting.
- No Redis required.
- No Upstash required.
- No PostgreSQL required.

### Still risky on Hostinger shared plan

- Next.js server hosting may not be fully suitable on basic shared hosting depending on Hostinger plan/runtime support.
- Cron jobs may need external scheduler or Hostinger cron hitting API endpoint.
- File storage on local disk can be risky if deployment filesystem is reset or scaled.
- Large PDF/image uploads should be controlled carefully.

---

## 17. Immediate Blocker Fixes Before Launch

These should be fixed before using real users or real KYC/payment data.

### P0 — Must fix

1. Fix `updateLoan` mutation order and wrap in transaction.
2. Make login fully tenant-aware; avoid global username/phone lookup on root domain.
3. Validate tenant/app ownership for every foreign key in server actions.
4. Add proper `Payment` and `PaymentAllocation` ledger.
5. Stop deleting/recreating instalments after financial activity exists.
6. Add Prisma migrations and production migration process.
7. Add secure upload magic-byte validation.
8. Add proper loan closure validation.
9. Add cron locking/idempotency for penalty accrual.
10. Add backup/restore process.

### P1 — High priority

1. Complete self-serve Razorpay checkout.
2. Add invoice/billing history.
3. Add dunning and grace-period automation.
4. Add Sentry or similar error tracking.
5. Add structured logs.
6. Add 2FA for privileged users.
7. Add PDF receipts.
8. Add SMS/WhatsApp notification delivery.
9. Add NPA classification.
10. Add borrower portal.

### P2 — Product maturity

1. Add agent dashboard.
2. Add scheduled email reports.
3. Add bulk imports.
4. Add PWA/mobile optimized agent collection flow.
5. Add tax/GST-ready billing if monetizing in India.
6. Add customer communication history.
7. Add advanced audit search/export.

---

## 18. Final Verdict

### Are all earlier audit fixes implemented?

**No.**

### Is the codebase improved?

**Yes. Significantly.**

### Is it production-ready as a multi-tenant subscription SaaS?

**Not yet.**

### Best current classification

> Strong MVP / pilot-ready after P0 fixes, but not ready for real production launch with real finance/KYC/payment data.

### Suggested next milestone

Before adding new features, complete a **Production Hardening Sprint** focused on:

1. Tenant isolation closure.
2. Financial ledger correctness.
3. Loan workflow correctness.
4. Billing automation.
5. Observability and backup readiness.
6. Security hardening.

