# Plan: ZoloFund Full Fix — Re-Audit Remediation

**TL;DR:** Address all issues from the 15-May-2026 re-audit across 7 phases, ordered by criticality. Start with P0 security/data-integrity blockers that must be done before real user data touches the system, then schema changes, architecture cleanup, billing automation, observability, and new features.

---

## Phase 1 — P0: Security & Data-Integrity Blockers

*Must complete before any real user/KYC/payment data is used.*

### 1.1 Fix cross-tenant ID-only update vulnerabilities
- `app/(dashboard)/vehicles/actions.ts` — `flagForRepo()` and `clearRepoFlag()`: change `prisma.vehicle.update({ where: { id } })` to `where: { id, tenantId }`. Add tenant lookup assertion before both updates.
- `app/(dashboard)/chits/actions.ts` — `recordAuctionWinner()`: change `prisma.chitMember.update({ where: { id: winnerMemberId } })` to verify member belongs to same tenant via `{ id: winnerMemberId, chitGroup: { tenantId } }`.
- `app/(dashboard)/approvals/actions.ts` — `reviewRequest()` customer update: add `tenantId` to `prisma.customer.update({ where: { id, tenantId } })`.
- `app/(dashboard)/penalties/actions.ts` — `settlePenalty()`, `waivePenalty()`, `enforcePenalty()`: add `tenantId` constraint to all update WHERE clauses.

### 1.2 Make login fully tenant-scoped
- `lib/auth.ts` — authorize callback: if `tenantIdFromHost` resolves to `null` (root domain / localhost), **block login** or redirect to tenant subdomain, rather than doing a global user lookup. Add env flag `ALLOW_ROOT_DOMAIN_LOGIN=false` to enforce per-environment.
- Add reserved slug blocklist: validate new tenant slugs against `['www','api','admin','app','portal','support','static','assets']` in tenant creation action.
- Add branded 404-page for unknown tenant slugs in `proxy.ts`: redirect to `ROOT_DOMAIN/not-found?tenant=<slug>` when `getTenantIdFromHost()` returns null and path is not public.

### 1.3 Fix `updateLoan` mutation order + transaction
- `app/(dashboard)/loans/actions.ts` — `updateLoan()`:
  1. Move all read/validation (paid instalment check, ownership check) **before** any write.
  2. Wrap loan update + guarantor upsert + (if reschedule) instalment delete/recreate inside one `prisma.$transaction()`.
  3. Block instalment regeneration if any `CollectionEntry` record references the loan (financial activity guard).

### 1.4 Add full-settlement validation to `closeLoan`
- `app/(dashboard)/loans/[id]/actions.ts` — `closeLoan()`: before setting `status = 'closed'`, query and assert:
  - All `Instalment` records for the loan have `status = 'paid'` or `'waived'`.
  - `loan.totalPenalty - loan.penaltyPaid = 0` (or no outstanding PenaltyEntry).
  - No `ApprovalRequest` for this loan with `status = 'pending'`.
  - Return structured error if any condition fails.

### 1.5 Make `renewLoan` transaction-safe
- `app/(dashboard)/loans/[id]/actions.ts` — `renewLoan()`: wrap old-loan closure + new-loan creation + counter increment inside a single `prisma.$transaction()`. Rollback all if any step fails.

### 1.6 Guard instalment regeneration after financial activity
- Extract a shared `hasFinancialActivity(loanId)` helper in `lib/repayments.ts` that returns true when any CollectionEntry exists.
- Call it in `updateLoan` and block schedule delete/recreate if true; return actionable error message to the user.

### 1.7 Add magic-byte upload validation
- `app/api/upload/route.ts`: after MIME-type check, read first 8 bytes of the file buffer and validate against known signatures (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, PDF: `25 50 44 46`). Reject files whose bytes don't match declared MIME type.

### 1.8 Add cron locking for penalty accrual
- `prisma/schema.prisma`: add `CronLock` model with `jobName`, `lockedAt`, `lockedUntil`, `instanceId` fields.
- `app/api/cron/accrue-penalties/route.ts`: before processing, attempt upsert of `CronLock` with `lockedUntil = now + 10 min`. If an active lock exists, return `200 { ok: true, skipped: true }`.
- Release lock after completion.

### 1.9 Create Prisma migrations
- Run `npx prisma migrate dev --name init` to create the initial migration from the current schema (captures existing structure).
- Commit `prisma/migrations/` folder to source control.
- Document migration commands in `README.md`.

---

## Phase 2 — Data Model & Schema Fixes

*Depends on: Phase 1 complete (so migrations start from a clean base).*

### 2.1 Add Payment + PaymentAllocation models
- `prisma/schema.prisma`: add `Payment` model (id, tenantId, loanId, customerId, amount, method, reference, type enum[payment/correction/reversal/refund/waiver/settlement], status, recordedById, createdAt).
- Add `PaymentAllocation` model (id, paymentId, instalmentId, principalApplied, interestApplied, penaltyApplied, feesApplied).
- Relate CollectionEntry → Payment for immutable audit trail.
- Generate and apply migration.

### 2.2 Add BillingInvoice model
- `prisma/schema.prisma`: add `BillingInvoice` model (id, tenantId, subscriptionId, amount, tax, total, status, dueDate, paidAt, razorpayPaymentId, createdAt).
- Relate `TenantSubscription` 1-to-many `BillingInvoice`.

### 2.3 Add NPA classification fields
- `prisma/schema.prisma`: add `npaClassifiedAt DateTime?` and `npaStatus String?` to `Loan` model.
- Add `CronLock` model (from 1.8).

### 2.4 Fix data model gaps
- `SecurityCheque`: add `loanId String?` + relation to `Loan`.
- `Penalty`: add `instalmentId String?` + relation to `Instalment`.
- `Tenant.enabledModules`: change from `String` to `Json` (or create `TenantModule` join table — prefer Json for simplicity).
- All major models: add `deletedAt DateTime?` (soft delete pattern). Update relevant queries to filter `deletedAt: null`.

---

## Phase 3 — Architecture & Code Quality

*Parallel with Phase 2.*

### 3.1 Migrate server actions to use `serverActionAuth.ts`
- Refactor all 13 action files listed in exploration to call `getServerActionContext(allowedRoles)` at top and return early if null.
- Remove duplicated `auth()` + `role` + `tenantId` boilerplate from each file.
- Files: `loans/actions.ts`, `loans/[id]/actions.ts`, `collection/actions.ts`, `penalties/actions.ts`, `settings/actions.ts`, `customers/actions.ts`, `vehicles/actions.ts`, `approvals/actions.ts`, `chits/actions.ts`, `notifications/actions.ts`, `portal/actions.ts`, `admin/actions.ts`, `admin/billing/billingActions.ts`.

### 3.2 Add Zod validation schemas
- Create `lib/schemas/` folder with per-domain schema files: `loanSchema.ts`, `customerSchema.ts`, `collectionSchema.ts`, `vehicleSchema.ts`, `chitSchema.ts`.
- Each schema: parse FormData in server actions using `schema.safeParse(Object.fromEntries(formData))`.
- Return `{ error: zodError.flatten() }` on parse failure.

### 3.3 Replace `alert()` with toast system
- Verify toast container/system already exists in globals.css (it does per audit).
- Replace all 15+ `alert(...)` calls in client components with toast calls. Key files: `ApprovalsClient.tsx`, `SettingsClient.tsx`, `CustomerProfileClient.tsx`, `CustomerForm.tsx`, `CollectionClient.tsx`, `LoanDetailClient.tsx`, `UsersClient.tsx`, `BranchesClient.tsx`, `PenaltiesClient.tsx`.
- Create `lib/toast.ts` or `components/ui/useToast.ts` hook if not already present.

### 3.4 Replace `$executeRawUnsafe`
- `app/(dashboard)/collection/actions.ts` line ~29: replace `$executeRawUnsafe` INSERT with `prisma.dailyCollection.create()` using `createMany` or a raw tagged template `$executeRaw` for the CURDATE() clause.

### 3.5 Harden CSP
- `next.config.ts`: remove `'unsafe-eval'` from `script-src`. Replace `'unsafe-inline'` scripts with a nonce-based CSP (requires Next.js middleware nonce generation and passing via header). This is a multi-step change — document in a separate `CSP_MIGRATION.md` task note.

---

## Phase 4 — Billing & Subscription

*Depends on: Phase 2.2 (BillingInvoice model).*

### 4.1 Self-serve Razorpay checkout
- `lib/razorpay.ts`: add `createRazorpaySubscription(planId, tenantId)` helper.
- `app/portal/billing/`: add server action `initiateCheckout(planId)` that creates a Razorpay subscription and returns `subscriptionId` + short_url.
- Update billing page UI to show plan cards with "Upgrade" button triggering Razorpay hosted page redirect instead of mailto link.

### 4.2 Invoice generation
- `app/api/webhooks/razorpay/route.ts`: on `subscription.charged` event, create a `BillingInvoice` record with amount, tax, status=paid.
- `app/portal/billing/page.tsx`: add invoice history table showing past invoices.
- Add `app/api/portal/invoices/[id]/route.ts` for basic HTML invoice download (PDF via `@react-pdf/renderer` or simple HTML print page).

### 4.3 Dunning automation
- Add `app/api/cron/dunning/route.ts` cron job that:
  1. Finds subscriptions with `status = 'past_due'` and `gracePeriodEnd < now`.
  2. Suspends tenant (set `status = 'suspended'`).
  3. Sends email notification via existing notification template system.
- Add `gracePeriodDays` config to `lib/plans.ts`.
- Webhook: on `subscription.halted`, set `status = 'past_due'`, set `gracePeriodEnd = now + gracePeriodDays`.

### 4.4 Fix webhook idempotency for missing event ID
- `app/api/webhooks/razorpay/route.ts`: if `x-razorpay-event-id` header is missing, generate a deterministic deduplication key from `event + payload_hash`. Store in WebhookEvent for replay protection.

---

## Phase 5 — Observability & Operations

*Parallel with Phase 4.*

### 5.1 Sentry integration
- Install `@sentry/nextjs`. Run `npx @sentry/wizard@latest -i nextjs`.
- Configure `SENTRY_DSN` env var.
- Wrap unhandled errors in server actions with `Sentry.captureException()`.
- Add Sentry to `app/global-error.tsx`.

### 5.2 Structured logging
- Create `lib/logger.ts` wrapping `console.log/error` with structured JSON output: `{ level, message, tenantId, userId, action, timestamp }`.
- Replace ad-hoc console calls in actions and API routes.

### 5.3 File access audit trail
- `app/api/files/[...path]/route.ts`: after successful file serve, log to `AuditLog` with `action = 'file_download'`, `entityId = filePath`, `userId`, `tenantId`.

### 5.4 Migration strategy documentation
- Add `docs/MIGRATIONS.md` with: how to create migrations, apply in staging, apply in production, rollback procedure for Hostinger MySQL.

### 5.5 Cron external scheduler setup
- Add `docs/CRON_SETUP.md` documenting Hostinger cron → `GET /api/cron/accrue-penalties?secret=` + `GET /api/cron/dunning?secret=` with recommended schedule.

---

## Phase 6 — P1 Features

*Depends on: Phases 1–3 complete.*

### 6.1 NPA classification cron
- `app/api/cron/npa-classify/route.ts`: find all active loans where oldest unpaid instalment's `dueDate` is 90+ days ago. Set `loan.npaStatus = 'NPA'`, `loan.npaClassifiedAt = now`. Create audit log.
- Surface NPA flag in loan detail view and reports.

### 6.2 PDF repayment receipts
- Install `@react-pdf/renderer`.
- `app/api/loans/[id]/receipt/route.ts`: generate PDF receipt for a given CollectionEntry/Payment showing loan code, borrower name, amount, date, instalment details.

### 6.3 SMS/WhatsApp notification delivery
- `lib/sms.ts`: implement provider adapter interface (start with MSG91 or Twilio, configurable via env).
- Integrate into existing notification template system: after inserting `SystemNotification`, if template has `smsEnabled`, call `sendSms()`.

### 6.4 2FA for privileged users
- Install `otplib` for TOTP.
- Add `totpSecret String?` to `User` model in schema.
- `app/(dashboard)/settings/`: add 2FA setup page (QR code via `qrcode` package).
- `lib/auth.ts` — authorize: if user has `totpSecret` set and role is admin/superadmin/developer, require a `totp` field in credentials. Validate with `totp.verify()`.

### 6.5 Borrower self-service portal
- `app/portal/borrower/`: new route group with OTP-based login (phone → OTP → session).
- Pages: loan summary, instalment schedule, payment history, download receipt.
- Requires: OTP delivery via SMS (6.3), Payment model (2.1).

---

## Phase 7 — P2 Product Maturity

*Can be parallelized; each is independently shippable.*

### 7.1 Agent performance dashboard
- `app/(dashboard)/dashboard/agent/page.tsx`: show today's collection targets, collections done, pending loans, overdue count for the logged-in agent's route.

### 7.2 Bulk imports
- `app/(dashboard)/customers/import/page.tsx`: CSV upload → parse → validate with Zod → batch `createMany`.
- `app/(dashboard)/collection/import/page.tsx`: bulk collection CSV upload.

### 7.3 Scheduled email reports
- `app/api/cron/reports/route.ts`: weekly/monthly collection summary email per tenant admin using existing notification infrastructure.

### 7.4 Remember Me fix
- `app/login/page.tsx`: wire checkbox value to `signIn` call, pass `callbackUrl` with session maxAge param. Configure `auth.ts` session strategy to honor extended session.

### 7.5 Reserved slug validation
- `app/admin/` tenant creation action: validate slug against reserved list before insert.
- `proxy.ts`: when `getTenantIdFromHost()` returns null and slug exists but is reserved, return branded error page.

### 7.6 Canonical customer URL redirect
- `app/(dashboard)/customers/[id]/page.tsx`: if param is a numeric ID (not customer code), redirect 301 to `/customers/[customerCode]`.

---

## Relevant Files

- `app/(dashboard)/loans/actions.ts` — updateLoan fix (1.3)
- `app/(dashboard)/loans/[id]/actions.ts` — closeLoan (1.4), renewLoan (1.5)
- `app/(dashboard)/vehicles/actions.ts` — tenantId WHERE fix (1.1)
- `app/(dashboard)/chits/actions.ts` — tenantId WHERE fix (1.1)
- `app/(dashboard)/approvals/actions.ts` — tenantId WHERE fix (1.1)
- `app/(dashboard)/penalties/actions.ts` — tenantId WHERE fix (1.1)
- `lib/auth.ts` — login tenant-scope (1.2)
- `lib/tenant.ts` — reserved slug, not-found redirect (1.2, 7.5)
- `lib/repayments.ts` — hasFinancialActivity helper (1.6)
- `lib/serverActionAuth.ts` — to be adopted by all action files (3.1)
- `lib/razorpay.ts` — checkout helper (4.1)
- `lib/schemas/` — new Zod schemas folder (3.2)
- `lib/logger.ts` — new structured logger (5.2)
- `lib/sms.ts` — new SMS adapter (6.3)
- `prisma/schema.prisma` — Payment, PaymentAllocation, BillingInvoice, CronLock, NPA fields, soft delete (Phase 2)
- `app/api/upload/route.ts` — magic byte validation (1.7)
- `app/api/cron/accrue-penalties/route.ts` — cron lock (1.8)
- `app/api/cron/dunning/route.ts` — new dunning job (4.3)
- `app/api/cron/npa-classify/route.ts` — new NPA job (6.1)
- `app/api/files/[...path]/route.ts` — file audit trail (5.3)
- `app/api/webhooks/razorpay/route.ts` — idempotency fix, invoice creation (4.2, 4.4)
- `app/portal/billing/page.tsx` — self-serve checkout UI (4.1, 4.2)
- `next.config.ts` — CSP hardening (3.5)
- `proxy.ts` — tenant not-found page (1.2)

---

## Verification

1. After Phase 1: run `tests/security.test.ts` + manual test: call `clearRepoFlag(vehicleIdFromDifferentTenant)` and assert 403/error.
2. After Phase 1.3: manually attempt to update a loan that has collection entries; verify error returned and NO loan mutation occurred.
3. After Phase 1.4: attempt to close a loan with unpaid instalments; verify blocked with descriptive error.
4. After Phase 2: run `npx prisma migrate dev` to verify migrations apply cleanly.
5. After Phase 3.1: grep for `const session = await auth()` in action files — should be zero direct usages outside serverActionAuth.ts.
6. After Phase 3.2: submit a form with missing required fields; verify structured Zod error is returned.
7. After Phase 3.3: grep for `alert(` in client components — should be zero.
8. After Phase 4.1: walk through Razorpay plan selection → checkout → webhook simulation → subscription activated → tenant status updated.
9. After Phase 5.1: throw a test error in a server action; verify it appears in Sentry dashboard.
10. After Phase 6.1: seed a loan 91 days past due; run cron; verify `npaStatus = 'NPA'`.

---

## Decisions

- **No Redis / Upstash**: all rate-limiting, cron locks, and queuing use MySQL tables (Hostinger compatible).
- **No external file storage** (Phase 1): keep local disk upload; document risk in CRON_SETUP.md. Phase 2+ can add S3.
- **Zod over Yup**: Zod is the Next.js/tRPC community standard and already implied by the stack.
- **CSP nonce migration**: phased — Phase 3.5 is a separate tracked task, not blocking other phases.
- **2FA**: TOTP (Google Authenticator compatible) before SMS OTP — simpler, no SMS cost for admins.
- **Scope excluded**: bulk disbursement, PWA, GST-ready billing, advanced audit export — deferred to post-launch roadmap.
