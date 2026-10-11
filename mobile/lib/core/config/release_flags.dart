/// Build-time switches for the Google Play release.
///
/// `flutter build appbundle --dart-define=PLAY_RELEASE=true` produces the
/// Play Store build. Without the define every build behaves exactly as before
/// (sideloaded APK, dev runs) — nothing here changes default behaviour.
///
/// What the Play build turns off (Google Play policy reasons):
/// - Borrower login/portal — keeps the app staff-only so it is not a consumer
///   "personal loan" app (Financial Services policy, India DLA rules).
/// - Lending verticals other than [kPlayVerticals] — v1 ships micro-lending only.
/// - In-app sign-up, plan prices, upgrade/subscription screens and links to web
///   checkout — SaaS subscriptions sold in-app must use Play Billing (Payments
///   policy), so the Play build is consumption-only.
/// - Background location ("Allow all the time") — tracking is foreground-only.
/// - The server-configuration gear on the login screen.
library;

/// True only for the Google Play build.
const bool kPlayRelease = bool.fromEnvironment('PLAY_RELEASE');

/// Lending verticals (AppType values) available in the Play build.
const Set<String> kPlayVerticals = {'microlending'};
