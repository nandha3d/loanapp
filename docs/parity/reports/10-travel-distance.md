# 10 · Travel Distance

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Distance travelled by each agent per day (sum of GPS leg distances) — fuel/effort and route-efficiency
measure. `gps/history` has the points; this computes and exports distance.

## 2. Source models (READ ONLY)
- `CollectionEntry` GPS pings (`:633`) ordered by time per agent/day. Haversine over consecutive points.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Date | `date` | date | center | |
| Stops | `stops` | number | right | ✓ |
| Distance (km) | `distanceKm` | number | right | ✓ |
| First Ping | `firstPing` | time | center | |
| Last Ping | `lastPing` | time | center | |

## 4. KPI cards
Total distance · avg per agent · longest route.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/travel-distance?from&to&branchId?&agentId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/travel-distance.ts`)
Per agent/day (scoped): order pings, sum haversine legs (reuse existing geo helper if present), count stops.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `travel-distance-<from>-to-<to>`.

## 9. i18n keys
`reports.travelDistance.title`, `reports.col.stops|distanceKm|firstPing|lastPing`.

## 10. RBAC + subscription
Supervisor/admin. Gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Distance computed in builder from existing pings. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Reuse existing haversine helper, no inline magic. Labels from i18n.

## 13. Test plan
Seed ping sequence with known coords → assert distance ≈ expected km; export matches.
