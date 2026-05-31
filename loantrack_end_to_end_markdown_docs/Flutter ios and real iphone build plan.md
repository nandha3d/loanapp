# Flutter iOS Project + Real iPhone Build Plan

## Summary
- Add the missing Flutter `ios/` project files under `mobile/` using the existing Flutter app as the source of truth.
- Configure iOS identity, icons, permissions, and production API connectivity.
- Use cloud macOS CI, preferably Codemagic, to build a signed iOS app for your iPhone 16 because Windows cannot run Xcode or produce signed iOS builds locally.

## Key Changes
- Generate `mobile/ios/` with:
  - App display name: `LoanTrack`
  - Bundle ID default: `com.loantrack.mobile`
  - iOS deployment target: `13.0` or newer, unless Flutter/plugin constraints require higher.
- Add iOS app icons from existing brand asset [public/assets/logo.svg](/V:/pers/Freelance/loanapp/public/assets/logo.svg), converted into required iOS icon sizes.
- Configure iOS permissions in `Info.plist` for current mobile features:
  - Face ID / biometrics
  - Location while using the app
  - Camera and photo library for customer/KYC uploads
  - Notifications if Firebase Messaging is enabled
  - HTTPS-only network access, with no broad insecure HTTP allowance for production.
- Keep the current `API_BASE_URL` build-time config and require iOS builds to pass:
  ```bash
  --dart-define=API_BASE_URL=https://YOUR_PRODUCTION_DOMAIN/api/v1
  ```
- Update docs so real-device testing clearly says: `localhost` is invalid on iPhone; use production HTTPS or a temporary HTTPS tunnel.

## Build File Method
- Add a cloud build config, recommended: `mobile/codemagic.yaml`.
- Codemagic workflow:
  - Run `flutter pub get`
  - Run `flutter analyze`
  - Run `flutter test`
  - Build signed iOS IPA with:
    ```bash
    flutter build ipa --release --dart-define=API_BASE_URL=$API_BASE_URL
    ```
  - Upload to TestFlight through App Store Connect.
- Required Codemagic/App Store secrets:
  - `API_BASE_URL`
  - Apple Developer Team ID
  - App Store Connect API key / issuer ID / key ID
  - iOS signing certificate and provisioning profile, or Codemagic automatic signing access.
- Primary install route: TestFlight on your iPhone 16. This requires a paid Apple Developer account.
- Fallback route: Ad Hoc IPA for your iPhone 16, requiring your device UDID registered in Apple Developer and an Ad Hoc provisioning profile.

## Test Plan
- Local Windows checks:
  - `flutter pub get`
  - `flutter analyze`
  - `flutter test`
- Cloud macOS checks:
  - Verify `ios/` project opens/builds on Codemagic.
  - Verify signed IPA is produced.
  - Verify TestFlight upload succeeds.
- Real iPhone 16 acceptance:
  - App installs from TestFlight.
  - Login works against production HTTPS backend.
  - Auth token is stored securely.
  - Dashboard/customer API calls reach `/api/v1`.
  - Camera/photo upload permission prompts appear correctly.
  - Location permission prompt appears correctly where GPS features are used.

## Assumptions
- You will use TestFlight first for iPhone 16 testing.
- You either have, or will create, a paid Apple Developer account.
- The production backend will be available over HTTPS at `https://YOUR_PRODUCTION_DOMAIN/api/v1`.
- Firebase push notifications can be configured later if `GoogleService-Info.plist` is not ready yet.
