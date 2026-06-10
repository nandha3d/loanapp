# SEC-03 — Zod Validation on Web Collection-Entry Route

**Priority:** 🟠 HIGH  
**Category:** Security — Input Validation  
**Effort:** 20 min

---

## Problem

`app/api/v1/collection/entry/route.ts` (the **mobile** route) uses `requireMobileContext` and manual coercions (`String(body.instalmentId || '')`, `Number(body.receivedAmount)`). Coercing an empty string to a number gives `NaN`, which could cause silent failures downstream.

More critically, the **web collection-entry route** (used by the web dashboard) may accept the same payload structure but with less validation. Identify it and add Zod schema validation to both.

---

## Files Affected

- `app/api/v1/collection/entry/route.ts` — mobile route (tighten coercions)
- Search for the web collection entry route: `grep -r "collection" app/api --include="route.ts" -l`

Common location: `app/api/collection/entry/route.ts` or `app/api/v1/collection/web/route.ts`

---

## Fix Design

Define a shared Zod schema in `lib/schemas/collectionEntry.ts` and use it in both routes.

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Create shared schema

Create `lib/schemas/collectionEntry.ts`:

```typescript
import { z } from 'zod';

export const CollectionEntrySchema = z.object({
  instalmentId:   z.string().min(1, 'instalmentId required'),
  receivedAmount: z.number({ invalid_type_error: 'receivedAmount must be a number' })
                   .positive('receivedAmount must be > 0')
                   .max(10_000_000, 'amount exceeds limit'),
  paymentMode:    z.enum(['cash','bank_transfer','upi','cheque','nach_auto_debit','online'])
                   .default('cash'),
  remarks:        z.string().max(500).nullable().optional(),
  collectionDate: z.string().datetime({ offset: true }).nullable().optional(),
  idempotencyKey: z.string().max(128).optional(),
  // GPS fields — optional, validated only if present
  latitude:       z.number().min(-90).max(90).optional(),
  longitude:      z.number().min(-180).max(180).optional(),
  gpsAccuracy:    z.number().positive().optional(),
});

export type CollectionEntryInput = z.infer<typeof CollectionEntrySchema>;
```

> Zod is already a project dependency (`zod` is used in `app/api/v1/nach/mandate/route.ts`).

### Step 2 — Apply to mobile route

In `app/api/v1/collection/entry/route.ts`, replace the manual coercions:

**Before:**
```typescript
const body = await req.json();
// ... later:
instalmentId: String(body.instalmentId || ''),
receivedAmount: Number(body.receivedAmount),
paymentMode: String(body.paymentMode || 'cash'),
```

**After:**
```typescript
import { CollectionEntrySchema } from '@/lib/schemas/collectionEntry';

const rawBody = await req.json().catch(() => null);
const parsed  = CollectionEntrySchema.safeParse(rawBody);
if (!parsed.success) {
  return fail(parsed.error.errors[0]?.message ?? 'Invalid request', 400);
}
const body = parsed.data;
// Use body.instalmentId, body.receivedAmount, etc. directly (already typed)
```

### Step 3 — Apply to web route

Locate the web collection entry route (from `grep` above). Apply the same pattern — wrap `req.json()` with `CollectionEntrySchema.safeParse()`. The web route uses `auth()` (NextAuth session) instead of `requireMobileContext`, but the body schema is the same.

### Step 4 — Build check

```
npx tsc --noEmit
```

---

## Verification

- `POST /api/v1/collection/entry` with `receivedAmount: "abc"` → 400 with message `"receivedAmount must be a number"`
- `POST /api/v1/collection/entry` with `receivedAmount: -100` → 400 with message `"receivedAmount must be > 0"`
- Valid payload → unchanged behavior (200/201)
- `npx tsc --noEmit` → 0 errors
