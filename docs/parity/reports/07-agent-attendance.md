# 07 · Agent Attendance

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Daily login / logout / working hours per agent, derived from first and last GPS-tagged activity (and/or
session events). The field-staff attendance sheet.

## 2. Source models (READ ONLY)
- `CollectionEntry` (`:618`) `gpsCapturedAt`/`submittedAt` (first = login proxy, last = logout proxy).
- `AuditLog` (`:819`) login events if recorded. `User` (`:123`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Date | `date` | date | center | |
| Login | `firstActivity` | time | center | |
| Logout | `lastActivity` | time | center | |
| Working Hours | `workingHours` | number | right | ✓ |
| Visits | `visits` | number | right | ✓ |
| Status | `status` | badge | center | |

`status` ∈ {Present, Absent, Partial} from working-hours threshold (`AppSetting`).

## 4. KPI cards
Present today · avg working hours · absent count.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/agent-attendance?from&to&branchId?&agentId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/agent-attendance.ts`)
Per agent per day (scoped): min/max activity timestamp → hours; visits = entries; status by threshold from
`getSetting(tenantId,'report_present_min_hours','4')`.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `agent-attendance-<from>-to-<to>`.

## 9. i18n keys
`reports.agentAttendance.title`, `reports.col.login|logout|workingHours`, `reports.attend.present|absent|partial`.

## 10. RBAC + subscription
Supervisor/admin. GPS-derived → gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Derived from existing timestamps. No writes, no new columns. Threshold from `AppSetting`.

## 12. No-hardcode checklist
- [ ] Present-hours threshold from `AppSetting`. Labels from i18n.

## 13. Test plan
Seed agent entries across a day → assert first/last + hours; absent day shows Absent; export matches.
