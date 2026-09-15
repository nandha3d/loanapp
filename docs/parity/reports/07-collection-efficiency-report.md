# 07 · Collection Efficiency Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Collected vs Expected with efficiency %, sliced by agent/route/branch/period. `app/api/reports/route.ts`
(`?type=collection_efficiency`) + `buildReportData().collectionEfficiency` exist; wrap + export.

## 2. Source models (READ ONLY)
- Existing collection_efficiency report. `Instalment` (`:529`) expected/received by period.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Group (Agent/Route/Day) | `group` | text | left | |
| Expected | `expected` | currency | right | ✓ |
| Collected | `collected` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |
| Efficiency % | `efficiency` | percent | right | |

## 4. KPI cards
Overall efficiency · best/worst group · total pending.

## 5. Filters
Date range, Branch, Agent, Route, Group-by = agent|route|day.

## 6. API contract
`GET /api/v1/reports/collection-efficiency?from&to&groupBy=agent|route|day&branchId?` → `ok(payload)`.
Adapter over existing admin report logic.

## 7. Aggregation
Reuse `buildReportData().collectionEfficiency` + the admin report's grouping (scoped); efficiency =
collected/expected (`lib/reports/data.ts:46`).

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `collection-efficiency-<from>-to-<to>`.

## 9. i18n keys
`reports.collectionEfficiency.title`, `reports.col.group|expected|collected|pending|efficiency`.

## 10. RBAC + subscription
Supervisor/admin; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing endpoint. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Group options data-driven. Currency/labels from DB/i18n.

## 13. Test plan
Seed instalments → assert efficiency per group == manual; export matches.
