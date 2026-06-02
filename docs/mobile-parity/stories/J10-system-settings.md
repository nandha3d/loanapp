# J10 — Developer "System Settings" (mobile)

**Priority:** P0 · **Status:** ❌ (this story) · **No new API endpoint needed.**
**Persona:** Developer (platform operator).

## Story
As a **developer**, I want a **System Settings** screen in the mobile app exposing the same fields as the web `system` tab, so I can configure tenant-wide system behaviour from mobile.

## Background facts (verified — do not re-derive)
- **Web reference:** `app/(dashboard)/[module]/settings/SettingsClient.tsx:208-300`. The `system` tab is rendered **only when `currentUser.role === 'developer'`**. Fields + appSetting keys + defaults:
  | Field | key | default | control |
  |---|---|---|---|
  | App Name | `app_name` | `LoanTrack` | text |
  | Currency | `currency` | `INR` | text |
  | Currency Symbol | `currency_symbol` | `₹` | text |
  | Timezone | `timezone` | `Asia/Kolkata` | select: `Asia/Kolkata`, `UTC` |
  | Midnight Cutoff | `midnight_cutoff` | `true` | select: `true`/`false` (Enabled/Disabled) |
  | Allow Weekend Collection | `allow_weekend_collection` | `false` | select: `true`/`false` (Yes/No) |
  | KYC Method | `kyc_method` | `manual_upload` | select: `manual_upload`,`aadhaar_otp`,`video_kyc`,`both` — **disabled unless `subscription.kycEnabled`** |
  | Loan prefix (daily) | `loan_prefix_daily` | `DL` | text, maxLen 4 |
  | Loan prefix (weekly) | `loan_prefix_weekly` | `WK` | text, maxLen 4 |
  | Loan prefix (bi-weekly) | `loan_prefix_biweekly` | `BW` | text, maxLen 4 |
  | Loan prefix (monthly) | `loan_prefix_monthly` | `ML` | text, maxLen 4 |
- **API (already exists, no change):** `app/api/v1/settings/route.ts`.
  - `GET /api/v1/settings` → `ok(appSetting[])` where each row is `{key, value, group, …}`. Role-gated to `admin|superadmin|developer`.
  - `POST /api/v1/settings` body `{ [key]: value }` → calls `setSetting(tenantId, k, String(v), 'mobile')` for each, writes audit, returns saved map. Role-gated same.
- **Mobile service (already exists):** `mobile/lib/data/services/settings_service.dart` — `all()` returns `List<Map<String,dynamic>>` of settings rows; `save(Map<String,dynamic> patch)` POSTs the patch. **Reuse both — no service changes needed.**
- **Endpoint constant:** `Endpoints.settings = '/settings'` (already defined).
- **Role check:** `ref.watch(authControllerProvider).user?.role == UserRole.developer` (`mobile/lib/data/models/user.dart`).
- **KYC subscription flag:** to disable the KYC select you need `subscription.kycEnabled`. If a mobile subscription/me payload doesn't expose it, render the KYC select **enabled** but on save let the server be source of truth; OR add `kycEnabled` to `/api/v1/auth/me` response and the mobile `User` model. Simplest v1: always enabled; note in code `// TODO gate on subscription.kycEnabled when exposed`.

## 1. Screen file
Create `mobile/lib/features/settings/system_settings_screen.dart` — `ConsumerStatefulWidget` `SystemSettingsScreen`.

### Load
- `FutureProvider.autoDispose` calling `ref.read(settingsServiceProvider).all()`.
- On data: build a `Map<String,String>` keyed by `row['key']` → `row['value']?.toString() ?? ''`. Seed `TextEditingController`s and dropdown values from this map, falling back to the defaults in the table above when absent.

### Controllers / state
- Text controllers: `_appName, _currency, _currencySymbol, _prefixDaily, _prefixWeekly, _prefixBiweekly, _prefixMonthly`.
- Dropdown state: `String _timezone, _midnightCutoff, _allowWeekend, _kycMethod`.

### UI
- `Scaffold` + AppBar `t.x('sys.title')`, back to `/settings`.
- Reuse the `_LabeledField`/`AppTextField` + a bordered dropdown (copy `_AppDropdown` pattern from `new_customer_screen.dart`).
- Loan-prefix fields in a 2-col grid, `maxLength: 4`.
- Bottom **Save** `FilledButton` (loading state).

### Save
```dart
await ref.read(settingsServiceProvider).save({
  'app_name': _appName.text.trim(),
  'currency': _currency.text.trim(),
  'currency_symbol': _currencySymbol.text.trim(),
  'timezone': _timezone,
  'midnight_cutoff': _midnightCutoff,
  'allow_weekend_collection': _allowWeekend,
  'kyc_method': _kycMethod,
  'loan_prefix_daily': _prefixDaily.text.trim(),
  'loan_prefix_weekly': _prefixWeekly.text.trim(),
  'loan_prefix_biweekly': _prefixBiweekly.text.trim(),
  'loan_prefix_monthly': _prefixMonthly.text.trim(),
});
```
Show success snackbar `t.x('sys.saved')`; pop or stay.

## 2. Routing
- `app_router.dart`: add `GoRoute(path: '/settings/system', builder: (_, __) => const SystemSettingsScreen())`.
- It is under the admin/superadmin/developer exemption already, but **additionally guard the entry point** (see §3) so only developers see it.

## 3. Entry point (developer-gated)
In `mobile/lib/features/settings/settings_screen.dart`, in the "Account"/admin area add a `ListTile` **only when** `user?.role == UserRole.developer`:
```dart
if (user?.role == UserRole.developer)
  ListTile(
    leading: const Icon(Icons.tune, color: AppColors.primary),
    title: Text(t.x('sys.title')),
    subtitle: Text(t.x('sys.subtitle')),
    trailing: const Icon(Icons.chevron_right),
    onTap: () => context.push('/settings/system'),
  ),
```
(`user = ref.watch(authControllerProvider).user`.)

## 4. i18n keys (app_strings.dart, 6 langs)
`sys.title`="System Settings" · `sys.subtitle`="App name, currency, timezone, KYC method, loan prefixes" · `sys.saved`="System settings saved" · `sys.app_name`="App Name" · `sys.currency`="Currency" · `sys.currency_symbol`="Currency Symbol" · `sys.timezone`="Timezone" · `sys.midnight_cutoff`="Midnight Cutoff" · `sys.allow_weekend`="Allow Weekend Collection" · `sys.kyc_method`="KYC Method" · `sys.loan_prefixes`="Loan Code Prefixes" · `sys.prefix_daily`="Daily" · `sys.prefix_weekly`="Weekly" · `sys.prefix_biweekly`="Bi-weekly" · `sys.prefix_monthly`="Monthly" · `common.enabled`/`common.disabled`/`common.yes`/`common.no` (reuse if present). KYC method option labels can reuse `settings.kycManualUpload` etc. — but those live in the **web** dict; for mobile add `sys.kyc_manual`,`sys.kyc_aadhaar`,`sys.kyc_video`,`sys.kyc_both`.

## 5. Acceptance criteria
- [ ] Tile visible only to `developer` role; hidden for admin/agent/superadmin.
- [ ] Screen pre-fills from `/api/v1/settings`; missing keys show defaults.
- [ ] Save POSTs only these keys; other settings untouched; audit row written (server does it).
- [ ] Re-open screen → values persisted.
- [ ] `flutter analyze` clean.

## 6. Files touched
- NEW `mobile/lib/features/settings/system_settings_screen.dart`.
- `mobile/lib/core/router/app_router.dart` (+route).
- `mobile/lib/features/settings/settings_screen.dart` (+developer tile).
- `mobile/lib/core/l10n/app_strings.dart` (~18 keys × 6 langs).
- *(optional)* `app/api/v1/auth/me/route.ts` + mobile `User` model if exposing `kycEnabled`.
