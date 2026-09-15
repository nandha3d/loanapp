# 06 · Top Borrowers

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers ranked by **highest loan amount / exposure** — the concentration list for risk and relationship
management. Also feeds the "Top 10 customers by outstanding" dashboard chart.

## 2. Source models (READ ONLY)
- `Loan` (`:444`) grouped by `customerId`: `_sum` principal/disbursed/outstanding. `Customer` (`:283`).
- Top-N from `getSetting(tenantId,'report_top_n','10')`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Rank | `rank` | number | center | |
| Customer | `customerName` | text | left | |
| Active Loans | `activeLoans` | number | right | |
| Total Disbursed | `totalDisbursed` | currency | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |
| % of Portfolio | `share` | percent | right | |

## 4. KPI cards
Top-10 share of book · largest exposure · concentration risk %.

## 5. Filters
Branch, Agent, Rank-by = disbursed|outstanding, Top N.

## 6. API contract
`GET /api/v1/reports/top-borrowers?branchId?&rankBy=disbursed|outstanding&n?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/top-borrowers.ts`)
`groupBy customerId` (scoped) `_sum`; sort by chosen metric desc; take N; share = value / portfolio total.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `top-borrowers-<date>`.

## 9. i18n keys
`reports.topBorrowers.title`, `reports.col.rank|totalDisbursed|share`.

## 10. RBAC + subscription
Admin/manager only (concentration data). Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `groupBy`. Top-N from `AppSetting`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] N + rank metric from input/`AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Seed customers with varied exposure → assert rank order + share sums correctly; switch rankBy; export matches.
