# 07 · Agent Performance

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Per-agent scorecard: loans assigned, collections, pending, recovery %, visits, GPS attendance, distance.
`analytics/agents` + `buildReportData().agentPerformance` exist; combine + export.

## 2. Source models (READ ONLY)
- `analytics/agents` (expected/collected/hitRate). `lib/reports/data.ts:190` agentPerformance (customers/route).
- `CollectionEntry` GPS fields (`:633`) for visits/distance/attendance. `User` (`:123`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Loans Assigned | `customers` | number | right | ✓ |
| Collections | `collected` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |
| Recovery % | `recovery` | percent | right | |
| Visits | `visits` | number | right | ✓ |
| GPS Attendance | `attendancePct` | percent | right | |
| Distance (km) | `distanceKm` | number | right | ✓ |

## 4. KPI cards
Top performer · avg recovery % · total visits · total distance.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/agent-performance?from&to&branchId?&agentId?` → `ok(payload)`. Adapter combining
existing builders + GPS aggregation from `CollectionEntry`.

## 7. Aggregation (builder `lib/reports/builders/agent-performance.ts`)
Reuse `agentPerformance` (customers/expected/collected); add visits = count of GPS-captured entries,
distance = Σ leg distances (haversine helper if present), attendance = days with check-in / working days.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `agent-performance-<from>-to-<to>`.

## 9. i18n keys
`reports.agentPerformance.title`, `reports.col.loansAssigned|collections|pending|recovery|visits|attendance|distance`.

## 10. RBAC + subscription
Supervisor/admin; agent sees self. GPS columns gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses existing builders + GPS read. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Working-days basis from `AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Seed agents with collections + GPS entries → assert recovery/visits/distance; export matches.
