# 09 · Budget vs Actual

> Annual budgets per account, monthly amounts, variance against P&L actuals.

---

## 1. Purpose

- Define a budget for the upcoming fiscal year (or any 12-month window).
- Spread annual amounts across months (manual, even split, custom seasonality curve).
- Compare actuals (from journal lines) vs budget month-by-month; surface variance %.
- Lock the budget once approved by superadmin so users can't tamper.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/budget` |
| **File** | `app/(dashboard)/[module]/accounting/premium/budget/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/budget/BudgetClient.tsx` |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/budget/actions.ts` |
| **Role gate (read)** | `admin` / `superadmin` / `developer` |
| **Role gate (write)** | `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Data model

```prisma
model Budget {
  id           String       @id @default(cuid())
  tenantId     String       @map("tenant_id")
  branchId     String?      @map("branch_id")
  name         String                                  // 'FY 2026-27 Operating Budget'
  fiscalYear   String       @map("fiscal_year")        // '2026-27'
  status       String       @default("draft")          // 'draft' | 'approved' | 'archived'
  approvedById String?      @map("approved_by_id")
  approvedAt   DateTime?    @map("approved_at")
  notes        String?      @db.Text
  createdById  String       @map("created_by_id")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")
  lines        BudgetLine[]

  tenant       Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch       Branch?      @relation(fields: [branchId], references: [id])
  approvedBy   User?        @relation("BudgetApprover", fields: [approvedById], references: [id])
  createdBy    User         @relation("BudgetCreator", fields: [createdById], references: [id])

  @@unique([tenantId, fiscalYear, branchId])
  @@map("budgets")
}

model BudgetLine {
  id          String   @id @default(cuid())
  budgetId    String   @map("budget_id")
  accountId   String   @map("account_id")
  m01         Decimal  @default(0) @db.Decimal(18, 2)   // first month of FY
  m02         Decimal  @default(0) @db.Decimal(18, 2)
  m03         Decimal  @default(0) @db.Decimal(18, 2)
  m04         Decimal  @default(0) @db.Decimal(18, 2)
  m05         Decimal  @default(0) @db.Decimal(18, 2)
  m06         Decimal  @default(0) @db.Decimal(18, 2)
  m07         Decimal  @default(0) @db.Decimal(18, 2)
  m08         Decimal  @default(0) @db.Decimal(18, 2)
  m09         Decimal  @default(0) @db.Decimal(18, 2)
  m10         Decimal  @default(0) @db.Decimal(18, 2)
  m11         Decimal  @default(0) @db.Decimal(18, 2)
  m12         Decimal  @default(0) @db.Decimal(18, 2)
  annual      Decimal  @default(0) @db.Decimal(18, 2)   // denormalised sum
  budget      Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  account     Account  @relation(fields: [accountId], references: [id])
  @@unique([budgetId, accountId])
  @@map("budget_lines")
}
```

---

## 4. UI — Budget editor

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Budget                                                         │
│ Budget: [FY 2026-27 Operating ▾]  Status: Draft  [+ New budget]          │
│ Branch: [Main Branch ▾]                                                  │
│ [Approve] [Archive] [Duplicate to next year] [⇩ Excel]                   │
├──────────────────────────────────────────────────────────────────────────┤
│ Spread: [Even ▾]   Currency: ₹                                           │
│                                                                          │
│  Account                Apr   May   Jun   Jul   Aug   Sep …  Annual      │
│  ─────────────────────  ──── ──── ──── ──── ──── ────     ──────────     │
│  4100 Interest Income  150K  150K  150K  150K  150K  150K   1,800,000    │
│  4200 Penalty Income     8K    8K    8K   10K   10K   10K     120,000    │
│  5100 Salaries          60K   60K   60K   60K   65K   65K     750,000    │
│  5200 Rent              25K   25K   25K   25K   25K   25K     300,000    │
│  ...                                                                     │
│                                                                          │
│  + Add account                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Spread helpers

Toolbar dropdown `Spread`:
- **Even** — divide annual by 12 across the months.
- **Linear growth** — start at `m01`, +X% per month.
- **Seasonal** — define a 12-element percentage array that sums to 100%.
- **Manual** — leave alone, user types each cell.

Applied per row via the row's context-menu, or to all rows from the toolbar.

### Inline editing

- Click any cell, type number, Tab to next. Validation: ≥ 0.
- Annual column auto-recomputes.
- Bold/italic styling on cells edited since last save (auto-save every 5 s on blur).

### Approve

`status='approved'`, locks editing. Only `superadmin`/`developer` can approve. Approval is irreversible (would need explicit unlock with audit reason).

---

## 5. UI — Variance view

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Budget > Variance                                              │
│ Budget: FY 2026-27 (Approved)   Period: [May 2026 ▾]  [⇩ PDF]            │
├──────────────────────────────────────────────────────────────────────────┤
│                            Budget     Actual    Var ₹   Var %  YTD Var % │
│  4100 Interest Income     150,000    142,000   (8,000)  -5.3%    -2.1%   │
│  4200 Penalty Income        8,000      9,500    1,500  +18.8%    +6.4%   │
│  5100 Salaries             60,000     60,000        0    0.0%     0.0%   │
│  5200 Rent                 25,000     25,000        0    0.0%     0.0%   │
│  5400 Travel                5,000      4,800     (200)  -4.0%    +3.2%   │
│  ...                                                                     │
│                                                                          │
│  Total Income             170,500    158,500  (12,000)  -7.0%            │
│  Total Expenses           105,000    105,500      500   +0.5%            │
│  Net Profit                65,500     53,000  (12,500) -19.1%            │
└──────────────────────────────────────────────────────────────────────────┘
```

- Variance column red if expense over budget or income under budget; green otherwise.
- YTD Var % calculated as `(YTD actual − YTD budget) / YTD budget`.
- Click any variance cell → drill to journal entries for that account+month.

### Alert thresholds

Settings (see 14) define `varianceAlertPct` (default 15%). Rows exceeding the threshold are highlighted with a triangle icon `△`. A daily cron `app/api/cron/budget-alerts/route.ts` sends a `SystemNotification` to superadmins when any account variance exceeds the threshold during the active month.

---

## 6. Server actions

```ts
// Budget CRUD
export async function createBudget(input: NewBudget): Promise<ActionResult<Budget>>;
export async function updateBudgetLine(lineId: string, monthKey: string, amount: number): Promise<ActionResult>;
export async function spreadBudget(budgetId: string, accountId: string, strategy: SpreadStrategy, payload: any): Promise<ActionResult>;
export async function approveBudget(budgetId: string): Promise<ActionResult>;
export async function archiveBudget(budgetId: string): Promise<ActionResult>;
export async function duplicateBudget(budgetId: string, newFy: string): Promise<ActionResult<Budget>>;

// Variance
export async function getVarianceForPeriod(budgetId: string, periodKey: string): Promise<VarianceRow[]>;

// Excel export
export async function exportBudgetExcel(budgetId: string): Promise<File>;
```

---

## 7. i18n (`pa.budget`)

```ts
pa: {
  budget: {
    title: 'Budget',
    new: '+ New budget',
    approve: 'Approve',
    archive: 'Archive',
    duplicate: 'Duplicate to next year',
    spreadLabel: 'Spread',
    spreadEven: 'Even',
    spreadLinear: 'Linear growth',
    spreadSeasonal: 'Seasonal',
    spreadManual: 'Manual',
    columns: {
      account: 'Account',
      annual: 'Annual',
    },
    addAccount: '+ Add account',
    statusDraft: 'Draft',
    statusApproved: 'Approved',
    statusArchived: 'Archived',
    variance: {
      title: 'Budget vs Actual',
      period: 'Period',
      budget: 'Budget',
      actual: 'Actual',
      varAmt: 'Var ₹',
      varPct: 'Var %',
      ytdVarPct: 'YTD Var %',
      totalIncome: 'Total Income',
      totalExpenses: 'Total Expenses',
      netProfit: 'Net Profit',
      alertSuffix: '⚠ exceeds threshold',
      drillTitle: 'JEs — {account}, {period}',
    },
  },
}
```

---

## 8. Edge cases

| Case | Behaviour |
|---|---|
| No approved budget for current FY | Variance page shows empty state with "Create budget" CTA |
| Multiple drafts simultaneously | Only one budget per (tenant, FY, branchId); creating a new one with same combo prompts to archive existing |
| Editing approved budget | Blocked; toast "Approved budgets are locked. Duplicate to revise." |
| Branch budget vs tenant budget | If both exist, branch-level variance shown when branch is selected; tenant aggregate when "All branches" |
| FY != calendar year | Months mapped via `accountingSettings.fiscalYearStart` (default April for India) |
| Duplicate to next year | Copies all lines, `m01..m12` carry over, `status='draft'` |
| Budget includes non-existent account (after CoA delete) | Line shown grey with "(deleted)"; ignored in variance |
| Auto-generated cron alert | One notification per account per month, deduped on `(tenantId, budgetId, accountId, periodKey)` |

---

## 9. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| BUD-01 | Create FY 2026-27, add 5 accounts, even spread | Each row's monthly = annual/12 |
| BUD-02 | Approve budget | `status='approved'`, edit blocked |
| BUD-03 | Variance for May with 150K budget, 142K actual on 4100 | Red row, var % -5.3% |
| BUD-04 | Duplicate budget to FY 2027-28 | New draft with same lines |
| BUD-05 | Branch budget different from tenant | Branch variance uses branch lines only |
| BUD-06 | Variance exceeds 15% threshold | Triangle icon + cron notif sent |
| BUD-07 | Manual spread linear 10% growth | Verify m01 → m12 progression |
| BUD-08 | Excel export | Each row has all 12 months + annual + totals |
| BUD-09 | Drill on variance cell | Lands on journal list filtered to account + month |
| BUD-10 | Edit while another user edits same line | Last write wins (no per-cell lock); audit log records both |

---

## 10. Acceptance criteria

1. Only one approved budget per (tenant, FY, branchId) at a time.
2. Approval locks editing and is logged with user + timestamp.
3. Variance Σ across all accounts equals (Actual − Budget) on income/expense for the period.
4. Alert thresholds drive notifications, no duplicates.
5. Excel export round-trips: re-import (future feature) reproduces same Budget.
6. CoA changes don't break existing budgets (soft references).
