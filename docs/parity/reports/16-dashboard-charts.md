# 16 · Dashboard Charts (15 visualizations)

**Status:** 🆕 NEW (charts) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md) §6

## 1. Purpose
The visual layer: charts and graphs that summarize the report data on the dashboard/analytics pages. Reuses
the existing Recharts setup (`app/(dashboard)/[module]/dashboard/CollectionTrendChart.tsx`) — **no new
charting library**. Each chart is fed by a read-only aggregation endpoint (mostly existing analytics).

## 2. Source / feed map (READ ONLY)
Each chart reads from an existing or report-builder endpoint; no chart computes money itself.

| # | Chart | Type | Feed (endpoint / builder) |
|---|---|---|---|
| 1 | Collection Trend (D/W/M) | line | `analytics/collections` |
| 2 | Loan Disbursement Trend | line/bar | `reports/disbursement?groupBy=date` |
| 3 | Outstanding vs Collected | grouped bar | `analytics/summary` + `outstanding-balance` |
| 4 | Overdue Aging Distribution | bar | `reports/aging` (6 buckets) |
| 5 | Loan Portfolio by Type | pie/donut | `reports/loan-type` |
| 6 | Top 10 Agents by Collection | horizontal bar | `analytics/agents` |
| 7 | Top 10 Customers by Outstanding | horizontal bar | `reports/top-borrowers?rankBy=outstanding` |
| 8 | Monthly Interest Income | bar | `reports/interest-income?bucket=month` |
| 9 | Collection Success Rate | gauge/line | `analytics/summary` (efficiency) |
| 10 | Branch Performance Comparison | bar | `reports/branch-comparison` |
| 11 | Payment Method Distribution | pie | `reports/collection-mode` |
| 12 | New Customers per Month | bar | `customers` groupBy month (builder) |
| 13 | Loan Closure Trend | line | `loans` closed groupBy month (builder) |
| 14 | Default Trend | line | `reports/aging`/NPA over time |
| 15 | Geographic Collection Heat Map | map heat | `reports/area-wise-collection` + GPS coords |

## 3. On-screen behavior
- Charts render on the dashboard/analytics page; each has a "view as table" toggle that drops into the
  relevant `<ReportShell>` report (so the underlying numbers are always inspectable + exportable).
- Date-range + branch filters at the top drive all charts (shared FilterBar).

## 4. Export
- Charts themselves: "Download PNG" (client canvas) — phase 2.
- The **data** behind every chart exports via its linked report (table-first principle preserved).

## 5. Filters
Global: Date range, Branch. Per-chart: granularity (day/week/month) where applicable — all from data, no
hardcoded period lists.

## 6. API contract
No new endpoints required for charts 1, 3, 6, 9 (existing analytics). Charts 2,4,5,7,8,10,11,15 reuse the
report builders from this doc set. Charts 12,13 add small groupBy-month builders (read-only). 14 reuses
aging/NPA.

## 7. i18n keys
`reports.chart.<n>.title` for each, plus axis/legend labels via existing i18n. 6 languages.

## 8. RBAC + subscription
Charts respect the same scope as their feed report (agent sees own; admin tenant). Heat map gated by
`gpsTrackingEnabled`.

## 9. ⚠️ Core-untouched guarantee
All chart feeds are read-only aggregations. No new charting dependency (reuse Recharts). No writes, no schema
change. Charts 12/13 add read-only builders only.

## 10. No-hardcode checklist
- [ ] Period/granularity options from data/`AppSetting`.
- [ ] Colors from the tenant theme (`/theme`), not hardcoded.
- [ ] All labels via i18n.

## 11. Test plan
Seed a few months of loans/collections → assert each chart's series matches its linked report's table totals;
"view as table" opens the matching report; theme colors applied; scope holds.
