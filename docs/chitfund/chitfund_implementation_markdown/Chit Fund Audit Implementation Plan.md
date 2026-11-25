# Chit Fund Audit Implementation Plan

## Summary
Start with the smallest high-impact fixes confirmed in the current repo: web/mobile wallet isolation, branch scoping, mobile auction flow cleanup, duration label fix, and collection breakdown display. Defer heavier work like offline chit sync and chit security document workflow until the quick P0 parity gaps are closed.

Current preflight facts: shell Node is already `v22.22.2`, satisfying the requested `v22.22.0+` floor. Before editing App Router pages/routes, read the relevant local Next docs under `node_modules/next/dist/docs/01-app/01-getting-started/`.

## Phase 1: Easy P0 Fixes First
- Block web chit wallet access: remove `chitfunds` from the sidebar wallet item, remove `/wallet` from the always-visible route exception for chit users, and make `app/(dashboard)/[module]/wallet/page.tsx` call `notFound()` immediately when `appType === 'chitfunds'`.
- Add branch scoping to web chit detail and auction detail reads using existing `getWebChitScope()` and `scopedChitGroupWhere()` from `lib/chits/access.ts`; also scope the auction security lookup through the already-loaded scoped auction/group relation.
- Fix mobile wallet deep-link isolation: guard `/wallet` in `mobile/lib/core/router/app_router.dart` for chit users and redirect to `/chits` or `/dashboard`; keep non-chit wallet behavior unchanged.
- Fix mobile live-room duration wording: change the input label/default to minutes and send `durationMinutes` directly, keeping anti-snipe in seconds.
- Hide the legacy mobile “Record Winner” button/path from chit screens so users must use bid + confirm/draw flows that hit the finalized auction endpoints.

## Phase 2: Auction Parity
- Deprecate or harden the legacy mobile auction POST route so it cannot confirm auctions without dividend finalization; preferred behavior is to return a clear 410/400 instructing clients to use bid + confirm/draw endpoints.
- Add mobile attendance controls to the auction/live screen using the existing `markAttendance()` service and attendance endpoint; support present, absent, and proxy with proxy name validation.
- Keep `confirmAuction()` and `drawWinner()` as the only mobile winner-resolution paths.

## Phase 3: Collection Parity
- Add contribution breakdown fields to web chit collection rows: base contribution, dividend adjustment, penalty, net due, paid, outstanding.
- Add the same visible breakdown to mobile chit subscription rows and payment sheets using the existing `ChitSubscription` fields.
- Add `cheque` as a payment option wherever mobile chit collection already offers cash/UPI/bank.
- Add chit payment idempotency before offline sync: accept `idempotencyKey` on `POST /api/v1/chits/[id]/payments` and ensure duplicate retries return the original result instead of creating another receipt/payment.
- After idempotency exists, wire chit payments into the existing generic/offline queue pattern; do not reuse the loan installment queue directly.

## Phase 4: Security Documents
- Reuse existing `ChitDocument` for guarantor photo/KYC/security-cheque images linked to `entityType = chit_security` and `entityId = ChitSecurity.id`.
- Add upload/list/review API support for chit security documents, scoped by tenant/app/branch.
- Extend web and mobile security sheets to upload guarantor photo, guarantor KYC, and cheque image.
- Add structured cheque fields to `ChitSecurity` only if required for reporting/search: cheque number, bank name, cheque date, MICR, IFSC.

## Test Plan
- Quick checks after Phase 1: `npm run typecheck`, `flutter analyze --no-fatal-infos --no-fatal-warnings`, `flutter test test/service_contract_test.dart`, `npm run ui-map:roles`.
- Parity checks after Phase 2/3: `flutter test`, `npm run test:mobile-parity-api`, `npm run test:rbac-new-modules`.
- Browser visual check after runtime/docs preflight: run the chit Playwright smoke, including `/chitfunds/wallet` expecting 404 and no wallet link in chit sidebar.
- Full closeout: `npm run test:e2e-chits-ui` if local auth/env is available; otherwise report browser proof as env-blocked with the exact missing variable.

## Assumptions
- Keep all changes additive and preserve existing backend/frontend/mobile flows for non-chit modules.
- Treat Phase 1 as the easiest safe implementation batch.
- Do not implement offline chit queue until backend idempotency is in place.
- Do not add new schema for document uploads until the existing `ChitDocument` path is proven insufficient.
