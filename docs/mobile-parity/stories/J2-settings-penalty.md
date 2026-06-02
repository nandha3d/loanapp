# J2 — Settings: Penalty Config (mobile)

**Priority:** P1 · **Persona:** Admin. · **No new endpoint** (reuse `/api/v1/settings`).

## Story
As an **admin**, I want to set penalty rules (per-day amount, grace period, max cap) on mobile.

## Verified facts
- appSetting keys (defaults seeded at registration, see `app/api/v1/auth/register/route.ts`): `default_penalty_per_day`="50", `penalty_grace_period`="0", `penalty_max_cap`="0".
- Web tab: `app/(dashboard)/[module]/settings/SettingsClient.tsx` `activeTab==='penalty'`.
- API: `GET/POST /api/v1/settings` (generic) — `settingsService.all()` / `.save(patch)`.

## Implementation
1. Add a "Penalty" section to `mobile/lib/features/settings/settings_screen.dart` (or a sub-screen `penalty_settings_screen.dart`), admin-gated.
2. Load via `settingsService.all()` → map keys; prefill 3 numeric `TextField`s with defaults when absent.
3. Save: `settingsService.save({'default_penalty_per_day':…, 'penalty_grace_period':…, 'penalty_max_cap':…})`.
4. Penalty *amounts/accrual* remain API-computed; this only stores config.

## i18n
`set.penalty`="Penalty Settings" · `set.penalty_per_day`="Penalty per day" · `set.grace_period`="Grace period (days)" · `set.max_cap`="Maximum cap (0 = none)" · `set.penalty_saved`="Penalty settings saved".

## Acceptance criteria
- [ ] Values persist; reopening shows saved values.
- [ ] Numeric validation (≥0).
- [ ] Hidden for agents.

## Files touched
- `mobile/lib/features/settings/settings_screen.dart` (+ optional sub-screen).
- `app_strings.dart`.
