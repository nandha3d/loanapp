# 10 · Missed GPS Check-in

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Agents who did **not** check in / had no GPS activity on a working day — coverage gaps and possible
attendance issues. Complements Agent Attendance with a pure GPS-presence lens.

## 2. Source models (READ ONLY)
- `User` (`:123`) active agents vs `CollectionEntry` with `gpsCapturedAt` that day (scoped).
- Working days from `AppSetting` (`working_days`, holidays).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Date | `date` | date | center | |
| Branch | `branchName` | text | left | |
| Last Seen | `lastSeen` | date | center | |
| Days Since Check-in | `daysSince` | number | right | |

## 4. KPI cards
Missed check-ins today · agents with no activity ≥3d · coverage %.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/missed-gps-checkin?from&to&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/missed-gps-checkin.ts`)
For each working day in range: active agents (scoped) ANTI-JOIN agents with a GPS ping that day → missing;
compute daysSince from last ping.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `missed-gps-checkin-<from>-to-<to>`.

## 9. i18n keys
`reports.missedGpsCheckin.title`, `reports.col.lastSeen|daysSince`.

## 10. RBAC + subscription
Supervisor/admin. Gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only anti-join. Working-days/holidays from `AppSetting`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Working days/holidays from `AppSetting`. Labels from i18n.

## 13. Test plan
Seed agents with/without pings on working days → assert only no-activity agents listed; holidays excluded; export matches.
