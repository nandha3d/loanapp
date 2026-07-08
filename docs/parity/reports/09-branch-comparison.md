# 09 · Branch Comparison

**Status:** 🆕 NEW · **Module scope:** all (multi-branch) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Side-by-side comparison of all branches on key metrics + rank — for head-office benchmarking. Pairs with the
"Branch Performance Comparison" dashboard chart (§16).

## 2. Source models (READ ONLY)
- Same as Branch Performance, presented as a ranked comparison matrix.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Rank | `rank` | number | center | |
| Branch | `branchName` | text | left | |
| Disbursed | `disbursed` | currency | right | ✓ |
| Collected | `collected` | currency | right | ✓ |
| Recovery % | `recovery` | percent | right | |
| Overdue % | `overduePct` | percent | right | |
| NPA % | `npaPct` | percent | right | |
| Score | `score` | number | right | |

`score` = weighted composite (recovery − overdue − npa); weights from `AppSetting`.

## 4. KPI cards
Top branch · bottom branch · spread (best − worst recovery).

## 5. Filters
Date range, Metric to rank by, Loan Type.

## 6. API contract
`GET /api/v1/reports/branch-comparison?from&to&rankBy=recovery|disbursed|score` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/branch-comparison.ts`)
Reuse branch-performance aggregation; add overdue%/npa% and composite score; sort + rank.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `branch-comparison-<from>-to-<to>`.

## 9. i18n keys
`reports.branchComparison.title`, `reports.col.rank|overduePct|npaPct|score`.

## 10. RBAC + subscription
Superadmin/owner only. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Score weights from `AppSetting`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Score weights + rank metric from `AppSetting`/input. Currency/labels from DB/i18n.

## 13. Test plan
Seed branches with differing recovery/npa → assert rank order + score; switch rankBy; export matches.
