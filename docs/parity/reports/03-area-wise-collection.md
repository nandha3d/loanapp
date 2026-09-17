# 03 · Area-wise Collection

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Collection rolled up by geography — Village / City / Zone / Branch / Route. Shows where money is coming
from and where recovery lags.

## 2. Source models (READ ONLY)
- `CollectionEntry` (`:618`) / `DailyCollection` (`:588`): `receivedAmount`, `dueAmount`.
- Geography via `Customer.routeId` (`:283`) → `Route`; area/city/village from `Route` fields or
  `AppSetting` area mapping. **Area taxonomy is data-driven**, never hardcoded.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Area | `area` | text | left | |
| Customers | `customers` | number | right | |
| Expected | `expected` | currency | right | ✓ |
| Collected | `collected` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |
| Efficiency % | `efficiency` | percent | right | |

## 4. KPI cards
Best/worst area · total collected · area count.

## 5. Filters
Date range, Branch, Group-by = route|city|village|zone, Agent.

## 6. API contract
`GET /api/v1/reports/area-wise-collection?from&to&branchId?&groupBy=route|city|village|zone` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/area-wise-collection.ts`)
Join entries → customer → route/area; group by the chosen geography level (scoped); sum expected/collected.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `area-wise-collection-<from>-to-<to>`.

## 9. i18n keys
`reports.areaWiseCollection.title`, `reports.col.area|customers|expected|collected|pending|efficiency`.

## 10. RBAC + subscription
Admin/manager. Agent scoped to own areas. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only joins/aggregation. No writes, no new columns. Area mapping from existing Route/AppSetting.

## 12. No-hardcode checklist
- [ ] Geography levels/labels from Route/AppSetting, not constants.
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed customers across routes/cities → assert per-area sums; switch groupBy; export matches.
