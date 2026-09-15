# Audit 02 — Hard-coded Values (Credentials, Hosts, Currency, Business Numbers)

> Status: **NOT IMPLEMENTED** (audit only). Audited 2026-07-17 @ `52add51`. Scanned `{app,lib,components}/**/*.{ts,tsx}`, `mobile/lib/**/*.dart`, excluding node_modules/docs/tests (test hits noted where relevant).

## A. Credentials / secrets — FIX REQUIRED

### A1. JWT signing falls back to a literal `'fallback-secret'` — HIGH
- `lib/genericProfile.ts:28` and `lib/profile.ts:25`:
  ```ts
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret';
  ```
  If the env vars are ever missing (fresh box, botched deploy), tokens are signed with a public constant — trivially forgeable. `lib/borrowerAuth.ts` already does the right thing (throws when unset).
- **Fix:** remove the fallback; throw with a clear message, matching `borrowerAuth.ts`.

### A2. Bootstrap script hard-codes superadmin password — MEDIUM
- `create-superadmin.js:13` — `bcrypt.hash('super123', 12)`.
- **Fix:** require `SUPERADMIN_PASSWORD` env (fail without it). Operational follow-up: if `super123` was ever used on the live box, change that account's password.

### A3. Previously found & already removed (context)
- `public/test_db.php` exposed the production MySQL password publicly — deleted @ `52add51`. **Operator action still open: rotate the DB password** (it remains in public git history).
- No other live API keys/tokens found in `lib/`, `app/`, `public/`, `scripts/`.

## B. Money-routing fallback — FIX REQUIRED

### B1. Default UPI VPA `'zolofund@ybl'` — HIGH (payments misroute)
- `app/borrower/dashboard/BorrowerDashboardClient.tsx:1829` — `paymentSettings?.upiId || 'zolofund@ybl'`. A tenant that never configured UPI shows borrowers a QR that pays a **placeholder VPA** — real money to the wrong account.
- **Fix:** no fallback — when the tenant has no `upiId`, hide the QR block and show "Online payment not configured — contact your branch."

## C. Hard-coded hosts / URLs

| Where | Value | Assessment |
|---|---|---|
| `mobile/lib/core/network/dio_client.dart:16` | `https://app.animazon.in/api/v1` | Acceptable — it is the compile-time **fallback** for `--dart-define=API_BASE_URL` (CI passes the real value); keep, but document. |
| `app/(dashboard)/[module]/affiliate/AffiliateClient.tsx:78`, `app/affiliate/AffiliateLandingClient.tsx:65` | `https://loantrack.co/r/${code}` | **Fix:** referral base should be an AppSetting (`referral_base_url`) with this as default. |
| `lib/sms.ts:3`, `lib/notify/channels/{sms,whatsapp}.ts` | msg91 API base | Acceptable vendor constant. |
| `lib/razorpay.ts:66,112`, `lib/nach.ts:78,89` | razorpay API base | Acceptable vendor constant. |
| `lib/bureau/providers/{crif,cibil}.ts` | bureau sandbox/prod URLs | Acceptable (env-gated switch exists). |
| `route-tracker/LiveMapClient.tsx:27`, `WebPushManager.tsx:63`, `firebase-messaging-sw.js/route.ts:26` | unpkg / gstatic CDNs | Acceptable (third-party SDK loads); note: unpkg Leaflet could be self-hosted later for CSP tightening. |
| `lib/cors.ts`, `lib/config.ts`, `lib/api-client/index.ts`, `borrower/logout`, `cron/send-reports` | `localhost` dev fallbacks | Acceptable. |

## D. Hard-coded currency symbol `₹`

The tenant setting `currency_symbol` exists (`getSetting(tenantId,'currency_symbol','₹')` web, `currencyFmtProvider` mobile) but is bypassed in many places.

- **Web: 283 occurrences across 163 files.** Worst offenders:
  - `lib/notify/events.ts` — 29 (all outbound notification templates)
  - `lib/sms.ts` — 18 (SMS templates)
  - `lib/chits/winnerSummary.ts` — 7 (`₹${…toLocaleString('en-IN')}` in auction result text)
  - `app/borrower/dashboard/BorrowerDashboardClient.tsx` — 7 (incl. hard-coded `₹5,000`/`₹2,00,000` slider labels)
  - `app/register/page.tsx` 6, `lib/affiliate.ts` 6, `lib/gold/liveRate.ts` 4
- **Mobile: 80 occurrences across 23 files.** Worst: `chit_live_auction_screen.dart` 10, `accounting_screen.dart` 8, `new_loan_screen.dart` 5, `loan_detail_screen.dart` 4. (`currency_controller.dart`'s own 5 are the formatter — expected.)
- **Fix scope (phase 1):** thread `currencySymbol` through the shared helpers (`winnerSummary.ts`, `notify/events.ts`, `sms.ts` — all already receive/know tenantId) and the chit + borrower surfaces on both platforms (aligned with the i18n pass in doc 04). Remaining occurrences tracked as a mechanical follow-up.

## E. Hard-coded business numbers

- `lib/plans.ts:22-56` — per-plan `gracePeriodDays` (`999999`/3/7/14/30) and `trialDays` in code. Plan-catalog constants; acceptable, but flag: changing policy requires a deploy.
- `BorrowerDashboardClient.tsx:1392-1414` — loan calculator slider limits `min=5000 max=200000`, tenure 5–30: should become per-tenant loan-policy settings (follow-up; cosmetic until then).
- Penalty/interest/NPA calculators (`lib/penalties.ts`, `lib/npa/provisioningCalculator.ts`, `lib/foreclosure.ts`): **clean** — rates come from config/policy, the literals found are accumulator initializers.
- No cuid-shaped ids, phones, or emails embedded in business logic (placeholders/tests only).

## Implementation checklist

1. Remove `'fallback-secret'` (2 files) — throw like `borrowerAuth.ts`.
2. Remove `'zolofund@ybl'` fallback — hide QR + message when unset.
3. `create-superadmin.js` → require env password.
4. `referral_base_url` AppSetting for the 2 affiliate components.
5. Currency threading: `winnerSummary.ts`, `notify/events.ts`, `sms.ts`, chit+borrower surfaces (with doc 04).
6. (Follow-up backlog) remaining ₹ occurrences; calculator limits → settings.

## Verification

- Boot with `NEXTAUTH_SECRET`/`AUTH_SECRET` unset → profile-token endpoints fail loudly (500 with clear message), not silently signed.
- Tenant without `upiId` → borrower Pay tab shows the not-configured notice, no QR rendered.
- Tenant with `currency_symbol='$'` → winner summary text, notification templates, chit screens all render `$`.
