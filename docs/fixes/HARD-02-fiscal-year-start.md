# HARD-02 — Fiscal Year Start Month from `AppSetting`

**Priority:** 🟠 HIGH  
**Category:** Hardcoded Values — Accounting  
**Effort:** 30 min

---

## Problem

`lib/accounting/premium.ts:30`:

```typescript
export function getFiscalYear(date: Date, startMonth = 4): string {
```

The default `startMonth = 4` (April) is the Indian financial year start. However:
- Tenants in other jurisdictions use January (calendar year) or July
- Even in India, some private companies use January–December
- The function accepts `startMonth` as a parameter but all callers pass no argument (use the default)

---

## Affected Files

- `lib/accounting/premium.ts` — `getFiscalYear(date, startMonth = 4)`
- All callers of `getFiscalYear` — run: `grep -rn "getFiscalYear" lib/ app/ --include="*.ts"`
- `prisma/schema.prisma` — verify `AccountingSettings` model has `fyStartMonth` or add it

---

## Database Change

Check if `AccountingSettings` already has a `fyStartMonth` field:

```
grep -n "fyStartMonth\|fy_start_month" prisma/schema.prisma
```

If not present, add to the `AccountingSettings` model:

```prisma
model AccountingSettings {
  // ... existing fields ...
  fyStartMonth Int @default(4) @map("fy_start_month") // 1=Jan ... 12=Dec
}
```

Then run `npx prisma db push`.

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Add `fyStartMonth` to `AccountingSettings` (if missing)

See database change above.

### Step 2 — Create a helper to read FY start

In `lib/accounting/premium.ts`, add:

```typescript
export async function getFyStartMonth(tenantId: string): Promise<number> {
  const settings = await getOrCreateAccountingSettings(tenantId);
  return settings.fyStartMonth ?? 4;
}
```

### Step 3 — Update all callers of `getFiscalYear`

Find every call site with `grep -rn "getFiscalYear" lib/ app/`. For each:

**Before:**
```typescript
const fy = getFiscalYear(date);
// or
const fy = getFiscalYear(date, 4);
```

**After:**
```typescript
const fyStart = await getFyStartMonth(tenantId);
const fy      = getFiscalYear(date, fyStart);
```

Since `getFyStartMonth` is async, callers that were previously synchronous will need to `await` — check that they are already in async contexts (they should be — all are route handlers or service functions).

### Step 4 — Update Settings UI

In the Accounting settings page (`app/dashboard/accounting/settings/page.tsx` or similar):

Add a `fyStartMonth` dropdown:

```tsx
<select name="fyStartMonth" defaultValue={settings.fyStartMonth}>
  <option value={1}>January (Calendar Year)</option>
  <option value={4}>April (Indian FY)</option>
  <option value={7}>July</option>
  <option value={10}>October</option>
</select>
```

The `PATCH /api/v1/accounting/settings` route should already handle `fyStartMonth` in its update payload. If not, add it.

---

## Verification

1. Set `fyStartMonth = 1` (January) for a test tenant
2. Create a journal entry in March 2026 → `getFiscalYear` should return `2026` (calendar year), not `2025-26`
3. Set back to `fyStartMonth = 4` → March 2026 entry returns `2025-26`
4. `npx tsc --noEmit` → 0 errors
