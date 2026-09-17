# 07 · GPS Route Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
The agent's visited-customers map/list for a day — geo-tagged collection stops in order, with a map view and
a table. `gps/history/[id]` + `gps/agent/[id]/collections` exist; wrap + export.

## 2. Source models (READ ONLY)
- Existing `gps/agent/[id]/collections`, `gps/history/[id]`. `CollectionEntry` GPS fields (`:633`):
  `lat`, `lng`, `gpsCapturedAt`, `distanceFromCustomerM`, `locationStatus`.

## 3. On-screen table (below the map)
| Column | key | type | align | total |
|---|---|---|---|---|
| # | `seq` | number | center | |
| Time | `gpsCapturedAt` | time | center | |
| Customer | `customerName` | text | left | |
| Lat,Lng | `coords` | text | left | |
| Dist from Cust (m) | `distanceFromCustomerM` | number | right | |
| Geo Status | `locationStatus` | badge | center | |
| Amount | `receivedAmount` | currency | right | ✓ |

## 4. KPI cards
Stops · total distance · on-location % · total collected.

## 5. Filters
Agent (required), Date (single), Branch.

## 6. API contract
`GET /api/v1/reports/gps-route?agentId&date&branchId?` → `ok(payload)` (+ map points). Adapter over existing
GPS endpoints.

## 7. Aggregation
Reuse existing GPS history query (scoped); order by time; sequence stops; compute leg distance.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print (map omitted in CSV/Excel; PDF may embed a static map snapshot — phase 2).
Filename `gps-route-<agent>-<date>`.

## 9. i18n keys
`reports.gpsRoute.title`, `reports.col.seq|coords|distFromCust|geoStatus`.

## 10. RBAC + subscription
Supervisor/admin; agent sees self. Gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing GPS endpoints. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Geofence radius from `AppSetting` (reuse existing). Currency/labels from DB/i18n.

## 13. Test plan
Seed GPS-tagged entries → assert ordered stops + distances; export matches table.
