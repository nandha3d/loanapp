# HARD-03 — GL Account Codes from `accountingSettings.postingOverrides`

**Priority:** 🟠 HIGH  
**Category:** Hardcoded Values — Accounting  
**Effort:** 45 min

---

## Problem

`lib/accounting/autoPost.ts` lines 51–53 hardcode default GL account codes:

```typescript
const [lrId, cashId, bankId] = await Promise.all([
  getAcctId(opts.tenantId, '1310'), // Loan Principal Receivable
  getAcctId(opts.tenantId, '1100'), // Cash on Hand
  getAcctId(opts.tenantId, '1200'), // Bank Accounts
]);
```

These codes come from the default Chart of Accounts seed (`lib/accounting/seedDefaultCoA.ts`). However:
- A tenant may rename or renumber their accounts
- A tenant who imports an existing CoA from Tally or another ERP will have different codes
- The `accountingSettings.postingOverrides` JSON field exists exactly for this purpose but is never read

---

## Current `AccountingSettings` Model

```prisma
model AccountingSettings {
  tenantId         String  @id
  postingOverrides String  @default("{}") // JSON: { "loan_receivable": "1310", "cash": "1100", ... }
}
```

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Define the posting override keys

Create `lib/accounting/postingKeys.ts`:

```typescript
// Canonical keys for posting overrides. Values are GL account codes.
export const POSTING_KEYS = {
  loan_receivable:    'loan_receivable',      // default: 1310
  cash_on_hand:       'cash_on_hand',         // default: 1100
  bank_account:       'bank_account',         // default: 1200
  interest_income:    'interest_income',      // default: 4100
  penalty_income:     'penalty_income',       // default: 4200
  nach_suspense:      'nach_suspense',        // default: 2500
  collection_income:  'collection_income',    // default: 4100
} as const;

export type PostingKey = keyof typeof POSTING_KEYS;

export const POSTING_DEFAULTS: Record<PostingKey, string> = {
  loan_receivable:   '1310',
  cash_on_hand:      '1100',
  bank_account:      '1200',
  interest_income:   '4100',
  penalty_income:    '4200',
  nach_suspense:     '2500',
  collection_income: '4100',
};
```

### Step 2 — Create a helper to resolve account codes

Add to `lib/accounting/autoPost.ts` (or a new `lib/accounting/postingResolver.ts`):

```typescript
import { POSTING_DEFAULTS, type PostingKey } from './postingKeys';
import { getOrCreateAccountingSettings } from './premium';

export async function resolveAccountCode(tenantId: string, key: PostingKey): Promise<string> {
  const settings = await getOrCreateAccountingSettings(tenantId);
  let overrides: Record<string, string> = {};
  try {
    overrides = JSON.parse(settings.postingOverrides || '{}');
  } catch {
    // malformed JSON — fall back to defaults
  }
  return overrides[key] ?? POSTING_DEFAULTS[key];
}
```

### Step 3 — Update `autoPost.ts` to use `resolveAccountCode`

**In `autoPostLoanDisburse`**, replace:

```typescript
const [lrId, cashId, bankId] = await Promise.all([
  getAcctId(opts.tenantId, '1310'),
  getAcctId(opts.tenantId, '1100'),
  getAcctId(opts.tenantId, '1200'),
]);
```

**With:**

```typescript
const [lrCode, cashCode, bankCode] = await Promise.all([
  resolveAccountCode(opts.tenantId, 'loan_receivable'),
  resolveAccountCode(opts.tenantId, 'cash_on_hand'),
  resolveAccountCode(opts.tenantId, 'bank_account'),
]);
const [lrId, cashId, bankId] = await Promise.all([
  getAcctId(opts.tenantId, lrCode),
  getAcctId(opts.tenantId, cashCode),
  getAcctId(opts.tenantId, bankCode),
]);
```

Apply the same pattern to **all other `autoPost*` functions** in the file (disbursement, collection, penalty, etc.).

### Step 4 — Accounting Settings UI

In the Accounting Settings page, add a "GL Posting Overrides" section that lets admins map posting keys to their custom account codes:

```tsx
// For each POSTING_KEY, render an input pre-filled with the current override or default
{Object.entries(POSTING_DEFAULTS).map(([key, defaultCode]) => (
  <div key={key}>
    <label>{key.replace(/_/g, ' ')}</label>
    <input
      name={key}
      defaultValue={overrides[key] ?? defaultCode}
      placeholder={defaultCode}
    />
  </div>
))}
```

The PATCH handler for `accountingSettings` should merge the form values into the `postingOverrides` JSON field.

---

## Verification

1. Set `postingOverrides = { "cash_on_hand": "1105" }` for a test tenant
2. Create a cash loan disbursement → auto-posted JE credits account `1105`, not `1100`
3. Tenant with default settings → still uses `1100`
4. `npx tsc --noEmit` → 0 errors
