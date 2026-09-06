# 07 — Surpass Every Parity / Lead Element (P2)

## Objective
For every element where we're already at parity or ahead, add a concrete "pull decisively ahead" increment, so the
final scorecard is **✅ on every row** — not just "not behind". Each item is additive and config-driven.

## Vasool benchmark (parity items)
GPS/route tracking, reports/analytics (9 types), notifications, biometric login, multi-language (6), audit, RBAC,
custom branding. We already match or lead; goal is unambiguous lead.

---

### A. GPS & Route — pull ahead
- **Now:** live map + trail + route progress (`app/(dashboard)/[module]/route-tracker/`, `app/api/gps/*`,
  mobile `gps_pinger.dart`).
- **Surpass:** geofence + idle/route-deviation alerts. Define geofence radius per customer/branch in `AppSetting`
  (`gps_geofence_radius_m`), flag collections outside it (we already capture address-match — extend to alerting).
  Idle-time alert when an agent is stationary beyond `gps_idle_minutes`. Alerts via existing notification pipeline.
- **No-hardcode:** radii/thresholds in `AppSetting`. **Additive.**

### B. Reports & Analytics — pull ahead
- **Now:** daily collection, overdue, agent performance, trend, payment-mode, route tables; CSV/PDF.
- **Surpass:** (1) **scheduled report delivery** (reuse `app/api/cron/send-reports`) emailed per tenant config;
  (2) **AI narrative summary** of the day's collections/risk using Claude (`claude-opus-4-8` via Anthropic API) —
  model id + key from `.env`, prompt template config-driven; degrade gracefully if key absent.
- **No-hardcode:** schedule + recipients in `AppSetting`; model id/key in `.env`. **Additive.**

### C. Notifications — pull ahead
- **Now:** SMS + WhatsApp + push, 8 event types, per-type toggle.
- **Surpass:** delivery receipts / read status surfaced in `notifications/log`, and **editable message templates**
  per tenant/language stored in DB (not inline), with variable placeholders. Vasool's notif depth is unclear — make
  ours visibly configurable.
- **No-hardcode:** templates in a `NotificationTemplate` table (Additive) keyed by event+lang. **Additive.**

### D. Biometric login — pull ahead
- **Now:** fingerprint/face on mobile.
- **Surpass:** device-binding (register trusted device, alert on new-device login) + optional step-up biometric for
  cash-handover confirmation. Reuse existing auth + audit.
- **No-hardcode:** policy flags on `TenantSubscription`/`AppSetting`. **Additive.**

### E. Multi-language — pull ahead
- **Now:** 6 languages, per-tenant.
- **Surpass:** in-app instant language switch for agents (mobile already has `languageProvider`); ensure voice-entry
  (§01) + TTS (§voice_assist) honor it. Add a 7th language only via the existing dictionary pattern if a market needs it.
- **No-hardcode:** all strings already dictionary-driven. **Additive.**

### F. Borrower portal / anti-fraud / accounting / bureau / NPA — defend & deepen (already lead)
- Borrower portal: add push/WhatsApp deep-links to approve proofs faster.
- Anti-fraud QR: add expiry + single-use audit surfacing.
- Premium accounting: add aged-receivables already present (`lib/accounting/agedReceivables.ts`) to default dashboards.
- Bureau/NPA: keep these front-and-center in sales — Vasool offers neither. Add a one-click "credit decision" panel
  combining score + bureau + NPA history.
- **No-hardcode:** all thresholds/flags via existing config. **Additive.**

---

## i18n keys
Each item adds its own keys to `i18n/*` + `kStrings` (alerts, schedule labels, template editor, device-bind prompts).

## Scope / RBAC guards
All new reads/writes `appScope`-d and role-gated; cron jobs reuse `CRON_SECRET`.

## Feature-flag & rollout
Each increment behind an existing `TenantSubscription` flag or a new Additive boolean; ship independently.

## No-hardcode checklist
- [ ] Geofence radii, idle thresholds, report schedules, templates, AI model id — all in DB/`AppSetting`/`.env`.
- [ ] No new inline copy; everything i18n.

## Test plan
- Per item: unit on the threshold/template logic; integration that the alert/report/notification fires via existing
  pipelines; isolation tests unchanged.

## ⚠️ Structure Impact
**Additive.** New optional tables (`NotificationTemplate`) and nullable flags only. **Breaking:** none. Any new
table/column is itemized in its work item for sign-off before implementation.
