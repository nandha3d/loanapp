# LoanTrack — Full Module Audit v5
> Verified against `loanapp_source_20260528_124712.zip`
> Covers: WhatsApp/SMS, Receipt PDF, CIBIL/Bureau, Foreclosure, NPA, Bulk Import, Video KYC, GPS, Accounting module

---

## Summary Score

| Module | Status | Critical Issues |
|---|---|---|
| WhatsApp / SMS | ✅ Implemented | 0 |
| Payment Receipt PDF | ✅ Implemented | 1 minor |
| CIBIL / Bureau pull | ✅ Implemented | 1 critical env missing |
| Foreclosure / Early Settlement | ✅ Implemented | 0 |
| NPA Classification | ✅ Implemented | **2 critical** |
| Bulk Import | ❌ Not found | — |
| Video KYC / Aadhaar OTP | ✅ Implemented | 1 minor |
| GPS Collection Tracking | ✅ Implemented | 1 medium |
| Accounting Module | ✅ Implemented (new!) | **1 critical merge conflict** |
| Architecture change `[module]` routing | ✅ Correct | 0 |
| Flutter mobile app | ✅ Present | 1 critical env missing |
| v1 API layer (mobile) | ✅ Implemented | 1 medium |

---

## CRITICAL — Unresolved Git Merge Conflict in Production File

**File:** `app/(dashboard)/[module]/collection/CollectionClient.tsx`

The file `conflicts.patch` confirms this is an active 3-way merge conflict that was **not resolved before zipping**. The file contains:

```
++<<<<<<< HEAD
 ...one developer's version of the Pay/Edit button...
++=======
 ...other developer's version with receipt PDF button...
```

**This will cause a TypeScript compile error and the collection page will fail to build entirely.**

**Fix — choose one resolution and remove the conflict markers:**

The correct resolution is the **second developer's version** (after `=======`) because it includes:
- Role-aware Edit vs Request button for paid instalments
- Receipt PDF download button for paid instalments (new feature)

Delete everything between `++<<<<<<< HEAD` and `++=======` (inclusive), keep the code after `++=======`, and remove the `++>>>>>>> branch-name` line at the end of the conflict block.

---

## Module 1 — WhatsApp / SMS ✅

**Files:** `lib/notify/channels/sms.ts`, `lib/notify/channels/whatsapp.ts`, `lib/notify/events.ts`

**What's correct:**
- `notify()` is called in collection actions (line 269) and loan actions (line 403) — confirmed
- Per-tenant settings via `getSetting()` — correct, no hardcoding
- WhatsApp + SMS fallback logic — correct
- `NotificationLog` model in schema — present
- EN/TA/HI message templates — all present
- Due-date reminder cron at `/api/cron/send-reminders` — present

**Issue — MSG91 SMS uses wrong endpoint:**

`lib/notify/channels/sms.ts` sends to `https://api.msg91.com/api/v5/flow/` (the Flow API, which is for OTP flows with pre-registered templates). For plain transactional SMS, the correct endpoint is:

```ts
// Wrong:
'https://api.msg91.com/api/v5/flow/'
// Correct for plain SMS:
'https://api.msg91.com/api/v5/sms'
// Body for plain SMS:
{ sender: senderId, route: '4', country: '91',
  sms: [{ message, to: [normalised] }] }
```

The Flow API requires a `template_id` which is not being sent. SMS will silently fail for all tenants. **Fix the endpoint and body format.**

---

## Module 2 — Payment Receipt PDF ✅

**Files:** `lib/receipt.tsx`, `app/api/loans/[id]/receipt/route.tsx`, `app/api/receipts/[entryId]/route.ts`

**What's correct:** Both receipt endpoints exist. PDF generation uses `@react-pdf/renderer`.

**Issue — `route.tsx` inline PDF vs `lib/receipt.tsx`:**

`app/api/loans/[id]/receipt/route.tsx` has its own inline PDF component with basic styling, while `lib/receipt.tsx` has the fully styled A5 receipt with branding, amount box, and footer. These are two different implementations for the same feature. The `receipts/[entryId]/route.ts` correctly uses `lib/receipt.tsx`.

The `loans/[id]/receipt/route.tsx` should be deleted and replaced with a redirect to `/api/receipts/:entryId` OR updated to use `lib/receipt.tsx`. Having two receipt implementations will cause inconsistent PDFs.

---

## Module 3 — CIBIL / Bureau Pull ✅

**Files:** `lib/bureau/bureauService.ts`, `lib/bureau/providers/cibil.ts`, `lib/bureau/providers/crif.ts`, `app/api/bureau/pull/route.ts`, `app/api/bureau/history/[customerId]/route.ts`

**What's correct:** Full bureau service with CRIF and CIBIL providers, consent tracking, `BureauReport` model in schema, bureau pull history API, `bureauPullsIncluded/Used` on `TenantSubscription`.

**Critical Issue — `socks-proxy-agent` is imported but not in `package.json`:**

```ts
// lib/bureau/bureauService.ts line 4:
import { SocksProxyAgent } from 'socks-proxy-agent';
```

Check if `socks-proxy-agent` is in `package.json`:
```bash
grep "socks-proxy-agent" package.json
```

If missing, the build will fail when `bureauService.ts` is compiled. Install it:
```bash
npm install socks-proxy-agent
```

**Issue — `MOBILE_JWT_SECRET` not in `.env`:**

`lib/api/v1-auth.ts` reads `process.env.MOBILE_JWT_SECRET`. It's not in the `.env` file. Add:
```bash
MOBILE_JWT_SECRET=generate-a-long-random-secret-here
```

This affects all mobile API routes — they will use `NEXTAUTH_SECRET` as fallback, which works but means the same secret is shared between web sessions and mobile tokens. Recommended to set a separate value.

---

## Module 4 — Foreclosure / Early Settlement ✅

**Files:** `lib/foreclosure.ts`, `app/api/loans/[id]/foreclosure-calc/route.ts`, `lib/loanStatement.tsx`, `app/api/loans/[id]/statement/route.ts`

**What's correct:** Full calculation engine with line items, `closureType/foreclosureAmount/foreclosureDiscount/foreclosureById` on `Loan` schema, statement PDF via `lib/loanStatement.tsx`, foreclosure settlement letter PDF.

**No critical issues found.** Schema fields all confirmed present. `forecloseLoan()` action confirmed in `loans/[id]/actions.ts`.

---

## Module 5 — NPA Classification ✅ with 2 critical issues

**Files:** `lib/npa/npaClassifier.ts`, `lib/npa/provisioningCalculator.ts`, `lib/npa/npaUpgrade.ts`, `app/api/cron/npa-classify/route.ts`, `app/api/npa/*`

**What's correct:** Full RBI asset category classification (standard → SMA-0 → SMA-1 → SMA-2 → sub_standard → doubtful → loss), provisioning calculator, upgrade/downgrade tracking. Schema has `npaStatus`, `npaDaysOverdue`, `isSecured` on `Loan`.

**Critical Issue 1 — NPA cron NOT in `vercel.json`:**

`vercel.json` only has:
```json
{ "path": "/api/cron/send-reminders", "schedule": "30 2 * * *" },
{ "path": "/api/cron/send-reports",   "schedule": "30 2 * * 1" }
```

Missing cron entries:
```json
{ "path": "/api/cron/npa-classify",      "schedule": "0 2 * * *"   },
{ "path": "/api/cron/accrue-penalties",  "schedule": "30 18 * * *" },
{ "path": "/api/cron/dunning",           "schedule": "0 9 * * *"   },
{ "path": "/api/cron/recompute-balances","schedule": "0 3 * * 0"   }
```

Without these, NPA will never auto-classify and penalties will never auto-accrue.

**Critical Issue 2 — `npaEnabled` boolean missing from seed:**

The NPA cron only processes tenants where `npaEnabled = true` on `TenantSubscription`:
```ts
where: { npaEnabled: true }
```

But `prisma/seed.ts` does not set `npaEnabled: true` for the default tenant subscription. Every fresh install will have `npaEnabled: false` and NPA will silently never run.

**Fix in `prisma/seed.ts`:**
```ts
await prisma.tenantSubscription.upsert({
  where: { tenantId: tenant.id },
  create: { tenantId: tenant.id, plan: 'pro', npaEnabled: true, ... },
  update: { npaEnabled: true },
});
```

---

## Module 6 — Bulk Import ❌

**Status: Not implemented anywhere in the codebase.**

No `import/`, no `bulk/`, no CSV upload handler for customers or loans. This was listed as a missing feature and remains missing.

---

## Module 7 — Video KYC / Aadhaar OTP ✅

**Files:** `lib/kyc/digio.ts`, `lib/kyc/index.ts`, `app/api/kyc/aadhaar-otp/route.ts`, `app/api/kyc/video/route.ts`, `app/api/webhooks/kyc/route.ts`

**What's correct:** Full Digio integration, `KycSession` model in schema, both Aadhaar OTP and Video KYC flows, webhook handler, customer KYC fields in schema.

**Issue — `DIGIO_CLIENT_ID` / `DIGIO_CLIENT_SECRET` missing from `.env`:**

None of the Digio env vars are in the `.env` file. They are checked at runtime (`if (!CLIENT_ID)`) so the app won't crash, but all KYC calls will silently return `{ success: false, error: 'Digio credentials not configured' }`.

Add to `.env`:
```bash
DIGIO_CLIENT_ID=your_client_id
DIGIO_CLIENT_SECRET=your_client_secret
DIGIO_BASE_URL=https://ext.digio.in:444
DIGIO_WEBHOOK_SECRET=your_webhook_secret
```

---

## Module 8 — GPS Collection Tracking ✅

**Files:** `lib/gps/routeProgress.ts`, `lib/gps/locationVerifier.ts`, `app/api/gps/heartbeat/route.ts`, `app/api/gps/route-progress/route.ts`, `app/api/v1/gps/*`, `AgentLocationPing` model in schema

**What's correct:** GPS ping heartbeat, route progress calculation, live location for admin route tracker page, subscription gating (`isGpsTrackingEnabled`).

**Issue — `gpsTrackingEnabled` field missing from `TenantSubscription` in schema check:**

`lib/gps/locationVerifier.ts` calls `isGpsTrackingEnabled(tenantId)`. Verify this field exists:
```bash
grep "gpsTracking\|gps_tracking" prisma/schema.prisma
```

If it maps to a setting key rather than a schema field, document it — the current implementation reads from `AppSetting`. This is fine but the field name must be consistent between `locationVerifier.ts` and the settings page where it's toggled.

---

## Module 9 — Accounting Module ✅ (Unexpected new module)

**This is a completely new module not previously discussed.** Both developers added a full double-entry accounting system. It includes: Chart of Accounts, Journal Entries, Bank Reconciliation, P&L, Balance Sheet, Budget, Trial Balance, Period Lock, Tax, Vendors.

**Files:** `app/(dashboard)/[module]/accounting/premium/*`, `lib/accounting/*`, schema models `Account`, `JournalEntry`, `JournalLine`, `AccountBalance`, `BankAccount`, `AccountingPeriod`

**What's correct:** Architecture is sound. Premium gating via `isPremiumAccountingEnabled()`. Role access (admin+). Auto-posting of loan disbursals and collections via `lib/accounting/autoPost.ts`.

**No blocking issues found.** However this is a large, complex module that needs its own QA pass.

---

## Module 10 — Architecture: `[module]` Route Structure ✅

**The routing architecture has been completely refactored correctly.** URLs are now:
- `/microlending/collection` instead of `/collection`
- `/autofinance/vehicles` instead of `/vehicles`
- `/chitfunds/chits` instead of `/chits`

All old flat `(dashboard)/*` routes have been removed and replaced with `(dashboard)/[module]/*`. The `types/modules.ts` file correctly defines all module routes. The `middleware.ts` uses `parseModulePath` for role-based blocking.

**One issue — `/loans` is not blocked for agents in `AGENT_BLOCKED`:**

```ts
// middleware.ts
const AGENT_BLOCKED = [
  '/dashboard', '/vehicles', '/chits', '/penalties',
  '/reports', '/settings', '/subscription', '/accounting', '/analytics',
];
```

`/loans` is missing from this list. An agent can access `/microlending/loans` directly by URL. The page-level guard in `loans/page.tsx` should catch this, but it's defence-in-depth. Add `/loans` to `AGENT_BLOCKED`.

---

## Complete `vercel.json` Fix

Replace current `vercel.json` with:

```json
{
  "crons": [
    { "path": "/api/cron/accrue-penalties",   "schedule": "30 18 * * *" },
    { "path": "/api/cron/npa-classify",       "schedule": "0 20 * * *"  },
    { "path": "/api/cron/send-reminders",     "schedule": "30 2 * * *"  },
    { "path": "/api/cron/send-reports",       "schedule": "30 2 * * 1"  },
    { "path": "/api/cron/dunning",            "schedule": "0 4 * * *"   },
    { "path": "/api/cron/recompute-balances", "schedule": "0 21 * * 0"  }
  ]
}
```

All times in UTC. `accrue-penalties` at 18:30 UTC = midnight IST. `npa-classify` at 20:00 UTC = 01:30 AM IST (after penalty accrual). `recompute-balances` weekly on Sunday.

---

## Complete `.env` Additions Required

```bash
# Mobile API (v1 routes)
MOBILE_JWT_SECRET=generate-64-char-hex-here

# Bureau integration (CRIF/CIBIL)
CRIF_API_URL=
CRIF_USERNAME=
CRIF_PASSWORD=
CRIF_MEMBER_ID=
CIBIL_API_URL=
CIBIL_CONSUMER_KEY=
CIBIL_CONSUMER_SECRET=
CIBIL_MEMBER_ID=

# Digio KYC
DIGIO_CLIENT_ID=
DIGIO_CLIENT_SECRET=
DIGIO_BASE_URL=https://ext.digio.in:444
DIGIO_WEBHOOK_SECRET=

# GPS tracking (existing feature, no new env needed)

# Notifications (already in .env template)
# MSG91_AUTH_KEY=
# MSG91_SENDER_ID=LNTRCK
# MSG91_WHATSAPP_NUMBER=
```

---

## Quick Fix Priority List

| Priority | Fix | File | Effort |
|---|---|---|---|
| P0 — Blocker | Resolve git merge conflict | `app/(dashboard)/[module]/collection/CollectionClient.tsx` | 15 min |
| P0 — Silent failure | Fix SMS API endpoint | `lib/notify/channels/sms.ts` | 5 min |
| P0 — NPA never runs | Add missing crons to vercel.json | `vercel.json` | 5 min |
| P0 — NPA never runs | Set `npaEnabled: true` in seed | `prisma/seed.ts` | 5 min |
| P1 — Build may fail | Check/install `socks-proxy-agent` | `package.json` | 5 min |
| P1 — Mobile auth | Add `MOBILE_JWT_SECRET` to `.env` | `.env` | 2 min |
| P1 — KYC silent fail | Add Digio env vars | `.env` | 2 min |
| P2 — Security | Add `/loans` to `AGENT_BLOCKED` | `middleware.ts` | 2 min |
| P2 — Inconsistent PDFs | Remove duplicate receipt route | `app/api/loans/[id]/receipt/route.tsx` | 10 min |
