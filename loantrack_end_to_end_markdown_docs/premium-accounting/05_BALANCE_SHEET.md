# 05 · Balance Sheet

> Point-in-time snapshot of Assets = Liabilities + Equity.

---

## 1. Purpose

Show the tenant's financial position at a chosen date, grouped into Assets, Liabilities, Equity. Always balanced (sum of Assets = Liabilities + Equity); if not, a red banner indicates corruption to investigate.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/balance-sheet` |
| **File** | `app/(dashboard)/[module]/accounting/premium/balance-sheet/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/balance-sheet/BalanceSheetClient.tsx` |
| **Role gate** | `admin` / `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

Read-only.

---

## 3. UI layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Balance Sheet                                                  │
│ As of: [31 May 2026 ▾]   Compare: [Prev month ▾]                         │
│ [⇩ Export PDF]  [⇩ Excel]  [Print]                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                              31-May-26     30-Apr-26     │
│                                              ─────────     ─────────     │
│  ASSETS                                                                  │
│   Current Assets                                                         │
│     1100  Cash on Hand                          12,340        15,200     │
│     1200  Bank Accounts                         50,000        42,000     │
│     1300  Loans Receivable                    4,567,890     4,430,000    │
│     1400  Input GST                              8,100         7,500     │
│   Total Current Assets                        4,638,330     4,494,700    │
│                                                                          │
│   Fixed Assets                                                           │
│     1500  Fixed Assets (gross)                 200,000       200,000     │
│     1900  Less: Accum. Depreciation            (40,000)      (32,000)    │
│   Total Fixed Assets                           160,000       168,000     │
│                                                                          │
│  Total Assets                                 4,798,330     4,662,700    │
│                                                                          │
│  LIABILITIES                                                             │
│     2100  Bills Payable                         32,100        18,500     │
│     2200  TDS Payable                            2,000         1,500     │
│     2300  Output GST                            12,300         9,800     │
│     2400  Bank Loans                           500,000       500,000     │
│   Total Liabilities                            546,400       529,800     │
│                                                                          │
│  EQUITY                                                                  │
│     3100  Owner's Capital                    4,000,000     4,000,000     │
│     3200  Retained Earnings                    130,130        80,000     │
│     3300  Current Year Earnings                121,800        52,900     │
│   Total Equity                               4,251,930     4,132,900    │
│                                                                          │
│  Total Liabilities + Equity                  4,798,330     4,662,700    │
│                                                                          │
│  ✔ Balanced (Assets − L+E = 0)                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Comparison column

`Prev month` (default) · `Prev quarter` · `Same date last year` · `None`.

### Detail toggle

Like P&L, two modes: **Summary** (leaf accounts) and **Detail** (with parent rollups and collapsible groups).

### Sign convention

- Asset accounts: positive values shown as is.
- Liability + Equity accounts: balances are credit-normal; shown as positive numbers.
- "Less" prefix on contra-accounts (Accumulated Depreciation, Provision for Doubtful Debts, etc.) with values in parentheses.

### Drill-down

Click any number → side panel listing journal entries up to and including the "as-of" date that contributed to the account's balance.

### Balance check banner

After rendering, the client checks `|Σ assets − (Σ liabilities + Σ equity)| ≤ 0.01`. If true → green `✔ Balanced`. Else → red banner with the difference and a "Run integrity check" button that calls `lib/accounting/integrity.ts → runIntegrityCheck()` (lists potential causes: orphan journal lines, missing reversal entries, period close not run).

---

## 4. Data fetch

```ts
const asOf = parseDate(params.asOf);
const compareAsOf = comparePeriod === 'prev_month' ? subMonths(asOf, 1) : ...;

const balances = await getAccountBalancesAsOf(tenantId, branchId, asOf);
const compareBalances = comparePeriod !== 'none'
  ? await getAccountBalancesAsOf(tenantId, branchId, compareAsOf)
  : null;
```

`getAccountBalancesAsOf` reads from `account_balances` for the period containing the date, then adds intra-period journal-line activity from `period_from` to `asOf`. For `asOf = end-of-period`, it returns the snapshot directly.

### Current Year Earnings

Calculated dynamically as `Net Profit YTD` (from FY start to `asOf`) — even when period close has not been run. This keeps the BS balanced even mid-period.

### Retained Earnings

The static balance from `account_balances` for account `3200`. When period close runs at FY end, the prior year's `3300` is rolled into `3200`.

---

## 5. Export

Same export buttons as P&L. The PDF template (`lib/accounting/pdfs/balanceSheet.tsx`) renders A4 portrait, includes a "Director's signature" placeholder block at the bottom, and a footer with `<asOf>`, page number, and "Generated by LoanTrack Premium".

---

## 6. i18n (`pa.balanceSheet`)

```ts
pa: {
  balanceSheet: {
    title: 'Balance Sheet',
    asOf: 'As of',
    assets: 'ASSETS',
    currentAssets: 'Current Assets',
    fixedAssets: 'Fixed Assets',
    less: 'Less:',
    totalCurrentAssets: 'Total Current Assets',
    totalFixedAssets: 'Total Fixed Assets',
    totalAssets: 'Total Assets',
    liabilities: 'LIABILITIES',
    totalLiabilities: 'Total Liabilities',
    equity: 'EQUITY',
    totalEquity: 'Total Equity',
    totalLE: 'Total Liabilities + Equity',
    balanced: '✔ Balanced (Assets − L+E = 0)',
    unbalanced: '⚠ Out of balance by {diff}',
    integrityCheck: 'Run integrity check',
    drillDownTitle: 'Journal entries — {account} as of {date}',
  },
}
```

---

## 7. Edge cases

| Case | Behaviour |
|---|---|
| As-of date in the future | All numbers compute as if today's values are projected forward (no growth assumption). |
| Pending approvals exist | Excluded — only `status='posted'` JEs count. Toast: "3 entries pending approval; not included in this view." |
| Reversed JE before as-of | Counted (zero net effect). |
| Period close not yet run for previous FY | `3200 Retained Earnings` may understate; show note "Period close pending for FY 2025-26". |
| BS unbalanced | Red banner, blocks export (export buttons disabled until fixed) unless developer overrides. |
| Branch filter set but parent accounts have lines from other branches | Sum only intersecting JEs; parent rollup uses only branch-filtered children. |

---

## 8. Integrity check

`lib/accounting/integrity.ts`:

```ts
export async function runIntegrityCheck(tenantId: string, branchId?: string | null) {
  return {
    orphanLines: await prisma.journalLine.count({
      where: { entry: { tenantId, status: 'posted' }, account: { tenantId: { not: tenantId } } },
    }),
    unbalancedEntries: await prisma.$queryRaw`
      SELECT entry_id, SUM(debit) AS dr, SUM(credit) AS cr
      FROM journal_lines
      JOIN journal_entries ON journal_entries.id = journal_lines.entry_id
      WHERE journal_entries.tenant_id = ${tenantId} AND journal_entries.status = 'posted'
      GROUP BY entry_id HAVING ABS(SUM(debit) - SUM(credit)) > 0.01
    `,
    missingClosingEntries: await detectMissingPeriodClose(tenantId, branchId),
    duplicateSources: await prisma.$queryRaw`
      SELECT source_type, source_id, COUNT(*) AS n FROM journal_entries
      WHERE tenant_id = ${tenantId} AND source_id IS NOT NULL
      GROUP BY source_type, source_id HAVING n > 1
    `,
  };
}
```

Report opens in a modal listing each issue with a "View" link to the offending entries.

---

## 9. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| BS-01 | Fresh tenant, only seed JEs | Capital = Cash (balanced) |
| BS-02 | After one loan disbursement | Loans Rec + Bank balanced, no equity change |
| BS-03 | After one collection | Cash up, Loans Rec down, no equity change, **but** Interest Income (P&L) creates Current Year Earnings increase |
| BS-04 | Period close run | `3200` += last `3300`, last `3300` resets to 0 |
| BS-05 | Drill-down on Loans Receivable as of mid-month | Lists all JEs to that account up to that date |
| BS-06 | Future as-of date | Projects current state forward, balanced |
| BS-07 | Branch filter, journals in 2 branches | Branch-only balance is balanced for that branch's books |
| BS-08 | Manually corrupt a JE in DB | BS shows red banner, integrity check lists it |
| BS-09 | Export PDF when unbalanced | Export button disabled, tooltip "Resolve imbalance to export" |
| BS-10 | Page load with 100k JEs | < 800 ms (mostly served from snapshot) |

---

## 10. Acceptance criteria

1. Balance Sheet always balances when journal data is consistent.
2. Current Year Earnings auto-derived from YTD P&L when period close not run.
3. Drill-down totals reconcile to cell values.
4. PDF export includes signature block and footer.
5. Branch and as-of-date filters honoured.
6. Unbalanced sheet blocks export unless developer override.
7. Integrity check actionable (lists offending entry ids and links).
