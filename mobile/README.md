# LoanTrack Mobile (Flutter)

Native Android + iOS client for the LoanTrack microlending / chit fund platform. Built per `../LoanTrack_Flutter_Project.md` (spec) and `../design.md` (visual tokens).

## Status

**Sprints 1–2 shipped.** Auth (login + TOTP + biometric) + dashboard with live KPIs + customers (list + detail + multi-step new-customer form with photo + KYC upload). Remaining: loans, collection, penalties, approvals, analytics, chits, reports, settings — placeholder stubs that route correctly. Build them per the spec's sprint plan.

## Prerequisites

1. Install Flutter SDK 3.22+ — https://docs.flutter.dev/get-started/install
2. Run `flutter doctor` and resolve any platform issues (Android Studio / Xcode toolchains).
3. Start the Next.js backend (`npm run dev` from repo root) so the `/api/v1/auth/*` endpoints are reachable.

## First-time setup

This repo ships **only the `lib/` source tree**. The native platform folders (`android/`, `ios/`, `linux/`, etc.) are generated locally so you control the package name, signing config, and Flutter-version artefacts.

From this directory:

```powershell
# 1) Generate native folders (preserves existing lib/ and pubspec.yaml)
flutter create . --project-name loantrack --org com.loantrack --platforms=android,ios

# 2) Install dependencies
flutter pub get
```

> If `flutter create` complains about an existing project, run it anyway — it merges new platform files without overwriting `lib/` or `pubspec.yaml`.

## Run

The Android emulator reaches the host machine at `10.0.2.2`. iOS simulator uses `localhost`. Pass the API base URL at build time:

```powershell
# Android emulator
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1

# iOS simulator
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

`API_BASE_URL` defaults to `http://10.0.2.2:3000/api/v1` (see `lib/core/network/dio_client.dart`).

## Backend env vars

Add to the Next.js `.env`:

```
MOBILE_JWT_SECRET=<a long random string — falls back to NEXTAUTH_SECRET if unset>
PII_ENCRYPTION_KEY=<required by lib/pii.ts for customer aadhar encryption>
```

`PII_ENCRYPTION_KEY` must be either a 64-character hex string, a 32-byte UTF-8 string, or any string (which gets SHA-256'd). Web app already requires this — same env.

The mobile app authenticates with a stateless HS256 JWT issued by `/api/v1/auth/login`. The web app still uses NextAuth sessions; the two mechanisms are independent.

## Auth flow

1. `POST /api/v1/auth/login` with `{username, password}` → returns either `{token, user}` or `{requiresTotp: true}`.
2. If TOTP required, `POST /api/v1/auth/2fa` with `{username, code}` → returns `{token, user}`.
3. Subsequent calls include `Authorization: Bearer <token>` + `X-Tenant-Slug` + `X-Branch-Id` headers (handled by `dio_client.dart`).
4. Any `401` triggers automatic logout (spec §9.3 rule 6).

## Project structure

```
lib/
├── core/
│   ├── auth/           ← AuthController (StateNotifier), AuthStorage (secure)
│   ├── network/        ← Dio + interceptors + 401 broadcast
│   ├── router/         ← GoRouter with redirect guards + module gates
│   └── theme/          ← Color, typography, token files (verbatim from design.md)
├── data/
│   ├── models/         ← User / Customer / Loan / Instalment (plain immutable + fromJson)
│   ├── services/       ← AuthService (Dio)
│   └── repositories/   ← AuthRepository
├── features/
│   ├── auth/           ← login / totp / biometric lock screens
│   ├── dashboard/      ← real (placeholder data)
│   └── {customers,loans,collection,approvals,analytics,chits,settings}/  ← stubs
└── shared/
    ├── widgets/        ← AppButton, AppBadge, AppTextField, BottomNav, EmptyState, StubScreen
    └── constants/      ← endpoints.dart — all spec §2.4 paths
```

## Deviations from the spec

These are conscious choices that differ from `LoanTrack_Flutter_Project.md`. Confirmed with the user.

1. **Package versions = latest stable** as of 2026-05, not the version ranges pinned in spec §2.1.
2. **No freezed / no Retrofit / no build_runner.** Models are hand-written immutable Dart classes with `fromJson`. `AuthService` calls Dio directly. Saves a codegen step at the cost of slightly more boilerplate — easy to migrate later if needed.
3. **Sprint 1 scope only.** Customers / loans / collection / approvals / analytics / chits / settings show stubs. The `/api/v1/*` wrappers for those modules are also deferred — only the auth endpoints exist server-side.
4. **No `lib/api/v1/*` for non-auth endpoints yet.** Build them per the spec sprint plan as those modules are implemented.

## Next sprints (per spec §8)

| Sprint | Focus | Add in `mobile/lib/` |
|---|---|---|
| 2 | Dashboard real data + Customers | ✅ Done — `/dashboard`, customer list/detail, new-customer form |
| 3 | Loans | Loan list/detail + new loan wizard (design.md Screens 4 & 6) |
| 4 | Collection + offline queue | design.md Screen 5; Isar queue + `connectivity_plus` |
| 5 | Penalties + Approvals | design.md Screen 7 |
| 6 | Analytics + Reports | design.md Screen 8; `fl_chart`; `pdf` exports |
| 7 | Chit funds | conditional on `User.appType == 'chit'` |
| 8 | Settings + push + biometrics polish | `firebase_messaging` wiring |

Each sprint also adds the corresponding `/api/v1/*` wrappers server-side.

## Useful commands

```powershell
flutter pub get                      # install deps
flutter analyze                      # static analysis
flutter test                         # run unit tests (none yet — Sprint 9)
flutter build apk --release          # Android release
flutter build ios --release          # iOS release (macOS only)
```
