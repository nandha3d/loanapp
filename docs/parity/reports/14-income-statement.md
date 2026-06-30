# 14 · Income Statement (P&L)

**Status:** ✅ EXISTS (wrap) · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Formal Profit & Loss — income accounts vs expense accounts → net profit. Already exists; wrap + add Excel/PDF.
(Operator's simplified "Profit Report" is §08; this is the accounting-grade statement.)

## 2. Source models (READ ONLY)
- Existing `accounting/pnl`: `incomeAccounts[]`, `expenseAccounts[]`, totals, `netProfit`. `Account`/`JournalLine`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Account | `accountName` | text | left | |
| Class | `classType` | badge | center | |
| Amount | `amount` | currency | right | ✓ |

Sections: Income (subtotal), Expense (subtotal), **Net Profit** footer.

## 4. KPI cards
Total income · total expense · net profit · margin %.

## 5. Filters
Date range (from/to; defaults current month — matches existing), Branch.

## 6. API contract
**Existing:** `GET /api/v1/accounting/pnl?from&to`. Add adapter → `ReportPayload`.

## 7. Aggregation
Reuse existing P&L (no change). Adapter sections income/expense + net.

## 8. Export mapping
3 columns + subtotals + net → CSV/Excel/PDF/Print. Filename `income-statement-<from>-to-<to>`.

## 9. i18n keys
`reports.incomeStatement.title`, `reports.col.account|class|amount`, `reports.net.profit`.

## 10. RBAC + subscription
Accountant+; gated by `isPremiumAccountingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to P&L logic. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Account classes from COA, not constants. Currency/labels from DB/i18n.

## 13. Test plan
Post journals → assert income/expense/net = existing P&L; export matches.
