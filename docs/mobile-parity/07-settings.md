# 07 · Settings

## Web scope
Routes (CRUD), agents/users (CRUD), branding (logo, currency, prefixes), customer/loan code prefixes & counters, SMS/notification config, receipt PDF toggle, KYC method config, branches, language/dictionary.

## Mobile current
- `settings/settings_screen.dart` (~610 lines) + `settingsServiceProvider` (`routes()`, `createRoute()`, `createAgent()`, …).
- `GET /api/v1/settings` exists.

## Gaps (verify)
1. 🟡 Route management (create exists; edit/delete/assign?).
2. 🟡 Agent/user management (create exists; edit/deactivate/role?).
3. ❌ Branding / prefixes / currency edit.
4. ❌ SMS & receipt-PDF toggles.
5. ❌ KYC method configuration.
6. ❌ Branch management / switch (admin/superadmin).

## API needed
- `PATCH /api/v1/settings` for tenant settings (branding, prefixes, toggles).
- Route/user edit+delete endpoints under v1.

## Acceptance
- Admin can manage routes, agents and key tenant settings from mobile.

> **Needs line-by-line verification** of `settings_screen.dart`.
