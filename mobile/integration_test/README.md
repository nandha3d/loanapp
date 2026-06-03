# Mobile E2E (integration_test)

Flutter's native E2E (Playwright can't drive Flutter). Mirrors the web suite.

## Prerequisites
- A running **device or emulator** (`flutter devices`).
- Backend running + seeded: from repo root `npm run db:seed && npm run start`.
- App must reach the backend — pass the host via `--dart-define`.

## Run
```bash
# Android emulator (10.0.2.2 = host loopback):
flutter test integration_test/app_test.dart \
  --dart-define=E2E_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=E2E_AGENT=karthik --dart-define=E2E_PASS=agent123

# Physical device / iOS: use your machine's LAN IP instead of 10.0.2.2.
```

## Test groups
- **MOB-AUTH (ui, offline)** — runs without a backend: login screen renders, fields/actions present, empty-submit guard.
- **MOB-FLOW (live)** — needs seeded backend: agent login, bottom-nav → Collection, post-login stability. Auto-`markTestSkipped` if backend unreachable (so the offline tests still pass in CI without a server).

## Notes
- Selectors use widget types (`TextField`, `AppButton`) + visible text (`Collection`, `Register Business`). Tune text finders if you change default language from English.
- For richer flows (collection entry, wallet release, GPS), extend `app_test.dart` — log in, then drive the same widgets the screens build.
- Native dialogs/permissions (GPS, biometric) need **Patrol** (`patrol`); `integration_test` alone can't tap OS-level prompts.
