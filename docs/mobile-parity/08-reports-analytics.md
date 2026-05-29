# 08 · Reports, Analytics & Tracking

## Web scope
- **Reports:** daily collection, overdue, agent reports (`reports/agents`), exports.
- **Analytics:** dashboards (collections, agents, trends) with i18n via dict.
- **Route tracker:** live agent GPS map.

## Mobile current
- `reports/reports_screen.dart` (~576), `analytics/analytics_screen.dart` (~458), `admin/tracking/agent_tracking_screen.dart`.
- v1: `reports/daily`, `reports/overdue`, `reports/agent`; `analytics/summary`, `analytics/collections`, `analytics/agents`; `gps/live`, `gps/agent/[id]`, `gps/history/[id]`, `gps/ping`.

## Gaps (verify) 🔢
1. 🔢 Ensure **all analytics/report numbers come from the v1 endpoints** (no client aggregation). Audit `analytics_screen.dart` + `reports_screen.dart` for any client-side math.
2. 🟡 Export (CSV/PDF) from mobile.
3. 🟡 Report parity: confirm mobile has daily + overdue + agent reports with same columns/filters.
4. 🟡 Route tracker: live map parity with web (markers, last-ping, geofence).

## API needed
- Likely already covered by existing v1 report/analytics endpoints; add `export` variants if missing.

## Acceptance
- Every chart/total equals web for the same filters; exports available.

> **Needs line-by-line verification** of analytics/reports screens for client-side math (calc-parity).
