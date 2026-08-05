# 02 · Chart of Accounts (CoA)

> The backbone of double-entry. Every other premium page reads from accounts. Without this table seeded, nothing else works.

---

## 1. Purpose

Let the tenant define their **General Ledger** as a tree of accounts grouped by 5 classes:

1. **Assets** (1xxx)
2. **Liabilities** (2xxx)
3. **Equity** (3xxx)
4. **Income** (4xxx)
5. **Expenses** (5xxx)

The system **seeds a default CoA on first activation** (Indian micro-lending preset) and lets the tenant edit/extend it.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/coa` |
| **File** | `app/(dashboard)/[module]/accounting/premium/coa/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/coa/CoAClient.tsx` |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/coa/actions.ts` |
| **Role gate (read)** | `admin` / `superadmin` / `developer` |
| **Role gate (write)** | `superadmin` / `developer` (admins are read-only by default; override via settings — see 14) |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Data model

### 3.1 `accounts` table

```prisma
model Account {
  id            String    @id @default(cuid())
  tenantId      String    @map("tenant_id")
  parentId      String?   @map("parent_id")
  code          String                                   // '1100', '1200', etc. unique per tenant
  name          String                                   // 'Cash on hand'
  classType     String    @map("class_type")             // 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  subType       String?   @map("sub_type")               // 'cash' | 'bank' | 'receivable' | 'payable' | 'fixed_asset' | 'current_asset' | 'capital' | 'reserves' | 'operating_income' | 'other_income' | 'cogs' | 'operating_expense' | 'tax' | 'depreciation' | null
  normalSide    String    @map("normal_side")            // 'debit' | 'credit' — determines whether positive balance = Dr or Cr
  isCash        Boolean   @default(false) @map("is_cash") // true ⇒ aggregated into Cash + Bank tile
  isSystem      Boolean   @default(false) @map("is_system") // true ⇒ created by seeder, name cannot be deleted (rename allowed)
  isActive      Boolean   @default(true)  @map("is_active")
  description   String?   @db.Text
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent        Account?  @relation("AccountTree", fields: [parentId], references: [id])
  children      Account[] @relation("AccountTree")
  journalLines  JournalLine[]
  balances      AccountBalance[]

  @@unique([tenantId, code])
  @@index([tenantId, classType])
  @@index([parentId])
  @@map("accounts")
}
```

### 3.2 `account_balances` (materialised snapshot)

Snapshot per `(account, period)` to keep statement pages fast. Rebuilt nightly by `app/api/cron/recompute-balances/route.ts` and incrementally updated on every journal post.

```prisma
model AccountBalance {
  id           String    @id @default(cuid())
  tenantId     String    @map("tenant_id")
  accountId    String    @map("account_id")
  periodKey    String    @map("period_key")             // '2026-05' (YYYY-MM)
  openingDr    Decimal   @default(0) @map("opening_dr") @db.Decimal(18, 2)
  openingCr    Decimal   @default(0) @map("opening_cr") @db.Decimal(18, 2)
  periodDr     Decimal   @default(0) @map("period_dr")  @db.Decimal(18, 2)
  periodCr     Decimal   @default(0) @map("period_cr")  @db.Decimal(18, 2)
  closingDr    Decimal   @default(0) @map("closing_dr") @db.Decimal(18, 2)
  closingCr    Decimal   @default(0) @map("closing_cr") @db.Decimal(18, 2)
  updatedAt    DateTime  @updatedAt @map("updated_at")

  account      Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, periodKey])
  @@index([tenantId, periodKey])
  @@map("account_balances")
}
```

### 3.3 Migration

```sql
CREATE TABLE `accounts` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `parent_id` VARCHAR(191) NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `class_type` VARCHAR(32) NOT NULL,
  `sub_type` VARCHAR(64) NULL,
  `normal_side` VARCHAR(8) NOT NULL,
  `is_cash` BOOLEAN NOT NULL DEFAULT false,
  `is_system` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `description` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_tenant_id_code_key` (`tenant_id`, `code`),
  KEY `accounts_tenant_id_class_type_idx` (`tenant_id`, `class_type`),
  KEY `accounts_parent_id_idx` (`parent_id`),
  CONSTRAINT `accounts_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `accounts_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `account_balances` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `period_key` VARCHAR(7) NOT NULL,
  `opening_dr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `opening_cr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `period_dr`  DECIMAL(18,2) NOT NULL DEFAULT 0,
  `period_cr`  DECIMAL(18,2) NOT NULL DEFAULT 0,
  `closing_dr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `closing_cr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_balances_account_id_period_key_key` (`account_id`, `period_key`),
  KEY `account_balances_tenant_id_period_key_idx` (`tenant_id`, `period_key`),
  CONSTRAINT `account_balances_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 4. Default seed (Indian micro-lending preset)

Run once on first activation of `premiumAccountingEnabled` for a tenant. Seeder lives at `lib/accounting/seedDefaultCoA.ts` and is called from the developer's approval action.

| Code | Name | Class | Sub-type | isCash | Normal |
|---|---|---|---|:---:|:---:|
| 1000 | Assets | asset | — | | debit |
| 1100 | Cash on Hand | asset | cash | ✓ | debit |
| 1110 | Petty Cash | asset | cash | ✓ | debit |
| 1200 | Bank Accounts | asset | bank | ✓ | debit |
| 1210 | HDFC Current Account | asset | bank | ✓ | debit |
| 1220 | SBI Current Account | asset | bank | ✓ | debit |
| 1300 | Loans Receivable | asset | receivable | | debit |
| 1310 | Loan Principal Receivable | asset | receivable | | debit |
| 1320 | Loan Interest Receivable | asset | receivable | | debit |
| 1330 | Penalties Receivable | asset | receivable | | debit |
| 1400 | Input GST | asset | tax | | debit |
| 1410 | Input CGST | asset | tax | | debit |
| 1420 | Input SGST | asset | tax | | debit |
| 1430 | Input IGST | asset | tax | | debit |
| 1500 | Fixed Assets | asset | fixed_asset | | debit |
| 1510 | Office Equipment | asset | fixed_asset | | debit |
| 1520 | Vehicles | asset | fixed_asset | | debit |
| 1900 | Accumulated Depreciation | asset | depreciation | | credit |
| 2000 | Liabilities | liability | — | | credit |
| 2100 | Bills Payable | liability | payable | | credit |
| 2110 | Vendor Payables | liability | payable | | credit |
| 2200 | TDS Payable | liability | tax | | credit |
| 2210 | TDS u/s 194A | liability | tax | | credit |
| 2300 | Output GST | liability | tax | | credit |
| 2310 | Output CGST | liability | tax | | credit |
| 2320 | Output SGST | liability | tax | | credit |
| 2330 | Output IGST | liability | tax | | credit |
| 2400 | Bank Loans | liability | payable | | credit |
| 2500 | Accrued Expenses | liability | payable | | credit |
| 3000 | Equity | equity | — | | credit |
| 3100 | Owner's Capital | equity | capital | | credit |
| 3200 | Retained Earnings | equity | reserves | | credit |
| 3300 | Current Year Earnings | equity | reserves | | credit |
| 4000 | Income | income | — | | credit |
| 4100 | Interest Income | income | operating_income | | credit |
| 4200 | Penalty Income | income | operating_income | | credit |
| 4300 | Processing Fees | income | operating_income | | credit |
| 4900 | Other Income | income | other_income | | credit |
| 5000 | Expenses | expense | — | | debit |
| 5100 | Salaries & Wages | expense | operating_expense | | debit |
| 5200 | Rent | expense | operating_expense | | debit |
| 5300 | Utilities | expense | operating_expense | | debit |
| 5400 | Travel & Conveyance | expense | operating_expense | | debit |
| 5500 | Marketing | expense | operating_expense | | debit |
| 5600 | Bank Charges | expense | operating_expense | | debit |
| 5700 | Bad Debts | expense | operating_expense | | debit |
| 5800 | Depreciation Expense | expense | depreciation | | debit |
| 5900 | Other Expenses | expense | operating_expense | | debit |

All seeded accounts have `isSystem=true`. Mapping table `lib/accounting/postings.ts` references these codes by name (not id) so the seed can be regenerated without breaking auto-journals.

---

## 5. UI layout

```
┌───────────────────────────────────────────────────────────────────────┐
│  Premium > Chart of Accounts        [+ Add Account]  [Reseed defaults]│
├───────────────────────────────────────────────────────────────────────┤
│ Filter: [ class ▾ ] [ search... ]      [Show inactive ☐]              │
│                                                                       │
│ Code  Name                          Class      Sub-type     Bal (Dr)  │
│ ───── ──────────────────────────── ─────────── ──────────── ──────────│
│ 1000  ▾ Assets                     asset       —             ─        │
│   1100 ▾ Cash on Hand              asset       cash          12,340   │
│     1110  Petty Cash               asset       cash           1,200   │
│   1200 ▾ Bank Accounts             asset       bank         50,000    │
│     1210  HDFC Current             asset       bank         30,000    │
│     1220  SBI Current              asset       bank         20,000    │
│   1300 ▾ Loans Receivable          asset       receivable   ...       │
│ ...                                                                   │
└───────────────────────────────────────────────────────────────────────┘
```

- Tree view with collapse/expand.
- Each row has hover actions: ✎ Edit · ⊕ Add Child · ↻ Activate / Deactivate · 🗑 Delete (only if no journal lines).
- "Reseed defaults" button only re-creates **missing** system accounts; never overwrites edited ones.
- "+ Add Account" opens a modal:
  - Code (required, unique per tenant, suggested next-in-class)
  - Name (required)
  - Class (required, dropdown)
  - Sub-type (optional, dropdown filtered by class)
  - Parent (optional, tree selector)
  - `isCash` checkbox (visible only when subType in `cash|bank`)
  - Description (optional)

### Account detail drawer

Clicking a row opens a side drawer (40 % width):

- Header: code · name · class chip
- Balance card: opening / period activity / closing for the current month
- Last 20 journal lines table (Date · JE# · Description · Dr · Cr · Running)
- "View all in Journal Entries" link → `/journal?accountId=...`
- Footer actions: Edit · Deactivate · Delete

---

## 6. Server actions

`app/(dashboard)/[module]/accounting/premium/coa/actions.ts`:

```ts
'use server';

// Create
export async function createAccount(input: CreateAccountInput): Promise<ActionResult<Account>>;

// Update
export async function updateAccount(id: string, input: UpdateAccountInput): Promise<ActionResult<Account>>;

// Delete (soft)
export async function deactivateAccount(id: string): Promise<ActionResult>;

// Reseed missing defaults
export async function reseedDefaultCoA(): Promise<ActionResult<{ created: number; skipped: number }>>;

// Used by detail drawer
export async function getAccountWithRecentLines(id: string, limit = 20): Promise<AccountDetail>;
```

### Validation rules

| Field | Rule |
|---|---|
| `code` | Required, `^\d{4}$` (4 digits), unique per tenant |
| `name` | Required, length 1–255 |
| `classType` | Required, one of the 5 enum values |
| `subType` | Optional. If set, must belong to the class (`assetSubTypes`, `liabilitySubTypes`, etc. — see `lib/accounting/enums.ts`) |
| `parentId` | Optional. Must exist in same tenant; cannot create a cycle |
| `isCash` | Only allowed when `subType IN ('cash','bank')` |
| `normalSide` | Auto-derived from `classType` (asset/expense ⇒ debit, others ⇒ credit). Editable only by developer. |

### Delete rules

Hard delete: blocked if **any** journal line references the account or any active child exists. Returns `{ error: 'account_in_use' }`.

Soft delete (`isActive=false`): always allowed if no active children. Hides account from journal-entry dropdowns; existing reports continue to render it.

---

## 7. Postings mapping table

System auto-journals (loan disbursed, collection, penalty, etc.) refer to accounts by **logical name**, not id. The mapping table `lib/accounting/postings.ts`:

```ts
export const POSTING_MAP = {
  LOAN_DISBURSEMENT: {
    debit:  { code: '1310', label: 'Loan Principal Receivable' },
    credit: { code: '1210', label: 'Bank' },               // override per branch / per source bank account
  },
  COLLECTION_PRINCIPAL: {
    debit:  { code: '1100', label: 'Cash on Hand' },        // or 1210 Bank depending on paymentMode
    credit: { code: '1310', label: 'Loan Principal Receivable' },
  },
  COLLECTION_INTEREST: {
    debit:  { code: '1100', label: 'Cash on Hand' },
    credit: { code: '4100', label: 'Interest Income' },
  },
  PENALTY_ACCRUAL: {
    debit:  { code: '1330', label: 'Penalties Receivable' },
    credit: { code: '4200', label: 'Penalty Income' },
  },
  PENALTY_SETTLEMENT: {
    debit:  { code: '1100', label: 'Cash on Hand' },
    credit: { code: '1330', label: 'Penalties Receivable' },
  },
  // ...
};
```

Tenant can **override** any mapping in `accountingSettings.postingOverrides` (a JSON column) without changing the seed. See `14_SETTINGS_AND_APPROVALS.md`.

---

## 8. i18n keys (`pa.coa`)

```ts
pa: {
  coa: {
    title: 'Chart of Accounts',
    addAccount: '+ Add Account',
    reseed: 'Reseed defaults',
    filterClass: 'Class',
    filterSearch: 'Search code or name…',
    showInactive: 'Show inactive',
    classAsset: 'Asset',
    classLiability: 'Liability',
    classEquity: 'Equity',
    classIncome: 'Income',
    classExpense: 'Expense',
    codeColumn: 'Code',
    nameColumn: 'Name',
    classColumn: 'Class',
    subTypeColumn: 'Sub-type',
    balanceColumn: 'Balance (Dr)',
    edit: 'Edit',
    addChild: 'Add Child',
    activate: 'Activate',
    deactivate: 'Deactivate',
    delete: 'Delete',
    modal: {
      addTitle: 'Add Account',
      editTitle: 'Edit Account',
      codeLabel: 'Account Code',
      codeHelp: '4-digit code, unique within your books.',
      nameLabel: 'Account Name',
      classLabel: 'Class',
      subTypeLabel: 'Sub-type',
      parentLabel: 'Parent Account',
      isCashLabel: 'Treat as cash/bank for cash-flow reports',
      descriptionLabel: 'Description',
      save: 'Save',
      cancel: 'Cancel',
    },
    errors: {
      duplicateCode: 'Account code already exists.',
      inUse: 'Cannot delete — this account has journal entries.',
      cycle: 'Parent assignment creates a cycle.',
      systemAccount: 'System accounts cannot be deleted (only renamed).',
    },
    drawer: {
      openingBalance: 'Opening balance',
      periodActivity: 'This period',
      closingBalance: 'Closing balance',
      recentLines: 'Recent journal lines',
      viewAll: 'View all in Journal Entries →',
    },
  },
}
```

---

## 9. Edge cases

| Case | Behaviour |
|---|---|
| User edits a system account's name | Allowed; mapping table still works (uses code, not name) |
| User edits a system account's code | **Blocked.** System account codes are immutable; mapping table depends on them |
| Reseed defaults clicked but tenant has 0 accounts | Same as initial seed |
| Reseed clicked when all defaults exist | "No new accounts created" toast |
| Concurrent edits to same account | Optimistic concurrency via `updatedAt` check; second writer gets 409 |
| Deactivating a parent with active children | Blocked; show "Deactivate children first" |
| Creating account with code outside the class's range (e.g. asset code `5xxx`) | Warning toast but allowed (some tenants use non-standard ranges) |

---

## 10. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| COA-01 | Fresh tenant turns on premium | 48 default accounts seeded, all `isSystem=true` |
| COA-02 | Reseed defaults clicked when 2 system accounts were deleted | Those 2 reappear, no duplicates of the others |
| COA-03 | Create account with code `1100` (already exists) | Returns `duplicateCode` error |
| COA-04 | Edit system account `1100` name to "Petty Cash" | Saved; auto-journals still post correctly |
| COA-05 | Try to delete `1100` after it has journal lines | Blocked, `inUse` error |
| COA-06 | Set parent of A to B, where B's ancestor is A | `cycle` error |
| COA-07 | Set `isCash=true` on account with subType `receivable` | Validation error: only cash/bank allowed |
| COA-08 | Branch-scoped admin opens CoA | Sees full tenant CoA (CoA is tenant-wide, not branch-scoped) |
| COA-09 | After posting a journal line, account balance updates in account-balances table | Verify by re-opening drawer immediately |

---

## 11. Acceptance criteria

1. Activating premium for a tenant seeds the default Indian micro-lending CoA exactly once.
2. CoA edits are blocked for `admin` role unless the override `accountingSettings.adminCanEditCoA = true`.
3. Account codes are unique per tenant and 4-digit.
4. System accounts cannot have their `code` changed; rename is allowed.
5. Deactivation is non-destructive; reactivation restores visibility.
6. Hard delete is blocked when journal lines exist.
7. Posting map references accounts by code; deleting/renaming a *non-system* account that the map references shows a warning.
8. Tree view supports ≥ 4 levels of nesting without UI breakage.
