# HARD-05 — NACH Retry / Horizon Config from `AppSetting`

**Priority:** 🟡 MEDIUM  
**Category:** Hardcoded Values — NACH  
**Effort:** 30 min

---

## Problem

`lib/nach.ts` has four hardcoded operational parameters:

| Location | Hardcoded Value | Meaning |
|----------|----------------|---------|
| `handlePresentationFailure` line ~325 | `retryCount < 3` | Max retry attempts before marking `bounced` |
| `handlePresentationFailure` line ~324 | `retryCount * 2` (days) | Retry interval multiplier |
| `findInstalmentsForAutoPresent` line ~400 | `+2 days` | Present N days before due date |
| `app/api/cron/nach-present/route.ts` line 37 | `15 * 60_000` | Cron lock TTL (15 min) |

RBI guidelines suggest NACH bounce retry rules can vary by lender. Operationally, the D-2 horizon is a business decision that should be configurable per tenant.

---

## AppSetting Keys to Add

| Key | Default | Description |
|-----|---------|-------------|
| `nach_max_retries` | `3` | Max retry attempts after bounce before marking `bounced` |
| `nach_retry_interval_days` | `2` | Days between retry attempts |
| `nach_present_days_before` | `2` | Present debit N days before instalment due date |

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Create `lib/nachConfig.ts`

```typescript
import { getSetting } from '@/lib/settings';

export async function getNachConfig(tenantId: string) {
  const [maxRetries, retryIntervalDays, presentDaysBefore] = await Promise.all([
    getSetting(tenantId, 'nach_max_retries'),
    getSetting(tenantId, 'nach_retry_interval_days'),
    getSetting(tenantId, 'nach_present_days_before'),
  ]);
  return {
    maxRetries:        parseInt(maxRetries ?? '3'),
    retryIntervalDays: parseInt(retryIntervalDays ?? '2'),
    presentDaysBefore: parseInt(presentDaysBefore ?? '2'),
  };
}
```

### Step 2 — Update `handlePresentationFailure` in `lib/nach.ts`

The function needs `tenantId` to look up config. Add it to the params:

**Before:**
```typescript
export async function handlePresentationFailure(params: {
  razorpayPaymentId: string;
  errorCode?: string;
  errorDescription?: string;
})
```

**After:**
```typescript
export async function handlePresentationFailure(params: {
  razorpayPaymentId: string;
  errorCode?: string;
  errorDescription?: string;
  tenantId?: string; // optional; falls back to defaults
})
```

Inside the function body, after fetching the `presentation`:

```typescript
import { getNachConfig } from '@/lib/nachConfig';

const tenantId = params.tenantId ?? presentation.tenantId;
const config   = await getNachConfig(tenantId);

const retryCount  = presentation.retryCount + 1;
const nextRetryAt = retryCount < config.maxRetries
  ? new Date(Date.now() + retryCount * config.retryIntervalDays * 24 * 60 * 60 * 1000)
  : null;

const newStatus = retryCount >= config.maxRetries ? 'bounced' : 'failed';
```

The webhook handler already has `tenantId` (resolved from notes) — pass it:
```typescript
await handlePresentationFailure({
  razorpayPaymentId: payment.id,
  errorCode: ...,
  errorDescription: ...,
  tenantId,  // ← add this
});
```

### Step 3 — Update `findInstalmentsForAutoPresent` in `lib/nach.ts`

**Before:**
```typescript
export async function findInstalmentsForAutoPresent(tenantId?: string) {
  // ...
  targetDate.setDate(targetDate.getDate() + 2); // D+2 = present 2 days early
```

**After:**
```typescript
export async function findInstalmentsForAutoPresent(tenantId?: string) {
  const daysBefore = tenantId
    ? parseInt((await getSetting(tenantId, 'nach_present_days_before')) ?? '2')
    : 2;
  // ...
  targetDate.setDate(targetDate.getDate() + daysBefore);
```

> Note: When `tenantId` is undefined (cross-tenant cron), use the global default of 2. This is acceptable — the cron runs for all tenants and each loan's mandate was set up with their tenant's config.

### Step 4 — Settings UI

In Settings → Payments or Settings → NACH, add configurable fields for the three keys. Users should be able to change these without a code deploy.

---

## Verification

1. Set `nach_max_retries = 2` for a test tenant
2. Fail a NACH payment twice → second failure sets status to `bounced` (not `failed`)
3. `npx tsc --noEmit` → 0 errors
