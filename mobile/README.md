# LoanTrack Mobile (Flutter)

Native Android + iOS client for the LoanTrack microlending / chit fund platform. Built per `../LoanTrack_Flutter_Project.md` (spec) and `../design.md` (visual tokens).

## Status

**Sprints 1–2 shipped.** Auth (login + TOTP + biometric) + dashboard with live KPIs + customers (list + detail + multi-step new-customer form with photo + KYC upload). Remaining: loans, collection, penalties, approvals, analytics, chits, reports, settings — placeholder stubs that route correctly. Build them per the spec's sprint plan.

## Prerequisites

1. Install Flutter SDK 3.22+ — https://docs.flutter.dev/get-started/install
2. Run `flutter doctor` and resolve any platform issues (Android Studio / Xcode toolchains).
3. Start the Next.js backend (`npm run dev` from repo root) so the `/api/v1/auth/*` endpoints are reachable.

## First-time setup

This repo has the `mobile/ios` and `mobile/android` directories generated using:
- **Bundle ID / Application ID**: `com.loantrack.app` (standardized across Android and iOS)
- **App Display Name**: `LoanTrack`
- **iOS Deployment Target**: `15.0`

If you ever need to regenerate the native folders (preserving your existing `lib/` and `pubspec.yaml`), run:

```powershell
# 1) Generate native folders
flutter create . --project-name loantrack --org com.loantrack --platforms=android,ios

# 2) Install dependencies
flutter pub get
```

## Run

### Android Emulator & iOS Simulator
The Android emulator reaches the host machine at `10.0.2.2`. The iOS simulator reaches the host at `localhost`. Pass the base API URL at build time:

```powershell
# Android emulator
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1

# iOS simulator
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

### Real iOS Devices
Note that `localhost` is **not reachable** on a real iPhone. When testing on a real iPhone 16, you must:
1. Make sure your server and iPhone are on the same local Wi-Fi network and use the host computer's local IP address (e.g. `http://192.168.1.100:3000/api/v1`), OR
2. Expose the Next.js server using an HTTPS tunnel (e.g., using `ngrok http 3000` or `localtunnel`), OR
3. Point to production at `https://app.animazon.in/api/v1`.

Build/run command for real device:
```powershell
flutter run --dart-define=API_BASE_URL=https://app.animazon.in/api/v1
```

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
flutter build apk --release          # Android release; defaults to app.animazon.in
flutter build ios --release          # iOS release (macOS only)
```

## iOS Testing & Code Signing (No Paid Apple Developer Account)

Since you don't have a paid developer account ($99/year), you cannot deploy to TestFlight. However, you can still test on a real physical iPhone 16 using a **Free Personal Apple ID**:

### Option 1: Local Signing and Deployment (Requires a Mac)
1. Copy the `mobile/` directory to a Mac.
2. Open the iOS workspace in Xcode:
   ```bash
   open ios/Runner.xcworkspace
   ```
3. In the left sidebar, click on **Runner** (top project node).
4. Go to the **Signing & Capabilities** tab.
5. Check **Automatically manage signing**.
6. Under **Team**, sign in with your personal Apple ID (this creates a "Personal Team").
7. Connect your iPhone 16 to the Mac via USB.
8. Select your iPhone as the run destination in the top toolbar (instead of a simulator).
9. Click the **Run** button (Play icon) or press `Cmd + R` to build and install.
10. **On your iPhone 16**: Go to **Settings > General > VPN & Device Management**, tap your Apple ID under "Developer App", and tap **Trust**.
11. Turn on **Developer Mode** on your iPhone 16 (Settings > Privacy & Security > Developer Mode).

*Note: Free personal provisioning profiles expire after 7 days, after which you will need to re-run the app from Xcode to refresh it.*

### Option 2: Cloud Builds on Codemagic (Windows/No Mac required)
We have added [codemagic.yaml](file:///v:/pers/Freelance/loanapp/mobile/codemagic.yaml) to build the iOS app in the cloud.
- To verify compilation: Connect your Git repository to Codemagic and trigger a build. It will verify that your iOS project, CocoaPods, and all Flutter plugins compile successfully.
- Codemagic builds are set to produce an **Unsigned iOS Simulator App** (`.app` file) that can be run on Xcode Simulators, which does not require a paid developer membership or signing keys.
