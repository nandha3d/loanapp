# Phase 5 ZoloFund Business E2E Automation Plan

## Summary
Add Phase 5 API/service-level business automation under the existing `tests/e2e-business` harness. Keep all tests additive, use `TEST_DATABASE_URL` only, seed deterministic `RUN_ID` data, avoid demo data, mock or locally sign provider payloads, and record unsupported/current-code defects as known gaps in the shared evidence writer.

## Key Changes
- Extend the shared harness, not the app behavior:
  - Add route registry entries for cron, NPA, gold, borrower pay, self-pay, NACH, Razorpay webhooks, mobile dashboard/customer/loan/collection/GPS/wallet, chits, vehicles, and product repossession.
  - Add helper modules: `assertRisk.ts`, `assertCron.ts`, `assertGold.ts`, `webhookFixtures.ts`, and `mobileApiClient.ts`.
  - Extend seed/cleanup helpers for penalties, NPA history/provisioning, client payment tokens, webhook events, NACH mandates/presentations, gold collateral/items/repledges, chits, vehicles, product-finance items, GPS rows, cron locks, and notification logs.

- Implement six suites:
  - `penaltyOverdueNpaForeclosure.test.ts`: overdue detection, penalty accrual, idempotency, waiver/settlement if current routes/services exist, NPA classification/history/provisioning/report, foreclosure/preclose/close/write-off behavior.
  - `cronJobsIdempotency.test.ts`: cron auth failures plus authorized penalty, NPA, reminder, report, subscription reminder, GPS purge, NACH present, and balance recompute runs; clear or expire cron locks between intentional reruns when testing idempotency.
  - `goldLoanAutomation.test.ts`: ornament master, rates/config, valuation math from `lib/gold/*`, LTV validation, gold collateral fixtures, receipt/report, repledge, servicing, redemption/release.
  - `borrowerPaymentsNach.test.ts`: borrower OTP login, own-loan scope, statement, self-pay link, signed Razorpay collection webhook success/failure/duplicate replay, NACH mandate lifecycle, presentation success/failure, and allocation rows.
  - `mobileAgentApiParity.test.ts`: stateful v1 mobile API parity for agent login, dashboard, customers, loans, collections, duplicate/offline sync behavior, GPS, wallet, branch/tenant isolation, logout/token invalidation where implemented.
  - `chitsVehicleSpecialModules.test.ts`: chits group/member/auction/payment/miss/cancel, vehicle create/detail/edit, product repossession/reactivation; module-disabled and inactive optional-module behavior as known gaps where backend gating is absent.

## Known Gap Policy
- Use existing `knownGap(...)` expected-failure style for current-code defects.
- Each gap must include test case ID, current behavior, expected behavior, evidence source, business impact, and fixed assertion.
- Add Phase 5 gap catalog entries for any discovered missing backend route/service, provider-only path, non-idempotent cron/payment behavior, missing waiver/settlement/write-off route, missing module gating, or NextAuth-only route harness limitation.
- Continue writing merged evidence to `Testing/qa_evidence/<RUN_ID>/known-gaps.md`, `known-gaps.json`, and `known-gaps-summary.json`.

## Test Plan
- Add npm scripts:
  - `test:e2e-risk`
  - `test:e2e-cron`
  - `test:e2e-gold`
  - `test:e2e-payments-nach`
  - `test:e2e-mobile-api`
  - `test:e2e-special-modules`
  - `test:e2e-business-phase5`
- Verification sequence:
  - `npm run typecheck`
  - `TEST_DATABASE_URL=mysql://root:root@localhost:3306/loantrack_qa_phase5_YYYYMMDD npm run test:e2e-business-phase5`
  - Confirm Prisma migrations are applied on the QA suffix DB before the run.
  - Confirm cleanup leaves no `RUN_ID` tenants/users/customers/loans/module/provider rows.
  - Confirm evidence separates passing cases, skipped/manual/device-only cases, known gaps, and failed normal cases.

## Assumptions
- Phase 5 remains API/service-level only; no Playwright, browser, Flutter emulator, real GPS device, camera, SMS, WhatsApp, Aadhaar/PAN, bank, live Razorpay, or live NACH calls.
- Razorpay/NACH/webhook cases use deterministic local HMAC signatures and mocked/sandbox-style payloads only.
- If a route calls live provider code with no mock switch, the suite should exercise the lower existing service or webhook handler where safe and register the live-provider route as a known gap.
- Existing Phase 1-4 tests should not be rewritten except for backward-compatible helper additions and shared known-gap catalog/evidence updates.
