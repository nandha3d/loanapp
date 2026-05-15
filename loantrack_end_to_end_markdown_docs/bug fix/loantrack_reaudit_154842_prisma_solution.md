# LoanTrack Latest Re-Audit — 2026-05-15 15:48 Zip

Source checked: `loanapp_source_20260515_154842.zip`

## Executive Verdict

The latest zip is better than the previous uploaded versions. Several earlier issues are now fixed or partially fixed:

- `zod` dependency is now present.
- `proxy.ts` duplicate `requestedTenantId` issue is fixed.
- `enabledModules` JSON handling is normalized through `normalizeEnabledModules()`.
- `Payment` and `PaymentAllocation` models are now added in Prisma schema.
- `BillingInvoice`, `WebhookEvent`, `RateLimit`, and `CronLock` models are added.
- Private file serving via `/api/files/...` exists.
- Razorpay webhook idempotency exists.
- Borrower portal and invoice page are started.
- CRON secret enforcement is stronger for penalty accrual.

However, it is still **not fully production-ready**. The biggest blocker remains Prisma migrations, followed by a few build/runtime and business-logic issues.

---

## Prisma Migration Status

### Status: Not okay yet

The latest zip contains:

```text
prisma/schema.prisma
prisma/seed.ts
prisma/seed_demo.ts
```

But it still does **not** contain:

```text
prisma/migrations/
```

This means the database schema is defined, but there is no migration history for safe production deployment.

### package.json script gap

Current scripts include:

```json
"db:migrate": "npx prisma migrate dev",
"db:push": "npx prisma db push"
```

But production deployment script is missing:

```json
"db:deploy": "npx prisma migrate deploy"
```

Recommended final scripts:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "npx prisma generate && next build",
    "start": "next start",
    "lint": "eslint",
    "db:validate": "npx prisma validate",
    "db:generate": "npx prisma generate",
    "db:migrate": "npx prisma migrate dev",
    "db:deploy": "npx prisma migrate deploy",
    "db:push": "npx prisma db push",
    "db:seed": "npx tsx prisma/seed.ts",
    "db:studio": "npx prisma studio",
    "db:reset": "npx prisma migrate reset"
  }
}
```

`db:push` may remain for local prototyping only, but it should not be used on production once real data exists.

---

## Complete Prisma Migration Solution

### Case A — Fresh / empty database

Use this if Hostinger DB has no real customers, loans, KYC files, collections, payments, or subscriptions.

Run locally:

```bash
npm install
npx prisma format
npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
```

This creates:

```text
prisma/migrations/<timestamp>_init/migration.sql
```

Then include this folder in source control / zip:

```text
prisma/migrations/
```

For production with terminal/SSH:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

For Hostinger without terminal/SSH:

1. Open `prisma/migrations/<timestamp>_init/migration.sql` locally.
2. Copy the SQL.
3. Open Hostinger phpMyAdmin.
4. Select your MySQL database.
5. Run the SQL manually.
6. Then deploy/build the app.

---

### Case B — Existing database already has data

Use this if you already used `prisma db push`, or your database already has live records.

Do **not** apply a full create-table init migration directly, because it can fail or damage existing tables.

Use Prisma baseline:

```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init
```

Then for every future schema change:

```bash
npx prisma migrate dev --name add_next_change
```

Production deployment:

```bash
npx prisma migrate deploy
```

If Hostinger does not provide terminal access, manually run only the new migration SQL from phpMyAdmin.

---

## Critical Build / Dependency Issue

### Missing dependency: `jose`

The code imports `jose` in:

```text
app/api/borrower/auth/route.ts
lib/borrowerAuth.ts
```

But `package.json` does not include `jose`.

Fix:

```bash
npm install jose
```

Then confirm `package.json` contains:

```json
"jose": "^5.x.x"
```

or a compatible version.

Without this, borrower login/dashboard code can fail at build or runtime.

---

## Important Runtime / Logic Findings

### 1. CollectionEntry `tenantId` is optional and not populated

Prisma schema:

```prisma
model CollectionEntry {
  tenantId String? @map("tenant_id")
}
```

But collection entry creation does not set `tenantId` in:

```text
app/(dashboard)/collection/actions.ts
app/api/collection/route.ts
```

Impact:

- `/api/loans/[id]/receipt` searches by `entryId + tenantId`, so receipts may not be found.
- Report cron aggregates by `tenantId`, so collection reports can show zero.
- Tenant isolation is weaker for collection entries.

Fix:

1. Make `tenantId` required in `CollectionEntry`.
2. Always set `tenantId` while creating collection entries.
3. Add migration to backfill old rows from `DailyCollection.tenantId`.

Recommended SQL concept:

```sql
UPDATE collection_entries ce
JOIN daily_collections dc ON dc.id = ce.collection_id
SET ce.tenant_id = dc.tenant_id
WHERE ce.tenant_id IS NULL;
```

Then make the column required.

---

### 2. Payment ledger is only partially wired

`Payment` and `PaymentAllocation` models exist.

`app/(dashboard)/collection/actions.ts` creates a payment ledger record, but:

```text
app/api/collection/route.ts
```

still creates collection entries without creating `Payment` and `PaymentAllocation`.

Fix:

Create `Payment` and `PaymentAllocation` consistently in both UI server action and API route. Better approach: move payment recording into one shared service function, for example:

```text
lib/paymentService.ts
recordLoanPayment()
```

Then call it from both:

```text
app/(dashboard)/collection/actions.ts
app/api/collection/route.ts
```

---

### 3. Receipt PDF route has field mismatch

`app/api/loans/[id]/receipt/route.tsx` uses:

```tsx
entry.date
entry.amount
```

But `CollectionEntry` has:

```prisma
submittedAt
receivedAmount
```

Fix:

Use:

```tsx
entry.submittedAt
entry.receivedAmount
```

Also ensure `CollectionEntry.tenantId` is populated, otherwise receipt lookup may fail.

---

### 4. Razorpay self-serve checkout is not complete

`createRazorpaySubscription(planId, tenantId)` sends the app plan key such as `basic` or `pro` as Razorpay `plan_id`.

Razorpay expects actual plan IDs such as:

```text
plan_xxxxxxxxxx
```

Fix:

Add environment variables:

```env
RAZORPAY_PLAN_BASIC=plan_xxx
RAZORPAY_PLAN_PRO=plan_yyy
RAZORPAY_PLAN_ENTERPRISE=plan_zzz
```

Map app plan to Razorpay plan ID before creating subscription.

Also webhook invoice amount is hardcoded:

```ts
amount: 1000,
tax: 180,
total: 1180
```

Fix: read actual payment/invoice amount from Razorpay payload, or map it from plan pricing.

---

### 5. NPA classification query uses wrong statuses

`app/api/cron/npa-classify/route.ts` checks instalment status:

```ts
status: { in: ['pending', 'overdue'] }
```

But your instalment statuses are mainly:

```text
upcoming, missed, partial, paid
```

Impact:

NPA cron may never classify loans.

Fix:

Use statuses like:

```ts
status: { in: ['missed', 'partial', 'upcoming'] }
```

with `dueDate < 90 days ago` and `receivedAmount < dueAmount`.

---

### 6. Chit group member creation is not tenant-safe enough

`createChitGroup()` accepts `memberIds` and directly creates `ChitMember` records. It does not validate that all selected customers belong to the current tenant/app before creation.

Fix before creation:

```ts
const validCustomers = await prisma.customer.findMany({
  where: { id: { in: memberIds }, tenantId, appType, status: 'active' },
  select: { id: true },
});

if (validCustomers.length !== memberIds.length) {
  throw new Error('One or more chit members are invalid for this tenant/app.');
}
```

---

### 7. Borrower portal is started but not tenant/subdomain safe

Borrower login finds loan by:

```ts
loanCode + customer.phone + status active
```

But `loanCode` is unique only within a tenant, not globally.

Fix:

Resolve tenant from host/subdomain and add:

```ts
tenantId: resolvedTenantId
```

to borrower login query.

Also add rate limiting to borrower login.

---

### 8. Bulk customer import stores Aadhaar in plaintext

`importCustomers()` uses:

```ts
aadharNumber: item.aadhaar || item.aadharNumber || null
```

Fix:

Use:

```ts
aadharNumber: encryptAadharNumber(item.aadhaar || item.aadharNumber || null)
```

---

### 9. Server action file uploads need magic-byte validation

`/api/upload` has magic-byte validation, but `saveUploadedFile()` inside customer server actions validates only MIME and file size.

Fix:

Move upload validation into a shared helper:

```text
lib/fileUpload.ts
```

Use the same validation in both:

```text
app/api/upload/route.ts
app/(dashboard)/customers/actions.ts
```

---

### 10. Demo/private uploaded files are included in zip

Current zip contains:

```text
private/uploads/guarantors/1778589369044_fr7aj9nte1.avif
private/uploads/profiles/1778589369043_yxpdl1kcacq.avif
```

Remove uploaded/private files from production/source zip and add `.gitignore` entries:

```gitignore
.env
.env.*
private/uploads/**
public/uploads/**
!.env.example
```

---

## Updated Scores

| Area | Score | Status |
|---|---:|---|
| UI & UX | 7.4/10 | Improved, still needs loading/empty states consistency |
| Logic Workflow | 7.0/10 | Better, but collection/payment/NPA issues remain |
| Link / Route / Slug Management | 7.4/10 | Improved, tenant host logic better |
| Security & Auth | 7.2/10 | Better, but borrower login and uploads need fixes |
| Architecture & Code Quality | 7.4/10 | Improved, but shared payment/file services needed |
| Data Model & Schema | 7.6/10 | Better, but no migrations and CollectionEntry tenantId issue |
| Feature Completeness | 7.3/10 | Better, borrower/receipt/billing started |
| Subscription & Billing | 6.1/10 | Improved, but Razorpay plan mapping and real invoice data pending |
| Multi-Tenancy & Isolation | 7.2/10 | Better, but still cross-tenant gaps in chits/borrower |
| Observability & Operations | 5.4/10 | Structured logger exists, but no Sentry/backup/deployment runbook |
| **Overall** | **6.95/10** | Strong MVP, not production-ready yet |

---

## Go / No-Go

### Current status

**No-Go for production with real customer/KYC/payment data until the migration and critical runtime issues are fixed.**

### Minimum must-fix before Hostinger deployment

1. Create `prisma/migrations/`.
2. Add `db:deploy` script.
3. Add missing `jose` dependency.
4. Make `CollectionEntry.tenantId` required and always populated.
5. Wire `Payment` and `PaymentAllocation` into `/api/collection/route.ts`.
6. Fix receipt route field names.
7. Fix Razorpay plan ID mapping.
8. Fix NPA classification statuses.
9. Validate chit members by tenant/app before creation.
10. Remove `private/uploads/**` from source zip.

---

## Codex Prompt to Fix Everything

```text
You are working on the LoanTrack Next.js + Prisma + MySQL app.

Fix the latest production blockers.

1. Prisma migrations
- Do not use prisma db push for production.
- Add prisma/migrations.
- If this is a fresh database, run:
  npx prisma format
  npx prisma validate
  npx prisma migrate dev --name init
- Add package.json scripts:
  db:validate = npx prisma validate
  db:generate = npx prisma generate
  db:migrate = npx prisma migrate dev
  db:deploy = npx prisma migrate deploy
- Keep db:push only for local prototyping and document not to use it in production.

2. Missing dependency
- Add jose to package.json because borrowerAuth.ts and borrower auth route import jose.

3. CollectionEntry tenant isolation
- Make CollectionEntry.tenantId required in Prisma schema.
- Add relation to Tenant if needed.
- Backfill existing collection_entries.tenant_id from daily_collections.tenant_id in migration SQL.
- Set tenantId whenever creating CollectionEntry in:
  app/(dashboard)/collection/actions.ts
  app/api/collection/route.ts

4. Payment ledger consistency
- Move collection/payment creation into a shared service, e.g. lib/paymentService.ts.
- Ensure every collection payment creates:
  CollectionEntry
  Payment
  PaymentAllocation
  Instalment receivedAmount update
  Loan summary recalculation
  AuditLog
- Use this service from both UI server action and API route.

5. Receipt route fix
- In app/api/loans/[id]/receipt/route.tsx replace entry.date with entry.submittedAt.
- Replace entry.amount with entry.receivedAmount.
- Ensure the route authorizes tenant and branch correctly.

6. Razorpay checkout fix
- Do not pass basic/pro directly as Razorpay plan_id.
- Add env mapping:
  RAZORPAY_PLAN_BASIC
  RAZORPAY_PLAN_PRO
  RAZORPAY_PLAN_ENTERPRISE
- Map internal plan names to actual Razorpay plan IDs.
- In webhook invoice generation, do not hardcode amount/tax/total. Use payload values if available or plan pricing config.

7. NPA cron fix
- Update npa-classify cron to use actual instalment statuses: missed, partial, upcoming.
- Also check receivedAmount < dueAmount and dueDate older than 90 days.
- Keep CRON_SECRET mandatory and prefer Authorization: Bearer <CRON_SECRET> instead of query param secret.

8. Chit member tenant validation
- Before creating chit members, validate all memberIds belong to current tenant/app and are active customers.
- Fail the request if any member is invalid.

9. Borrower portal tenant safety
- Resolve tenant from host/subdomain in borrower auth route.
- Add tenantId to borrower loan lookup.
- Add rate limiting to borrower login.
- Do not use fallback borrower_secret_key_123 in production. Require NEXTAUTH_SECRET.

10. Aadhaar encryption in bulk import
- In importCustomers(), encrypt aadhaar/aadharNumber before saving.

11. Upload validation
- Extract magic-byte file validation into lib/fileUpload.ts.
- Use it in both app/api/upload/route.ts and app/(dashboard)/customers/actions.ts.

12. Source hygiene
- Remove private/uploads/** and public/uploads/** from production zip.
- Add .gitignore entries for .env, .env.*, private/uploads/**, public/uploads/**, but keep .env.example.

13. Validation
- Run:
  npm install
  npx prisma validate
  npx prisma generate
  npm run lint
  npm run build
  npm run test:security
  npm run test:repayments
  npm run test:collectionAction if available
- Fix all errors before final response.
```
