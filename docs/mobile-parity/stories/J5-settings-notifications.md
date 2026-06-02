# J5 — Settings: Notification Toggles (mobile)

**Priority:** P1 · **Persona:** Admin. · Reuses `/api/v1/settings`.

## Story
As an **admin**, I want to toggle automated SMS/WhatsApp notifications and reach the notification audit log.

## Verified facts
- Web tab `activeTab==='notifications'` in `SettingsClient.tsx`. Strings already translated under `settings.notifications*` (web) — for mobile add `set.notif_*` keys.
- appSetting key(s): read the web notifications form `name=` attrs for exact keys (e.g. `notifications_enabled`, channel-specific). **Open `SettingsClient.tsx` notifications tab and copy the exact keys** — do not guess names.
- Notification log: web `notifications/log`. Mobile has `notifications_screen.dart` (list only). Audit log endpoint: check `app/api/v1/notifications/route.ts` for a `?log=1`/separate path; if none, add a Bearer route to return the audit/log rows.

## Implementation
1. Sub-screen `notification_settings_screen.dart`, admin-gated.
2. Master Switch (enable automated notifications) + per-channel switches per web keys.
3. Save via `settingsService.save({...})`.
4. "View notification logs" link → `/notifications/log` mobile screen (new) backed by the log endpoint.

## i18n
`set.notifications`="Notifications" · `set.notif_enable`="Enable automated notifications" · `set.notif_logs`="View notification logs" · `set.notif_saved`="Notification settings saved".

## Acceptance criteria
- [ ] Exact appSetting keys match web (verified by reading the tab).
- [ ] Toggles persist.
- [ ] Log screen lists sent/failed/pending.

## Files touched
- NEW `mobile/lib/features/settings/notification_settings_screen.dart` (+ optional `notifications/log` screen) + routes.
- *(if no log endpoint)* `app/api/v1/notifications/log/route.ts`.
- `app_strings.dart`.
