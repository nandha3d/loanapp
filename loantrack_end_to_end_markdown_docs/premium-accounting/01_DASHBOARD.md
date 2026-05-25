# 01 · Premium Accounting Dashboard

> Landing page for the premium add-on. Replaces the basic accounting summary card with a richer P&L overview, cash-flow chart, top expenses, and quick actions.

---

## 1. Purpose

Give the superadmin / accountant a one-glance view of:

- Cash & bank position **today**
- P&L **this month** vs **last month** vs **YTD**
- Cash inflow / outflow trend (last 90 days)
- Top expense categories (last 30 days)
- Open journal entries pending approval
- Unreconciled bank lines
- Bills due in the next 7 days
- Period status (open / locked)

…and surface quick-action buttons for the most common premium tasks.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium` |
| **File** | `app/(dashboard)/[module]/accounting/premium/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/DashboardClient.tsx` |
| **Role gate** | `admin` / `superadmin` / `developer`; `agent` → redirect to `/<module>/collection` |
| **Subscription gate** | `TenantSubscription.premiumAccountingEnabled === true`. If false → render `<PremiumDisabledPlaceholder />` (shared component, see §8) |

---

## 3. UI layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Premium Accounting  >  Dashboard          [Period: This Month ▾]  │
│  Period status: Open · Last locked: 2026-04-30                     │
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│ │ Cash + Bank│ │ Net Profit │ │ AR (Loans  │ │ AP (Bills  │         │
│ │ ₹ 12,34,567│ │ ₹  87,654  │ │ Receivable)│ │ Payable)   │         │
│ │ +2.4% MoM  │ │ +12% MoM   │ │ ₹ 45,67,890│ │ ₹  4,32,100│         │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│                                                                    │
│ ┌──────────────────────────────────┐  ┌──────────────────────────┐ │
│ │ Cash flow — last 90 days         │  │ Top expenses — 30 days   │ │
│ │ [Area chart inflow vs outflow]   │  │ 1. Salary    ₹ 1,80,000  │ │
│ │                                  │  │ 2. Rent      ₹   60,000  │ │
│ │                                  │  │ 3. Travel    ₹   24,500  │ │
│ │                                  │  │ 4. Office    ₹    8,200  │ │
│ └──────────────────────────────────┘  └──────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────┐  ┌──────────────────────────┐ │
│ │ Pending approvals (3)            │  │ Bills due ≤ 7 days (2)   │ │
│ │ - JE-2026-0421  ₹50,000  Admin   │  │ - HDFC EMI   ₹40,000  3d │ │
│ │ - JE-2026-0420  ₹12,000  Admin   │  │ - Tax payable ₹8,200  6d │ │
│ │   [Review →]                     │  │   [Pay →]                │ │
│ └──────────────────────────────────┘  └──────────────────────────┘ │
│                                                                    │
│  Quick actions:  [+ Journal Entry] [+ Bill] [Reconcile bank]       │
│                  [GST report]    [Export Tally XML]                │
└────────────────────────────────────────────────────────────────────┘
```

### Period selector

Top-right dropdown: `This Month` (default) · `Last Month` · `This Quarter` · `This Year` · `Custom range…`. Custom opens a two-input date picker. Selected period drives the four KPI tiles + the cash-flow chart's x-axis window.

### KPI tiles (4)

Each tile is a `<StatCard>` component already used in the existing dashboard (`components/StatCard.tsx` if present, otherwise create one).

| Tile | Numerator | Comparison label |
|---|---|---|
| **Cash + Bank** | Sum of all account balances where `account.subType IN ('cash','bank')`, **as of end of period** | MoM % change vs same balance at end of prior month |
| **Net Profit** | `Income - Expenses` for the period (P&L bottom line) | MoM % change vs prior month |
| **AR (Loans Receivable)** | Sum of `account.balance` where `account.code = '1200'` (or whatever Loans Receivable code is configured) | YTD change |
| **AP (Bills Payable)** | Sum of unpaid bill amounts (state `unpaid` or `partial`) | YTD change |

Trend arrow: green up for AR/Cash/Profit increase, red down. Inverted for AP: red up.

### Cash flow chart (Recharts `<AreaChart>`)

- X-axis: 90 daily buckets ending today
- Two stacked areas: **Inflow** (Dr cash/bank), **Outflow** (Cr cash/bank)
- Hover tooltip: bucket date + both totals + net
- Click on a day → drill to Journal Entries filtered to that date

### Top expenses card

Top 5 expense accounts by net debit total for the selected period. Each row links to Journal Entries filtered by `accountId`.

### Pending approvals card

Shows up to 5 rows from `accounting_approvals` where `status='pending'` and current user has approval authority. **CTA → `/<module>/accounting/premium/journal?status=pending_approval`**.

### Bills due card

Shows up to 5 rows from `bills` where `dueDate <= today + 7d` and `status IN ('unpaid','partial')`. **CTA → `/<module>/accounting/premium/vendors?tab=bills`**.

### Quick actions row

Buttons (server actions or links):

- `+ Journal Entry` → `/<module>/accounting/premium/journal/new`
- `+ Bill` → `/<module>/accounting/premium/vendors?openBill=true`
- `Reconcile bank` → `/<module>/accounting/premium/bank-rec`
- `GST report` → `/<module>/accounting/premium/tax?tab=gstr3b`
- `Export Tally XML` → opens server-action download for current month

---

## 4. Data fetch (server component)

```ts
// app/(dashboard)/[module]/accounting/premium/page.tsx

const tenantId = await getDefaultTenantId();
const branchId = await getActiveBranchId();
if (!await isPremiumAccountingEnabled(tenantId)) return <PremiumDisabledPlaceholder addOnKey="premium_accounting" />;

const period = resolvePeriod(searchParams.period); // {from, to}
const prev   = previousPeriod(period);

const [
  cashBankNow, cashBankPrev,
  pnl,         pnlPrev,
  ar,
  ap,
  cashflowSeries,
  topExpenses,
  pendingApprovals,
  billsDueSoon,
  periodStatus,
] = await Promise.all([
  getCashBankBalance(tenantId, branchId, period.to),
  getCashBankBalance(tenantId, branchId, prev.to),
  getNetProfit(tenantId, branchId, period),
  getNetProfit(tenantId, branchId, prev),
  getAccountBalance(tenantId, branchId, '1200', period.to),  // Loans Receivable
  getOpenBillsTotal(tenantId, branchId, period.to),
  getDailyCashflowSeries(tenantId, branchId, daysAgo(89), today()),
  getTopExpenses(tenantId, branchId, period, 5),
  getPendingApprovalsForUser(userId, tenantId, branchId, 5),
  getBillsDueWithin(tenantId, branchId, 7),
  getPeriodStatus(tenantId, period.from),
]);
```

All helper functions live in `lib/accounting/queries.ts`. They are pure read functions; they hit the materialised `account_balances` table where possible to keep the dashboard under 300 ms even with 100k+ journal lines.

### Branch scoping

When `branchId` is set on the active session, all queries filter by `branchId` on the source side (loans, bills, journal_lines). When the user is a developer with no active branch, the dashboard aggregates across the whole tenant.

---

## 5. Edge cases

| Case | Behaviour |
|---|---|
| Premium flag is `false` | Render placeholder with "Request access" CTA. No queries run. |
| Premium flag is `true` but no accounts seeded yet | Cards show ₹0, chart shows empty state. Prompt: "Set up your Chart of Accounts to see numbers" → link to `02 · CoA`. |
| Period entirely inside a locked period | KPI tiles render normally (historic numbers are still readable); only the "+ Journal Entry" quick action is replaced with "Period locked". |
| Tenant uses a non-standard fiscal year (set in `accountingSettings.fiscalYearStart`) | Period selector "This Year" follows the fiscal year, not the calendar year. |
| User is `admin` (not `superadmin`) | All cards visible but quick actions that need higher rights (`Lock period`, `GST file`) are hidden. |
| Numbers > 1 crore (10^7) | Display in **lakhs/crores** with Indian numbering (already done by `formatCurrency` in lib/utils). |

---

## 6. Server actions

This page is read-only. No mutations. Quick-action buttons are plain `<Link>`s to other premium pages.

---

## 7. i18n keys (`pa.dashboard`)

```ts
pa: {
  dashboard: {
    title: 'Premium Accounting',
    breadcrumb: 'Dashboard',
    periodLabel: 'Period',
    periodThisMonth: 'This Month',
    periodLastMonth: 'Last Month',
    periodThisQuarter: 'This Quarter',
    periodThisYear: 'This Year',
    periodCustom: 'Custom range…',
    cashBankTile: 'Cash + Bank',
    netProfitTile: 'Net Profit',
    arTile: 'Loans Receivable',
    apTile: 'Bills Payable',
    cashflowTitle: 'Cash flow — last 90 days',
    topExpensesTitle: 'Top expenses',
    pendingApprovalsTitle: 'Pending approvals',
    billsDueTitle: 'Bills due',
    quickActions: 'Quick actions',
    addJournalEntry: '+ Journal Entry',
    addBill: '+ Bill',
    reconcileBank: 'Reconcile bank',
    gstReport: 'GST report',
    exportTally: 'Export Tally XML',
    inflow: 'Inflow',
    outflow: 'Outflow',
    review: 'Review →',
    payBill: 'Pay →',
    emptyState: 'Set up your Chart of Accounts to see numbers.',
    periodLockedNote: 'Period locked — open a new period to record entries.',
    momChange: '{value}% MoM',
    ytdChange: 'YTD {value}%',
  },
}
```

---

## 8. Shared placeholder component

`components/accounting/PremiumDisabledPlaceholder.tsx`:

```tsx
export default function PremiumDisabledPlaceholder({ addOnKey }: { addOnKey: 'premium_accounting' }) {
  return (
    <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
      <span className="material-icons-outlined" style={{ fontSize: 48, color: 'var(--primary)' }}>workspace_premium</span>
      <h2 style={{ marginTop: 16 }}>Premium Accounting</h2>
      <p style={{ maxWidth: 460, margin: '12px auto', color: 'var(--text-secondary)' }}>
        Unlock the full double-entry accounting suite — chart of accounts, journals, P&L, balance sheet, GST, bank reconciliation, budgets and Tally export.
      </p>
      <a href="/<module>/module-requests" className="btn btn-primary">Request Access</a>
    </div>
  );
}
```

The CTA navigates to the existing module-requests page; the dropdown there now includes `Premium Accounting` (see overview §3).

---

## 9. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| DASH-01 | Tenant without premium flag opens `/premium` | Placeholder card visible, no queries fired (verify in network tab) |
| DASH-02 | Tenant with premium flag, **zero journal entries** | All KPIs show ₹0, chart empty state, no errors |
| DASH-03 | Period = `This Month`, 100 journal lines | Page paint < 500 ms |
| DASH-04 | Period = `This Year`, ≥ 50k journal lines | Page paint < 1 s, served from `account_balances` snapshot |
| DASH-05 | Branch context set, journal lines for other branches exist | Tiles show **only** active-branch numbers |
| DASH-06 | Period locked, user clicks `+ Journal Entry` | Button is rendered as "Period locked" disabled state |
| DASH-07 | Admin (not superadmin) | `Lock period` is not visible; everything else is |
| DASH-08 | Quick action `Export Tally XML` clicked | Downloads `tally-<from>-<to>.xml` for current month |
| DASH-09 | Click on a day in cash-flow chart | Redirects to `/premium/journal?from=<day>&to=<day>` |
| DASH-10 | Currency formatting on ₹1.2 crore | Renders as `₹1,20,00,000` (Indian grouping) |

---

## 10. Acceptance criteria

1. Page is gated by `premiumAccountingEnabled`; flag off ⇒ placeholder; flag on ⇒ live data.
2. All 4 KPI tiles match the corresponding figure on the dedicated statement pages (P&L, Balance Sheet) for the same period.
3. Cash-flow chart inflow + outflow numbers reconcile to the Trial Balance for cash/bank accounts.
4. Pending approvals card never shows entries the current user is not authorised to approve.
5. Branch filter is respected everywhere.
6. No mutation happens from this page.
7. Page is responsive down to 360px width (KPI tiles wrap to 2x2, charts stack vertically).
8. Lighthouse perf ≥ 85 on mid-tier hardware.
