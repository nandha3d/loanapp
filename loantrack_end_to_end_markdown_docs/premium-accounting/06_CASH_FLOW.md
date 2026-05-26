# 06 · Cash Flow Statement

> Operating / Investing / Financing activities for a period. Derived from cash & bank account movements with reclassification rules.

---

## 1. Purpose

Show **where cash came from and where it went** during a period:

- **Operating activities** — collections, interest income, expense payments, tax payments
- **Investing activities** — fixed asset purchases / sales, investments
- **Financing activities** — owner capital additions/withdrawals, bank loan drawdowns/repayments

Bottom line: Net change in cash + bank, reconciled to actual movement.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/cashflow` |
| **File** | `app/(dashboard)/[module]/accounting/premium/cashflow/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/cashflow/CashFlowClient.tsx` |
| **Role gate** | `admin` / `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

Read-only.

---

## 3. Method

Use the **Direct method** (clearer for non-accountants; lenders care about cash movements, not accruals):

- Walk every journal line in the period where one side touches a cash account (`account.isCash = true`).
- Look at the **counter-account** (the other side of the entry) to classify the cash movement.

```
For each JE with at least one line on a cash account:
  cash_change = Σ Dr on cash − Σ Cr on cash  (inflow positive)
  For each non-cash line in the entry:
    classification = classifyCounterAccount(line.account)
    bucket[classification] += (sign of cash_change) × abs(line.amount)
```

`classifyCounterAccount` is a rule table in `lib/accounting/cashflowRules.ts`:

| Counter-account sub-type | Bucket |
|---|---|
| `receivable` (Loans, Penalties Receivable) | Operating |
| `operating_income`, `other_income` | Operating |
| `operating_expense`, `tax`, `cogs`, `depreciation`-on-P&L | Operating |
| `payable` (Vendor / Bills Payable, Accrued) | Operating |
| `fixed_asset`, `accumulated_depreciation` | Investing |
| `capital`, `reserves` (Owner's Capital, Retained Earnings, Current Year Earnings) | Financing |
| Bank Loans (`payable` AND code matches `2400`) | Financing (override by code) |
| Anything else | Operating (default; surfaces as warning) |

Overrides are configurable per account in CoA via a `cashflowBucket` field (`'operating'|'investing'|'financing'|'auto'`, default `'auto'`).

---

## 4. UI layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Cash Flow Statement                                            │
│ Period: [01 May 2026] – [31 May 2026]   Compare: [Prev period ▾]         │
│ Method: [● Direct] [○ Indirect]    [⇩ PDF]  [⇩ Excel]                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                              May 2026     Apr 2026       │
│                                              ─────────    ─────────      │
│  Opening Cash + Bank                            57,200        45,000     │
│                                                                          │
│  OPERATING ACTIVITIES                                                    │
│    Collections (interest + principal)         150,000       142,000      │
│    Penalty income                                3,500         2,800     │
│    Processing fees                              12,000        10,000     │
│    Loan disbursements                         (100,000)     (90,000)     │
│    Salaries paid                              (60,000)      (60,000)     │
│    Rent paid                                  (25,000)      (25,000)     │
│    Bills paid                                  (12,000)       (8,500)    │
│    GST paid                                    (5,000)        (4,200)    │
│    Other operating expenses                    (8,000)        (6,000)    │
│  Net cash from operating                       (44,500)      (38,900)    │
│                                                                          │
│  INVESTING ACTIVITIES                                                    │
│    Purchase of office equipment                      0       (20,000)    │
│  Net cash from investing                             0       (20,000)    │
│                                                                          │
│  FINANCING ACTIVITIES                                                    │
│    Owner capital added                          50,000        80,000     │
│    Bank loan drawdown                                0             0     │
│    Bank loan repayment                          (5,000)       (5,000)    │
│  Net cash from financing                        45,000        75,000     │
│                                                                          │
│  Net change in cash                                500        16,100     │
│  Closing Cash + Bank                            57,700        57,200     │
│  Reconciliation: matches Balance Sheet? ✔                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### Indirect method (toggle)

Starts from Net Profit and adjusts for non-cash items + working-capital changes:

```
Net Profit                              37,000
+ Depreciation                           8,000
+ Bad debts                                  0
+/− Δ Loans Receivable               (137,890)
+/− Δ Bills Payable                    13,600
+/− Δ Output GST                        2,500
+/− Δ Input GST                          (600)
Cash from Operating                   (77,390)
```

Both methods reconcile to the same Net change in cash.

### Reconciliation badge

Bottom-right: `✔ matches Balance Sheet` (green) or `⚠ mismatch by ₹X` (red). Click → opens a debug pane listing JEs not captured by the bucket logic.

---

## 5. Data fetch

```ts
const periodJEs = await prisma.journalEntry.findMany({
  where: {
    tenantId,
    branchId: branchId ?? undefined,
    status: 'posted',
    entryDate: { gte: period.from, lte: period.to },
    lines: { some: { account: { isCash: true } } },
  },
  include: { lines: { include: { account: true } } },
});

const buckets = bucketize(periodJEs);   // { operating: [...], investing: [...], financing: [...] }
const opening = await getCashBankBalance(tenantId, branchId, subDays(period.from, 1));
const closing = await getCashBankBalance(tenantId, branchId, period.to);
const netChange = closing - opening;
const reconciled = Math.abs(netChange - (sum(buckets.operating) + sum(buckets.investing) + sum(buckets.financing))) < 0.01;
```

For periods > 6 months, fall back to monthly snapshots from `account_balances` + intra-period detail only for the latest month, to keep < 1 s render time.

---

## 6. Export

PDF (`lib/accounting/pdfs/cashflow.tsx`) and Excel formats as P&L. Excel sheet name: `Cash Flow May 2026`.

---

## 7. i18n (`pa.cashflow`)

```ts
pa: {
  cashflow: {
    title: 'Cash Flow Statement',
    periodLabel: 'Period',
    methodLabel: 'Method',
    methodDirect: 'Direct',
    methodIndirect: 'Indirect',
    openingCash: 'Opening Cash + Bank',
    closingCash: 'Closing Cash + Bank',
    netChange: 'Net change in cash',
    operating: 'OPERATING ACTIVITIES',
    investing: 'INVESTING ACTIVITIES',
    financing: 'FINANCING ACTIVITIES',
    netOperating: 'Net cash from operating',
    netInvesting: 'Net cash from investing',
    netFinancing: 'Net cash from financing',
    reconciled: '✔ matches Balance Sheet',
    notReconciled: '⚠ mismatch by {amount}',
    debugTitle: 'Unbucketed entries',
    netProfit: 'Net Profit',
    addDepreciation: '+ Depreciation',
    addBadDebts: '+ Bad debts',
    deltaPrefix: '+/− Δ',
  },
}
```

---

## 8. Edge cases

| Case | Behaviour |
|---|---|
| JE has 3+ non-cash lines | Pro-rate cash change across them by share of total non-cash amount |
| JE has cash on both sides (Dr 100 Cash, Cr 100 Cash) | Skip — internal transfer between cash accounts |
| Account `cashflowBucket='auto'` and rule cannot classify | Add to Operating with warning surfaced in debug pane |
| Period spans an account becoming `isCash=true` mid-period | Use `isCash` value as of period start for consistency |
| Indirect method, P&L includes intra-period reversal | Net Profit is correct; depreciation add-back still applies |
| Closing − opening ≠ Σ activities | Reconciliation banner red; debug pane lists offending JEs |

---

## 9. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| CF-01 | One collection 1,000 of which 800 principal 200 interest | Operating inflow 1,000 |
| CF-02 | One loan disbursement 5,000 | Operating outflow 5,000 |
| CF-03 | Owner adds 10,000 capital via bank | Financing inflow 10,000 |
| CF-04 | Buy laptop 30,000 from bank | Investing outflow 30,000 |
| CF-05 | Pay rent 5,000 cash | Operating outflow 5,000 |
| CF-06 | Internal cash to bank transfer 2,000 | Bucket sum unchanged (skip) |
| CF-07 | Direct vs Indirect total | Both equal net change |
| CF-08 | Reconciliation against BS | Green badge when balanced |
| CF-09 | Account override `cashflowBucket='financing'` | Movement appears in Financing not Operating |
| CF-10 | Export PDF | Layout matches mock above |

---

## 10. Acceptance criteria

1. Cash Flow reconciles to Balance Sheet cash movement within ₹0.01.
2. Direct and Indirect methods yield the same Net Change.
3. Inter-cash transfers excluded.
4. Account overrides honoured.
5. Branch filter respected.
6. Debug pane lists every JE not assigned a bucket.
