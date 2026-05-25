# Premium Accounting Module — Overview

> Status: **Spec draft** · Owner: Developer (`nandhu3d@gmail.com`) · Region preset: **India (GST + TDS)**
>
> All 14 pages live in this folder. This file is the entry point — read it before the page specs.

---

## 1. What this module is

LoanTrack ships with a **basic accounting** page (`/<module>/accounting`) that records `AccountEntry` rows: capital additions / withdrawals / expenses, plus auto-generated `loan_disburse` and `collection` entries. It gives a single P&L number, no chart of accounts, no double-entry, no statutory reports.

**Premium Accounting** is a **paid add-on** that layers a full double-entry accounting system on top of the same data:

- Configurable **Chart of Accounts** (5 classes: Assets / Liabilities / Equity / Income / Expense)
- **Journal Entries** with debit = credit auto-validation
- **Statutory reports**: Profit & Loss, Balance Sheet, Cash Flow, Trial Balance
- **India tax**: GSTR-1, GSTR-3B, TDS register (Sec 194A / 194Q)
- **Budgets** with monthly variance
- **Bank Reconciliation** (CSV / OFX import + matching engine)
- **Vendors & Bills** (AP) with TDS auto-deduction
- **Period Lock** (close periods so historical numbers don't drift) + immutable audit trail
- **Tally / Excel / JSON export**
- **Multi-level approval workflow** for large journal entries

It does **not** replace the existing `AccountEntry` table — it reads from it and from `Loan`, `CollectionEntry`, `Payment` to derive double-entry postings. Premium adds its own tables for journals, ledgers, budgets, etc.

---

## 2. Subscription gating

This is **NOT a new `appType`** (`microlending` / `autofinance` / `chitfunds` stay as they are). It is a **boolean feature flag** on `TenantSubscription`, identical to the pattern already used for `gpsTrackingEnabled`, `kycEnabled`, `bureauEnabled`.

### 2.1 New schema field

```prisma
model TenantSubscription {
  // ... existing fields
  premiumAccountingEnabled  Boolean   @default(false) @map("premium_accounting_enabled")
}
```

Default is `false` — even for superadmins. **Only the developer (`nandhu3d@gmail.com`) can flip this to `true`** for a tenant, after reviewing a request.

### 2.2 Migration

```sql
ALTER TABLE `tenant_subscriptions`
  ADD COLUMN `premium_accounting_enabled` BOOLEAN NOT NULL DEFAULT false;
```

### 2.3 Server-side gate helper

`lib/accounting/premium.ts`:

```ts
export async function isPremiumAccountingEnabled(tenantId: string): Promise<boolean> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { premiumAccountingEnabled: true },
  });
  return Boolean(sub?.premiumAccountingEnabled);
}
```

Every premium page calls this in its server component and renders an "upgrade" placeholder if disabled. See pattern in `app/(dashboard)/[module]/route-tracker/page.tsx`.

---

## 3. Request → approve flow (reuses existing `ModuleRequest`)

LoanTrack already has `ModuleRequest` for superadmins to request appType modules (`microlending` / `autofinance` / `chitfunds`). We reuse it for add-ons.

### 3.1 Extend `appType` to accept add-on keys

In [types/modules.ts](types/modules.ts), introduce a parallel constant:

```ts
export const ADDON_KEYS = ['premium_accounting'] as const;
export type AddOnKey = (typeof ADDON_KEYS)[number];

export const ADDON_LABELS: Record<AddOnKey, string> = {
  premium_accounting: 'Premium Accounting',
};

export function isAddOnKey(value: string | null | undefined): value is AddOnKey {
  return typeof value === 'string' && (ADDON_KEYS as readonly string[]).includes(value);
}
```

The `ModuleRequest.appType` column already accepts arbitrary strings (`String @map("app_type")`) so no DB change is needed. The request page UI is extended to show both modules and add-ons in the dropdown.

### 3.2 Superadmin → request

`app/(dashboard)/[module]/module-requests/page.tsx` already lists missing modules. Modify the dropdown source to:

```ts
const missing = [
  ...ALL_MODULES.filter(m => !enabledModules.includes(m)).map(m => ({ key: m, label: MODULE_LABELS[m] })),
  ...ADDON_KEYS.filter(k => !isAddOnEnabled(subscription, k)).map(k => ({ key: k, label: ADDON_LABELS[k] })),
];
```

Where `isAddOnEnabled(sub, 'premium_accounting')` returns `sub.premiumAccountingEnabled`.

### 3.3 Developer → approve

`app/admin/module-requests/page.tsx` already lists pending `ModuleRequest` rows for developer review. The approval action (`reviewModuleRequest`) currently appends the appType to `TenantSubscription.enabledModules`. **Extend it** so that when `appType` matches an add-on key, it flips the corresponding boolean:

```ts
if (req.appType === 'premium_accounting') {
  await prisma.tenantSubscription.update({
    where: { tenantId: req.tenantId },
    data: { premiumAccountingEnabled: true },
  });
} else {
  // existing path: add to enabledModules JSON array
}
```

### 3.4 Notification

On approve, send an in-app `SystemNotification` of type `addon_enabled` to all superadmins of that tenant. Reuse existing `lib/notify/events.ts` channel.

---

## 4. URL structure

Premium pages mount **under the same `/<module>/accounting` path** as the base accounting, with sub-paths:

| Page | Route |
|---|---|
| Premium Dashboard | `/<module>/accounting/premium` |
| Chart of Accounts | `/<module>/accounting/premium/coa` |
| Journal Entries | `/<module>/accounting/premium/journal` |
| Profit & Loss | `/<module>/accounting/premium/pnl` |
| Balance Sheet | `/<module>/accounting/premium/balance-sheet` |
| Cash Flow Statement | `/<module>/accounting/premium/cashflow` |
| Trial Balance | `/<module>/accounting/premium/trial-balance` |
| Tax & GST | `/<module>/accounting/premium/tax` |
| Budget vs Actual | `/<module>/accounting/premium/budget` |
| Bank Reconciliation | `/<module>/accounting/premium/bank-rec` |
| Vendors & Bills | `/<module>/accounting/premium/vendors` |
| Period Lock & Audit | `/<module>/accounting/premium/period-lock` |
| Export / Tally Sync | `/<module>/accounting/premium/export` |
| Settings & Approvals | `/<module>/accounting/premium/settings` |

The **existing** base accounting page (`/<module>/accounting`) is **untouched** and remains available even for tenants without the premium flag. When premium is enabled, the base page shows a banner: *"You have Premium Accounting. [Open Premium →]"*

---

## 5. New tables introduced by Premium (summary)

Full DDL is in each page spec; here is the consolidated picture.

| Table | Purpose | Page that defines it |
|---|---|---|
| `accounts` | Chart of Accounts (GL accounts) | 02_CHART_OF_ACCOUNTS.md |
| `journal_entries` | Header for a journal entry | 03_JOURNAL_ENTRIES.md |
| `journal_lines` | Debit/credit lines for an entry | 03_JOURNAL_ENTRIES.md |
| `account_balances` | Materialised running balance (perf) | 02_CHART_OF_ACCOUNTS.md |
| `budgets` | Annual budget per account | 09_BUDGET_VS_ACTUAL.md |
| `budget_lines` | Monthly amounts for a budget | 09_BUDGET_VS_ACTUAL.md |
| `bank_accounts` | Tenant's actual bank accounts (HDFC #1234 etc.) | 10_BANK_RECONCILIATION.md |
| `bank_statements` | Imported bank statement files | 10_BANK_RECONCILIATION.md |
| `bank_statement_lines` | Individual lines from a statement | 10_BANK_RECONCILIATION.md |
| `bank_match_proposals` | Algorithm-suggested matches | 10_BANK_RECONCILIATION.md |
| `vendors` | Vendor master | 11_VENDORS_AND_BILLS.md |
| `bills` | AP bills from vendors | 11_VENDORS_AND_BILLS.md |
| `bill_lines` | Line items on a bill | 11_VENDORS_AND_BILLS.md |
| `tds_deductions` | TDS deducted per bill / payment | 08_TAX_AND_GST.md |
| `gst_summaries` | Monthly GSTR-3B/GSTR-1 snapshots | 08_TAX_AND_GST.md |
| `accounting_periods` | Open/closed financial periods | 12_PERIOD_LOCK_AND_AUDIT.md |
| `period_locks` | Lock records (who/when) | 12_PERIOD_LOCK_AND_AUDIT.md |
| `accounting_audit_log` | Append-only audit | 12_PERIOD_LOCK_AND_AUDIT.md |
| `accounting_approvals` | Multi-level approval queue for journal entries | 14_SETTINGS_AND_APPROVALS.md |
| `accounting_settings` | Tenant-level premium settings | 14_SETTINGS_AND_APPROVALS.md |

---

## 6. Integration with existing data

Premium does **not duplicate** loan / collection / payment / penalty rows. Instead it reads them and **derives journal entries on the fly** via "system journal sources":

| Existing event | Auto-generated journal entry (Dr / Cr) |
|---|---|
| Loan disbursed | Dr `Loans Receivable`, Cr `Bank` |
| Collection received | Dr `Bank/Cash`, Cr `Loans Receivable` (principal portion), Cr `Interest Income` (interest portion) |
| Penalty applied | Dr `Penalties Receivable`, Cr `Penalty Income` |
| Penalty settled | Dr `Bank/Cash`, Cr `Penalties Receivable` |
| Capital added (existing `AccountEntry`) | Dr `Bank`, Cr `Owner's Capital` |
| Expense recorded (existing `AccountEntry`) | Dr `Expense:<category>`, Cr `Bank/Cash` |

The mapping table lives in `lib/accounting/postings.ts`. It is **idempotent** — re-running the derivation never creates duplicate journal lines because each line carries `(sourceType, sourceId)` for de-duplication.

A nightly cron `app/api/cron/recompute-balances/route.ts` rebuilds `account_balances` from raw journal lines.

---

## 7. Permissions matrix

| Action | Agent | Admin | Superadmin | Developer |
|---|:---:|:---:|:---:|:---:|
| View any premium page | ❌ | ✅ (read-only by default) | ✅ | ✅ |
| Post manual journal entry | ❌ | ✅ (subject to approval cap) | ✅ | ✅ |
| Approve large journal entries | ❌ | ❌ | ✅ | ✅ |
| Edit Chart of Accounts | ❌ | ❌ | ✅ | ✅ |
| Lock / unlock period | ❌ | ❌ | ✅ | ✅ |
| Configure premium settings | ❌ | ❌ | ✅ | ✅ |
| Enable / disable the premium add-on for a tenant | ❌ | ❌ | ❌ | ✅ |

`admin` is the role used by the tenant's branch managers / accountants. `superadmin` is the tenant owner. `developer` is LoanTrack staff.

---

## 8. i18n

A new top-level i18n group `pa` (premium accounting) goes into `i18n/en.ts`, `hi.ts`, `kn.ts`, `ml.ts`, `ta.ts`, `te.ts`. Each page spec lists its own keys; this is the umbrella shape:

```ts
pa: {
  dashboard: { /* ... */ },
  coa: { /* ... */ },
  journal: { /* ... */ },
  pnl: { /* ... */ },
  balanceSheet: { /* ... */ },
  cashflow: { /* ... */ },
  trialBalance: { /* ... */ },
  tax: { /* ... */ },
  budget: { /* ... */ },
  bankRec: { /* ... */ },
  vendors: { /* ... */ },
  periodLock: { /* ... */ },
  export: { /* ... */ },
  settings: { /* ... */ },
  common: {
    notEnabled: 'Premium Accounting is not enabled.',
    requestAccess: 'Request Access',
    upgrade: 'Upgrade',
  },
}
```

---

## 9. Implementation order (suggested)

1. **Phase 0** — Schema + subscription flag + request flow wiring. Nothing visible yet.
2. **Phase 1** — Chart of Accounts (02) → Journal Entries (03). Without these, every other page is empty.
3. **Phase 2** — Trial Balance (07) → P&L (04) → Balance Sheet (05). These read from Phase 1.
4. **Phase 3** — Cash Flow (06), Dashboard (01). Read from Phase 1 + 2.
5. **Phase 4** — Tax & GST (08), Budget (09), Period Lock (12). Statutory + control.
6. **Phase 5** — Bank Rec (10), Vendors (11). Operational.
7. **Phase 6** — Export (13), Settings + Approvals (14). Polish.

Each phase ships behind the subscription flag, so partial rollout is safe.

---

## 10. Out of scope (explicit)

The following are *not* part of this premium tier. They may become "Enterprise" later:

- Multi-currency journals
- Inter-tenant consolidation
- Asset register / depreciation schedules
- Payroll
- Customer billing / sales invoices (LoanTrack lends money, doesn't sell goods)
- E-invoicing IRN generation
- IFRS / Ind-AS compliance reports beyond the basic four statements

---

## 11. Page index

| # | File | Page name |
|---|---|---|
| 01 | [01_DASHBOARD.md](01_DASHBOARD.md) | Premium Dashboard |
| 02 | [02_CHART_OF_ACCOUNTS.md](02_CHART_OF_ACCOUNTS.md) | Chart of Accounts |
| 03 | [03_JOURNAL_ENTRIES.md](03_JOURNAL_ENTRIES.md) | Journal Entries |
| 04 | [04_PROFIT_AND_LOSS.md](04_PROFIT_AND_LOSS.md) | Profit & Loss |
| 05 | [05_BALANCE_SHEET.md](05_BALANCE_SHEET.md) | Balance Sheet |
| 06 | [06_CASH_FLOW.md](06_CASH_FLOW.md) | Cash Flow Statement |
| 07 | [07_TRIAL_BALANCE.md](07_TRIAL_BALANCE.md) | Trial Balance |
| 08 | [08_TAX_AND_GST.md](08_TAX_AND_GST.md) | Tax, GST & TDS |
| 09 | [09_BUDGET_VS_ACTUAL.md](09_BUDGET_VS_ACTUAL.md) | Budget vs Actual |
| 10 | [10_BANK_RECONCILIATION.md](10_BANK_RECONCILIATION.md) | Bank Reconciliation |
| 11 | [11_VENDORS_AND_BILLS.md](11_VENDORS_AND_BILLS.md) | Vendors & Bills |
| 12 | [12_PERIOD_LOCK_AND_AUDIT.md](12_PERIOD_LOCK_AND_AUDIT.md) | Period Lock & Audit |
| 13 | [13_EXPORT_AND_TALLY_SYNC.md](13_EXPORT_AND_TALLY_SYNC.md) | Export & Tally Sync |
| 14 | [14_SETTINGS_AND_APPROVALS.md](14_SETTINGS_AND_APPROVALS.md) | Settings & Approval Workflow |
