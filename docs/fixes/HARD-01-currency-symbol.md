# HARD-01 — Replace Hardcoded `"₹"` with `AppSetting.currency_symbol`

**Priority:** 🟠 HIGH  
**Category:** Hardcoded Values — Multi-tenant / Internationalization  
**Effort:** 2–3 hours

---

## Problem

The `"₹"` Rupee symbol is hardcoded in ~12 dashboard component files and in `lib/accounting/premium.ts:49` (`formatIndianCurrency`). For a multi-tenant SaaS deployed in different countries or used by NBFCs dealing in foreign currencies, this must come from a tenant setting.

---

## Affected Files

Run this grep to find all occurrences:

```
grep -rn "₹\|currency_symbol\|\"INR\"" app/components app/dashboard lib --include="*.tsx" --include="*.ts"
```

Known locations:
- `lib/accounting/premium.ts:49` — `formatIndianCurrency(amount, symbol = '₹')`
- Multiple `components/` files with `₹{amount}` or `` `₹${value}` ``
- `lib/nach.ts` — `"INR"` currency code in Razorpay calls (covered by HARD-01b below)

---

## Database Change

Add two `AppSetting` keys with defaults:

| Key | Default | Description |
|-----|---------|-------------|
| `currency_symbol` | `₹` | Display symbol shown in UI |
| `currency_code` | `INR` | ISO 4217 code used in API calls |

No schema migration needed — `AppSetting` is a key-value table.

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Seed default settings (one-time migration)

Create `prisma/seeds/defaultCurrencySettings.ts` or add to existing seed script:

```typescript
// Run once per tenant to insert defaults
async function seedCurrencyDefaults(tenantId: string) {
  await prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId, key: 'currency_symbol' } },
    create: { tenantId, key: 'currency_symbol', value: '₹' },
    update: {},  // don't overwrite if already set
  });
  await prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId, key: 'currency_code' } },
    create: { tenantId, key: 'currency_code', value: 'INR' },
    update: {},
  });
}
```

### Step 2 — Create a server-side currency helper

Create `lib/currency.ts`:

```typescript
import { getSetting } from '@/lib/settings';

export async function getCurrencySymbol(tenantId: string): Promise<string> {
  return (await getSetting(tenantId, 'currency_symbol')) ?? '₹';
}

export async function getCurrencyCode(tenantId: string): Promise<string> {
  return (await getSetting(tenantId, 'currency_code')) ?? 'INR';
}
```

### Step 3 — Create a client-side React hook

Create `hooks/useCurrency.ts`:

```typescript
'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function useCurrencySymbol(): string {
  const { data: session } = useSession();
  const [symbol, setSymbol] = useState('₹');

  useEffect(() => {
    const tenantSymbol = (session as any)?.tenantSettings?.currency_symbol;
    if (tenantSymbol) setSymbol(tenantSymbol);
  }, [session]);

  return symbol;
}
```

> **Note:** This requires `tenantSettings` to be included in the NextAuth session JWT. See the session callback in `lib/auth.ts` — add `currency_symbol` to the token if not already present, fetched once on login.

### Step 4 — Update `formatIndianCurrency` in `lib/accounting/premium.ts`

The function already accepts `symbol` as a parameter with a default of `'₹'`. No change needed here — callers should pass the tenant symbol. The key fix is at call sites.

### Step 5 — Update component files

For each TSX component found in the grep:

**Pattern to find:**
```tsx
₹{amount}
`₹${value}`
"₹"
```

**Replace with:**
```tsx
const currency = useCurrencySymbol(); // from hook
// ...
{currency}{amount}
`${currency}${value}`
```

For server components (RSC) that can't use hooks:

```tsx
// Pass currency from the parent page (which fetches it server-side)
// OR use a server-side helper:
const currencySymbol = await getCurrencySymbol(session.user.tenantId);
```

### Step 6 — Settings UI

Add `currency_symbol` and `currency_code` to the Settings → General page as editable fields. Find `app/dashboard/settings/page.tsx` or similar, add the two fields to the settings form.

---

## Verification

1. Change `currency_symbol` to `$` in AppSetting for a test tenant
2. Dashboard pages show `$` instead of `₹`
3. `npx tsc --noEmit` → 0 errors
