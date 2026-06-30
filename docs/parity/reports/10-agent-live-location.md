# 10 · Agent Live Location

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Real-time map of where agents are now, with a supporting table (last ping time, status). `gps/live` exists;
wrap into the shell with a refreshable map + exportable snapshot table.

## 2. Source models (READ ONLY)
- Existing `gps/live`. `CollectionEntry` latest GPS ping per agent; `User` (`:123`).

## 3. On-screen table (under live map)
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Last Ping | `lastPing` | time | center | |
| Lat,Lng | `coords` | text | left | |
| Status | `status` | badge | center | |
| Today's Visits | `visits` | number | right | ✓ |

`status` ∈ {Online, Idle, Offline} from ping-age threshold (`AppSetting`).

## 4. KPI cards
Online now · idle · offline · total field staff.

## 5. Filters
Branch, Agent, Status.

## 6. API contract
`GET /api/v1/reports/agent-live-location?branchId?` → `ok(payload)` (+ live points). Adapter over `gps/live`.

## 7. Aggregation
Reuse `gps/live` (scoped); classify status by ping age; count today's visits.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print (snapshot; map not in CSV/Excel). Filename `agent-live-<timestamp>`.

## 9. i18n keys
`reports.agentLive.title`, `reports.col.lastPing|coords|status|visits`, `reports.live.online|idle|offline`.

## 10. RBAC + subscription
Supervisor/admin. Gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to `gps/live`. Adapter read-only/additive. Idle/offline thresholds from `AppSetting`.

## 12. No-hardcode checklist
- [ ] Ping-age thresholds from `AppSetting`. Labels from i18n.

## 13. Test plan
Seed recent/stale pings → assert online/idle/offline classification; export snapshot matches table.
