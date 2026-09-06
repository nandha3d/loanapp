# Audit 01 — Tenant / AppType Data Isolation

> Status: **NOT IMPLEMENTED** (audit only). Audited 2026-07-17 @ `52add51`. 196 API routes + 94 dashboard action/page files swept; all context helpers read in full; every flagged site read in context.

## How isolation is supposed to work (verified contracts)

- **`requireMobileContext`** (`lib/api/v1-auth.ts`) — verifies the staff JWT and returns `tenantId`, `branchId`, `role`, and a resolved `appType`. Non-privileged roles are pinned to their own `appType`; only `superadmin`/`developer`/`admin` may switch modules via the `X-App-Type` header. It does **not** inject any Prisma `where` scoping — every handler must add `tenantId`/`appType`/branch itself.
- **`requireBorrowerMobileContext`** (`lib/api/borrower-mobile.ts`) — verifies the borrower JWT, returns `{loanId, tenantId, customerId}`. Identity only; each query must scope by `customerId + tenantId`.
- **`getWebChitScope` / `scopedChitGroupWhere`** (`lib/chits/access.ts`) — hard-pins `appType='chitfunds'` (never read from request context) and injects `tenantId` + branch. This is the corrected pattern from the July-13 appType misfiling bug; chit helpers are clean.

## CONFIRMED FINDINGS (fix required)

### 1. File downloads have no per-entity authorization — HIGH (horizontal leak within tenant)

- **Where:** `app/api/files/[...path]/route.ts:66` → `lib/fileAccessPolicy.ts:6`
- **What:** authorization is tenant-match only:
  ```ts
  return ['superadmin','developer'].includes(input.role || '')
    || input.requestedTenantId === input.sessionTenantId;
  ```
  Files are stored flat per tenant (`uploadBaseDir()/<tenantId>/<name>`), so **any authenticated principal of tenant X — including any borrower** (the route's third auth branch resolves borrower cookie sessions to `role='borrower'`) — can fetch **any other customer's KYC document or payment-proof screenshot** in that tenant if they learn the filename. Names are `Date.now()_random.ext` (not enumerable), so this is a horizontal-authorization / defense-in-depth gap, not a crawlable leak — but filenames do travel (receipts, chat, forwarded links).
- **Fix design:**
  - Keep the tenant check. Add a role-aware entity check for `role === 'borrower'`: new helper `isBorrowerFileAllowed(customerId, tenantId, fileUrl)` in `lib/fileAccessPolicy.ts` that returns true only when the URL appears on one of the borrower's own records:
    - `Customer.profilePhoto` / customer documents for `customerId`;
    - `ChitDocument.fileUrl` rows whose `entityId` resolves to one of the borrower's own `ChitPaymentIntent`s / members' security docs;
    - `PaymentApproval.photoPath` rows for `customerId`.
  - A few indexed lookups; deny by default. Staff (same tenant) behavior unchanged; superadmin/developer unchanged.
- **Verify:** borrower session fetching another customer's file → 403; own profile photo / own proof → 200; staff same-tenant → 200 (unchanged).

### 2. `rejectEntry` mutates cross-tenant by raw id — HIGH (cross-tenant write)

- **Where:** `app/(dashboard)/[module]/accounting/premium/journal/actions.ts:224-225`
- **What:** unlike its siblings `postDraftEntry` (:127), `reverseEntry` (:176), `approveEntry` (:205) — all of which guard with `findFirst({ where: { id, tenantId, status } })` — `rejectEntry` runs:
  ```ts
  await prisma.journalEntry.update({ where: { id }, data: { status: 'rejected' } });
  await prisma.accountingApproval.updateMany({ where: { entityId: id, status: 'pending' }, ... });
  ```
  A privileged user in tenant A who knows a tenant B journal-entry id can reject tenant B's entry and its pending approvals.
- **Fix:** add the same `findFirst({ where: { id, tenantId } })` guard as `approveEntry`; throw not-found otherwise.
- **Verify:** call with a foreign-tenant id → error, no mutation.

### 3. `updateVendor` — cross-tenant write — HIGH

- **Where:** `app/(dashboard)/[module]/accounting/premium/vendors/actions.ts:113`
- **What:** `tenantId` is resolved but only used for the audit log; the mutation is `prisma.vendor.update({ where: { id }, data: input })` with no ownership check (contrast `postBill`/`payBill`/`cancelBill` in the same file, which all guard first).
- **Fix:** `findFirst({ where: { id, tenantId } })` guard before update.

### 4. `deactivateVendor` — cross-tenant write — HIGH

- **Where:** same file, `:125` — `prisma.vendor.update({ where: { id }, data: { isActive: false } })`.
- **Fix:** same guard as #3.

## Verified clean (no action needed)

- **Borrower portal:** `borrower/loans|pay|portal|chits/*|upload` all scope by `customerId + tenantId` from the token; body-supplied ids re-validated (`borrower/pay` re-checks `findFirst({id, tenantId, customerId})`; `createChitPaymentIntent` re-checks subscription ownership + tenant; chit bid route resolves `memberId` server-side, never from the body).
- **appType scoping:** loan/customer/notification/report/analytics/penalty/collection routes consistently filter `tenantId + appType`; `SystemNotification` goes through `buildSystemNotificationWhere`; chit models hard-pinned `'chitfunds'`. (`loans/route.ts:207` voucher-dup check is intentionally tenant-wide.)
- **All v1 `findUnique({where:{id}})` sites** re-verify tenant/appType before returning or mutating (penalties, proofs, receipts, journal, chits, dashboard).
- **`deleteMany`/`updateMany` sites** are preceded by tenant-scoped ownership fetches or carry `tenantId` in the where.

## Noted, not a leak

- `app/api/v1/admin/branches/[id]/route.ts` delegates to the web server action `updateBranch`, which authenticates via the NextAuth **cookie** session, not the mobile Bearer token — ownership is still enforced against the cookie identity, so no isolation hole, but the route almost certainly fails for a pure Bearer mobile client. Fix only if/when mobile actually calls it.

## Verification plan (for the implementation pass)

1. Targeted negative tests (pattern: `tests/chits/*` hand-rolled style): two seeded tenants; assert each fixed action rejects the foreign id and leaves rows untouched.
2. File route: three requests (borrower-own, borrower-foreign, staff-same-tenant) asserting 200/403/200.
3. Re-run the audit greps (`update\(\{ where: \{ id`, `findUnique\(\{ where: \{ id`) and confirm the flagged sites now guard.
