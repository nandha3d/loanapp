# 07 · Trial Balance

> Every account, total debit, total credit, and closing balance for a period. The auditor's first look at the books.

---

## 1. Purpose

- List every account with non-zero activity in the period plus all accounts with non-zero closing balance.
- Two-column form: total Debit, total Credit. Footer must show Σ Dr = Σ Cr.
- Three-column form (alternative): opening balance, period activity, closing balance.
- Acts as the diagnostic for double-entry integrity.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/trial-balance` |
| **File** | `app/(dashboard)/[module]/accounting/premium/trial-balance/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/trial-balance/TrialBalanceClient.tsx` |
| **Role gate** | `admin` / `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

Read-only.

---

## 3. UI layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Trial Balance                                                  │
│ As of: [31 May 2026 ▾]   Form: [● 2-col] [○ 3-col]   Branch: [All ▾]     │
│ [⇩ PDF]  [⇩ Excel]  [Print]                                              │
├──────────────────────────────────────────────────────────────────────────┤
│ 2-col view                                                               │
│                                                                          │
│  Code  Account                                Debit         Credit       │
│  ───── ──────────────────────────────────── ──────────  ──────────       │
│  1100  Cash on Hand                            12,340                    │
│  1110  Petty Cash                               1,200                    │
│  1210  HDFC Current Account                    30,000                    │
│  1220  SBI Current Account                     20,000                    │
│  1310  Loan Principal Receivable             4,200,000                   │
│  1320  Loan Interest Receivable                350,000                   │
│  1330  Penalties Receivable                     17,890                   │
│  1410  Input CGST                                4,050                   │
│  ...                                                                     │
│  2110  Vendor Payables                                       32,100      │
│  2210  TDS u/s 194A                                           2,000      │
│  2310  Output CGST                                            6,150      │
│  ...                                                                     │
│  3100  Owner's Capital                                    4,000,000      │
│  3200  Retained Earnings                                    130,130      │
│  3300  Current Year Earnings                                121,800      │
│  4100  Interest Income                                      560,000      │
│  ...                                                                     │
│  5100  Salaries & Wages                       300,000                    │
│  ...                                                                     │
│  ─────────────────────────────────────────  ──────────  ──────────       │
│                                            8,142,830     8,142,830       │
│                                                                          │
│  ✔ Balanced  (Σ Dr − Σ Cr = 0)                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3-col view

```
Code   Account                  Opening (Dr/Cr)   Activity (Dr/Cr)   Closing (Dr/Cr)
1100   Cash on Hand             15,200 Dr          (2,860) net Dr     12,340 Dr
4100   Interest Income          440,000 Cr         120,000 Cr         560,000 Cr
...
```

(Same row but with three balance columns rather than two simple Dr/Cr columns.)

### Filters

- **As of** — date picker (defaults to today).
- **Form** — 2-col vs 3-col.
- **Branch** — current branch / all.
- **Class** — checkboxes Asset/Liability/Equity/Income/Expense (multi-select). Default: all.
- **Include zero balances** — checkbox, default off (only show accounts with non-zero).

### Drill-down

Click any debit/credit cell → side panel listing all journal entries that contributed in the period, like in P&L.

---

## 4. Data fetch

```ts
const asOf = parseDate(params.asOf);
const periodKey = monthKey(asOf);

const balances = await prisma.accountBalance.findMany({
  where: { tenantId, periodKey },
  include: { account: true },
});

// If as-of is mid-period, add intra-period activity from journal_lines:
const intra = await aggregateJournalLines(tenantId, branchId, startOfMonth(asOf), asOf);

const rows = mergeBalancesAndIntra(balances, intra).filter(r => includeZeros || r.closing !== 0);
const dr = rows.reduce((s, r) => s + r.closingDr, 0);
const cr = rows.reduce((s, r) => s + r.closingCr, 0);
```

`aggregateJournalLines` SQL groups by `accountId` and SUMs debit/credit between dates with `branchId` filter.

---

## 5. Export

PDF/Excel similar to P&L. Print stylesheet hides chrome.

---

## 6. i18n (`pa.trialBalance`)

```ts
pa: {
  trialBalance: {
    title: 'Trial Balance',
    asOf: 'As of',
    formLabel: 'Form',
    twoCol: '2-col',
    threeCol: '3-col',
    branch: 'Branch',
    branchAll: 'All branches',
    classFilter: 'Class',
    includeZero: 'Include zero balances',
    code: 'Code',
    account: 'Account',
    debit: 'Debit',
    credit: 'Credit',
    opening: 'Opening',
    activity: 'Activity',
    closing: 'Closing',
    balanced: '✔ Balanced (Σ Dr − Σ Cr = 0)',
    unbalanced: '⚠ Out of balance by {diff}',
    drillDownTitle: 'Journal lines — {account} as of {date}',
  },
}
```

---

## 7. Edge cases

| Case | Behaviour |
|---|---|
| As of inside a locked period | Render snapshot — fast path |
| Period close just ran | Income/Expense accounts show 0 closing as expected |
| Account has only `pending_approval` JEs | Not counted in TB |
| Negative balance (e.g., Bank overdraft) | Shown in the opposite normal-side column |
| Branch filter | Re-aggregate over branch-scoped lines; account balances may differ from tenant-level |
| 3-col + class filter on Equity | Shows opening/activity/closing for equity accounts only |

---

## 8. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| TB-01 | Fresh tenant | Only Owner's Capital + Cash/Bank match — Σ Dr = Σ Cr |
| TB-02 | After full month of activity | All rows present, Σ Dr = Σ Cr |
| TB-03 | Branch filter | Only that branch's books balance |
| TB-04 | 3-col view | Opening + activity = closing for every account |
| TB-05 | Include zero balances | Shows seeded accounts with 0 |
| TB-06 | Drill on Salaries debit | All 12 monthly JEs listed |
| TB-07 | Class filter = Asset only | TB still balanced? **No** — class filter is for display only; total row is hidden when not all classes shown |
| TB-08 | Export PDF | A4 portrait, rows fit |
| TB-09 | Unbalanced TB | Banner shown; integrity check link |

---

## 9. Acceptance criteria

1. TB always balances when underlying journal data is consistent.
2. 3-col view: Σ openingDr + Σ activityDr = Σ closingDr (and same for Cr) per account.
3. Drill-down reconciles to cell values.
4. Branch and class filters honoured.
5. PDF export contains every row visible in current view, no pagination drops.
