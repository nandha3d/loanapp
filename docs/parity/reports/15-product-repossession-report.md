# 15 · Product Repossession Report 💎

**Status:** 🆕 NEW · **Module scope:** `productfinance` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Financed products flagged for / under repossession due to default — what's being recovered, when, and
recovery value. The collections endgame for product finance.

## 2. Source models (READ ONLY)
- `ProductFinanceItem` (`:984`): `repossessionStatus`, `repossessedAt`, `financedAmount`, `serialNo`.
- `Loan` (`:444`) outstanding/overdue for context.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Product | `productName` | text | left | |
| Serial No | `serialNo` | text | left | |
| Outstanding | `outstanding` | currency | right | ✓ |
| Repo Status | `repossessionStatus` | badge | center | |
| Repossessed Date | `repossessedAt` | date | center | |

## 4. KPI cards
Flagged · repossessed · outstanding at risk · recovered value.

## 5. Filters
Date range, Branch, Status, Category.

## 6. API contract
`GET /api/v1/reports/product-repossession?from?&to?&branchId?&status?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/product-repossession.ts`)
`findMany` `ProductFinanceItem` where `repossessionStatus != 'active'` (scoped); join loan outstanding.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `product-repossession-<from>-to-<to>`.

## 9. i18n keys
`reports.productRepossession.title`, `reports.col.repoStatus|repossessedDate`.

## 10. RBAC + subscription
Product admin/manager/recovery. Module gate `productfinance`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns, no repossession action from report.

## 12. No-hardcode checklist
- [ ] Status from existing enum. Currency/labels from DB/i18n.

## 13. Test plan
Seed items in repo statuses → assert listing + at-risk total; export matches.
