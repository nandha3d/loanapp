# 08 · Profit Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Income − Expenses = Profit for a period. The P&L already exists (premium accounting); this is the simplified
operator view (interest + penalty income vs expenses) for non-premium tenants, and wraps the premium P&L for
premium tenants.

## 2. Source models (READ ONLY)
- Premium: `accounting/pnl` (income/expense accounts). Basic: `AccountEntry` (`:1433`) income (collection/
  interest/penalty) vs expense categories.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Line | `line` | text | left | |
| Category | `category` | badge | left | |
| Amount | `amount` | currency | right | ✓ |

Sections: Income lines, Expense lines, **Net Profit** footer.

## 4. KPI cards
Total income · total expense · net profit · margin %.

## 5. Filters
Date range, Branch.

## 6. API contract
`GET /api/v1/reports/profit?from&to&branchId?` → `ok(payload)`. Premium → adapter over `accounting/pnl`;
basic → `AccountEntry` income/expense aggregation.

## 7. Aggregation (builder `lib/reports/builders/profit.ts`)
Premium: reuse `getPremium`-style P&L. Basic: sum income (interest+penalty+fees) − expenses from
`AccountEntry` (scoped).

## 8. Export mapping
3 columns (+ section subtotals + net footer) → CSV/Excel/PDF/Print. Filename `profit-<from>-to-<to>`.

## 9. i18n keys
`reports.profit.title`, `reports.col.line|category|amount`, `reports.net.profit`.

## 10. RBAC + subscription
Admin/owner/accountant. Premium variant gated by `isPremiumAccountingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses P&L / `AccountEntry`. No writes, no new columns, no journal change.

## 12. No-hardcode checklist
- [ ] Income/expense category mapping from existing enum. Currency/labels from DB/i18n.

## 13. Test plan
Seed income + expense entries → assert net profit = income − expense; premium path matches P&L; export matches.
