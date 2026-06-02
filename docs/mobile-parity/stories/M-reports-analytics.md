# M — Reports & Analytics (mobile)

**Priority:** P2 · **Persona:** Admin. · 🔢 calc-parity sensitive.

## Stories
- **M1** Daily / agent / overdue reports.
- **M2** Analytics dashboards (efficiency, portfolio, recovery, trend).

## Verified facts
- Endpoints exist: `app/api/v1/reports/{daily,agent,overdue}/route.ts`, `app/api/v1/analytics/{summary,collections,agents}/route.ts`.
- Mobile: `reports_screen.dart`, `analytics_screen.dart` (present, partial). 🔢 risk = any chart number must come from these endpoints, not recomputed.
- Web ref: `app/(dashboard)/[module]/reports/**`, `app/(dashboard)/[module]/analytics/page.tsx`.

## Implementation
1. **Audit each mobile screen** vs the web page: list every metric/column the web shows; ensure the v1 endpoint returns it; if missing, **extend the endpoint** (additive) rather than compute in Dart.
2. **Reports:** add agent report + overdue report views if absent; date-range filters that call the endpoint with params.
3. **Analytics:** render efficiency/portfolio/recovery/trend from `analytics/*`. If web shows a metric the endpoint lacks, add it server-side.
4. **Export:** if web offers CSV/PDF export, add a Bearer export endpoint and a download button (use `printing`/share like the receipt PDF pattern).

## Acceptance criteria
- [ ] Every web metric present on mobile with identical values (diff-tested).
- [ ] No Dart-side aggregation.
- [ ] Filters round-trip to API.

## Files touched
- `mobile/lib/features/reports/reports_screen.dart`, `analytics/analytics_screen.dart`.
- `app/api/v1/reports/**`, `analytics/**` (additive only).
- `app_strings.dart`.
