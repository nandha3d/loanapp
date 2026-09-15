# 03 · Date-wise Collection

**Status:** ✅ EXISTS (extend) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Collection totals across a date range (From → To), one row per day: expected vs collected vs pending.
Used for trend review and period reconciliation. Time-series already exists for charts.

## 2. Source models (READ ONLY)
- Existing `app/api/v1/analytics/collections/route.ts` returns `[{date, expected, collected}]`.
- Backed by `DailyCollection` (`:588`) / `Instalment` (`:529`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `date` | date | left | |
| Expected | `expected` | currency | right | ✓ |
| Collected | `collected` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |
| Efficiency % | `efficiency` | percent | right | |

## 4. KPI cards
Range total expected · collected · pending · avg efficiency.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/date-wise-collection?from&to&branchId?&agentId?` → `ok(payload)`. May reuse/extend the
analytics endpoint's aggregation; emit `ReportPayload` with the per-day rows + totals.

## 7. Aggregation (builder `lib/reports/builders/date-wise-collection.ts`)
Group `DailyCollection` by `date` within range (scoped), sum expected/collected; pending = expected −
collected; efficiency = collected/expected.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `date-wise-collection-<from>-to-<to>`.

## 9. i18n keys
`reports.dateWiseCollection.title`, `reports.col.date|expected|collected|pending|efficiency`.

## 10. RBAC + subscription
Agent scoped; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only aggregation; reuses existing analytics query. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Currency/labels from DB/i18n. No magic ranges.

## 13. Test plan
Seed multi-day collections → assert per-day rows + range totals; export matches screen.
