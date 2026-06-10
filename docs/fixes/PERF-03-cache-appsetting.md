# PERF-03 — In-Process Cache for `AppSetting` + Subscription Status

**Priority:** 🟡 MEDIUM  
**Category:** Performance — DB read reduction  
**Effort:** 45 min

---

## Problem

`AppSetting` and `TenantSubscription` rows are read on **every API request** — for auth guards, feature flags, accounting mode checks, and Razorpay config. On a low-spec VPS with a collocated MySQL instance this adds 5–20ms per request. With 50+ concurrent requests these reads become the bottleneck.

Specific hot paths (called on every API hit):
- `getTenantRazorpayConfig(tenantId)` — reads `AppSetting` row
- `isPremiumAccountingEnabled(tenantId)` — reads `TenantSubscription`
- `isGpsTrackingEnabled(tenantId)` — reads `AppSetting`
- `getSetting(tenantId, key)` — generic AppSetting read

`AppSetting` rows change rarely (only when an admin updates settings). A 30-second TTL cache is safe and cuts DB reads by ~95%.

---

## Files to Create / Modify

- **Create:** `lib/cache/tenantCache.ts` — in-process TTL Map
- **Modify:** Any `lib/*.ts` that directly calls `prisma.appSetting.findUnique` or `prisma.tenantSubscription.findUnique`

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Create `lib/cache/tenantCache.ts`

```typescript
// In-process TTL cache for per-tenant settings.
// Single-process deployment (PM2 single instance) — no cross-process invalidation needed.
// Stale data window: 30 seconds. Acceptable for settings that change only on admin action.

type CacheEntry<T> = { value: T; expiresAt: number };

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
    setInterval(() => this.sweep(), ttlMs * 2);
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) this.store.delete(key);
    }
  }
}

// 30-second TTL for settings (changes only on admin action)
export const appSettingCache     = new TtlCache<Record<string, string>>(30_000);
export const subscriptionCache   = new TtlCache<boolean>(30_000);

/**
 * Call this when an admin saves Settings to force an immediate cache bust
 * for that tenant. Call from the settings PATCH/PUT route handler.
 */
export function invalidateTenantCache(tenantId: string): void {
  appSettingCache.delete(tenantId);
  subscriptionCache.delete(tenantId);
}
```

### Step 2 — Find the main AppSetting reader

Search for the function that reads `AppSetting` from DB:

```
grep -rn "appSetting.findUnique\|appSetting.findFirst\|getSetting" lib/ --include="*.ts"
```

Typically in `lib/settings.ts` or `lib/tenantSettings.ts`. The function signature is usually:

```typescript
export async function getSetting(tenantId: string, key: string): Promise<string | null>
```

Wrap it with the cache:

```typescript
import { appSettingCache } from '@/lib/cache/tenantCache';

export async function getAllSettings(tenantId: string): Promise<Record<string, string>> {
  const cached = appSettingCache.get(tenantId);
  if (cached) return cached;

  const rows = await prisma.appSetting.findMany({ where: { tenantId } });
  const map  = Object.fromEntries(rows.map(r => [r.key, r.value ?? '']));
  appSettingCache.set(tenantId, map);
  return map;
}

export async function getSetting(tenantId: string, key: string): Promise<string | null> {
  const all = await getAllSettings(tenantId);
  return all[key] ?? null;
}
```

### Step 3 — Cache `isPremiumAccountingEnabled`

In `lib/accounting/premium.ts`:

```typescript
import { subscriptionCache } from '@/lib/cache/tenantCache';

export async function isPremiumAccountingEnabled(tenantId: string): Promise<boolean> {
  const cached = subscriptionCache.get(`acct:${tenantId}`);
  if (cached !== undefined) return cached;

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { premiumAccountingEnabled: true },
  });
  const enabled = Boolean(sub?.premiumAccountingEnabled);
  subscriptionCache.set(`acct:${tenantId}`, enabled);
  return enabled;
}
```

### Step 4 — Bust cache on settings save

Find the route that handles `PUT /api/v1/settings` or `PATCH /api/admin/settings`. At the end of a successful save, add:

```typescript
import { invalidateTenantCache } from '@/lib/cache/tenantCache';
// ...
invalidateTenantCache(tenantId);
```

---

## Verification

- First request: DB query runs, result cached
- Second request within 30s: no DB query (add a `console.log` in the DB path to verify, then remove)
- After settings save: next request hits DB again (cache busted)
- `npx tsc --noEmit` → 0 errors
