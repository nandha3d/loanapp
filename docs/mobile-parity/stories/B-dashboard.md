# B — Dashboard Polish (mobile)

**Priority:** P2 · **Persona:** Admin / Agent. · 🔢 all numbers from `/api/v1/dashboard`.

## Stories
- **B3** Collection trend with **range filter**.
- **B4** Defaulter alerts + route performance + recent activity cards.
- **B5** Agent greeting + my-customers + hit-rate + today-pending.

## Verified facts
- Endpoint: `app/api/v1/dashboard/route.ts` (and `analytics/collections` for trend). Mobile: `mobile/lib/features/dashboard/dashboard_screen.dart`. Today/Overdue swipable cards already shipped.
- i18n already added (done): `dashboard.goodMorning/goodAfternoon/todayCollection/hitRate/myCustomers/last7Days/recentCollections/pendingToday/monthRate`.
- Web ref: `app/(dashboard)/[module]/dashboard/**` + `agent-dashboard/page.tsx`.

## Implementation
1. **B3:** trend widget accepts a range (7/30/90d); call `analytics/collections?range=` (add param server-side if absent). Render with `fl_chart` (already a dep).
2. **B4:** add cards reading `dashboard` payload — defaulter alerts list, route performance rows, recent activity. If a field is missing from `/api/v1/dashboard`, extend it server-side (additive).
3. **B5:** agent view — greeting (time-based, use i18n), my-customers count, hit-rate, today-pending; all from `/api/v1/dashboard` (agent-scoped) — do not compute hit-rate in Dart.

## Acceptance criteria
- [ ] Trend range filter round-trips to API.
- [ ] Alerts/performance/activity match web for same tenant.
- [ ] Agent metrics from API; greeting localised in 6 langs.
- [ ] No Dart-side aggregation.

## Files touched
- `mobile/lib/features/dashboard/dashboard_screen.dart`.
- `app/api/v1/dashboard/route.ts`, `analytics/collections/route.ts` (additive only).
- i18n already present.
