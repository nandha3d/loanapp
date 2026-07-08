# 08 · Cash Flow Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Money In vs Money Out over a period — disbursals, collections, expenses, capital movements. `AccountEntry`
gives a basic cashflow; premium `accounting/cashflow` gives the full statement. Wrap + export.

## 2. Source models (READ ONLY)
- `AccountEntry` (`:1433`): `type` (capital_add/withdraw, loan_disburse, collection, expense), `category`
  (cash/bank/upi/…), `amount`, `entryDate`. Premium: `accounting/cashflow` service.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date / Bucket | `bucket` | text | left | |
| Money In | `inflow` | currency | right | ✓ |
| Money Out | `outflow` | currency | right | ✓ |
| Net | `net` | currency | right | ✓ |
| Running Balance | `balance` | currency | right | |

## 4. KPI cards
Total in · total out · net cash flow · closing balance.

## 5. Filters
Date range, Branch, Bucket = day|week|month.

## 6. API contract
`GET /api/v1/reports/cash-flow?from&to&branchId?&bucket?` → `ok(payload)`. Basic = `AccountEntry` aggregation;
premium tenants get the richer `accounting/cashflow` output via the same adapter.

## 7. Aggregation (builder `lib/reports/builders/cash-flow.ts`)
Group `AccountEntry` by date bucket (scoped via `appType`); inflow = collection + capital_add; outflow =
loan_disburse + expense + capital_withdraw; running balance cumulatively.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `cash-flow-<from>-to-<to>`.

## 9. i18n keys
`reports.cashFlow.title`, `reports.col.moneyIn|moneyOut|net|runningBalance`.

## 10. RBAC + subscription
Admin/owner/accountant. Premium variant gated by `isPremiumAccountingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses `AccountEntry`/premium cashflow. No writes, no new columns, no journal posting.

## 12. No-hardcode checklist
- [ ] Inflow/outflow type mapping from existing `AccountEntry.type` enum. Currency/labels from DB/i18n.

## 13. Test plan
Seed account entries → assert in/out/net/running balance; premium path matches service; export matches.
