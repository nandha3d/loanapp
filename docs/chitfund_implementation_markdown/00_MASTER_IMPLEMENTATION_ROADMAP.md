# Chit Fund Module — Master Implementation Roadmap

## Purpose

This roadmap converts the existing ZoloFund chit-fund MVP into a production-ready chit-fund operations module suitable for Tamil Nadu-style chit fund businesses.

The current app already has:

- `ChitGroup`, `ChitMember`, `ChitAuction`, and `ChitSubscription` Prisma models.
- A working, git-tracked Prisma migration history (`prisma/migrations/`, baseline `20260515000000_initial_baseline` plus incrementals) — new chit changes are ordinary incremental migrations.
- Web pages under `app/(dashboard)/[module]/chits`.
- Mobile APIs under `app/api/v1/chits`.
- Flutter screens under `mobile/lib/features/chits`.
- Basic accounting entries for collections and prize payouts.

The missing production areas are:

- Chit variety support: only one implicit style exists today (monthly open auction). Registered vs unregistered chits, lottery/fixed-rotation/sealed variants, daily/weekly frequency, dividend distribution options, fractional tickets, and foreman/vacant tickets are absent.
- Legal/compliance registration fields (for registered chits).
- Subscriber agreement, nominee, ticket, and document workflow.
- Proper auction workflow with bid history, attendance, minutes, and consistent calculation — including live online bidding.
- Surety/security approval before prize payout.
- Strong collection/payment/receipt/reversal workflow.
- Chit-specific reports (four report links in the analytics page point at slugs that do not exist in the registry).
- Branch-level security and mobile parity.
- Tests and seed data.

## Recommended implementation order

Implement these markdown files in the below order. Do not skip the order because later steps depend on earlier database and calculation changes.

| Order | Markdown file | Goal |
|---:|---|---|
| 1 | `01_DATABASE_MIGRATIONS_AND_SCHEMA.md` | Add incremental Prisma migration and production-grade chit schema. |
| 2 | `02_SHARED_CHIT_CALCULATION_ENGINE.md` | Centralize chit auction, dividend, commission, and subscription calculations. |
| 3 | `03_CHIT_GROUP_COMPLIANCE_REGISTRATION.md` | Add chit registration, approval, commencement, bank, and foreman security fields. |
| 4 | `11_CHIT_TYPES_AND_GROUP_CREATION_OPTIONS.md` | Add chit variety configuration: registered/unregistered, auction types, frequency, dividend and commission options, foreman/vacant/fractional tickets. |
| 5 | `04_SUBSCRIBER_AGREEMENT_KYC_NOMINEE_TICKET.md` | Add subscriber agreement, ticket/fraction, nominee, and document workflow. |
| 6 | `05_AUCTION_WORKFLOW_BIDS_ATTENDANCE_MINUTES.md` | Build full auction process: schedule, notice, bids, winner, attendance, minutes. |
| 7 | `12_LIVE_AUCTION_ROOM_POLLING.md` | Live beat: polling auction room, anti-snipe timer, sealed bids, audited lottery draw. |
| 8 | `06_PRIZE_PAYOUT_SURETY_SECURITY_APPROVAL.md` | Add surety/security verification before prize payout. |
| 9 | `07_COLLECTION_PAYMENTS_RECEIPTS_PENALTIES_REVERSALS.md` | Improve payment collection, receipt, penalty, partial payment, and reversal handling. |
| 10 | `08_REPORTS_EXPORTS_AND_DASHBOARDS.md` | Fix report registry mismatch and add chit-specific reports/exports. |
| 11 | `09_BRANCH_SECURITY_RBAC_AND_MOBILE_PARITY.md` | Enforce tenant + branch security and align mobile APIs with web behavior. |
| 12 | `10_TESTS_SEED_DATA_AND_RELEASE_CHECKLIST.md` | Add tests, seed data, QA evidence, and production release checklist. |

File names keep their historical step numbers; follow the Order column. Step 11 must land before the auction/collection steps because they read its configuration fields. `IMPLEMENTATION_STATUS_GAP_ANALYSIS.md` records what the current codebase already implements versus this roadmap.

## Post-live-room feature batch (Steps 13–23, added 2026-07-14)

After Step 12 (live auction room) shipped, the client requested 11 further improvements. Each has its own detailed spec doc; implement in the phases below (**not** file-number order — later docs depend on schema/engine work from earlier ones in the same phase).

| Doc | Feature | Depends on |
|---|---|---|
| `13_BID_FLOOR_COMMISSION.md` | Bid starts from commission amount, per-group toggle | none |
| `14_ORGANIZER_BELL_ENGINE.md` | Manual + automatic bell ("going once/twice/sold"), configurable interval/count/auto-close | none |
| `15_WINNER_SUMMARY.md` | Full post-win summary for staff + every member | 22a (DividendBreakdown) |
| `16_CUSTOM_FREQUENCY_ENGINE.md` | Daily/weekly/bi-weekly/monthly/custom frequency, fixes a month-overflow date bug | none |
| `17_AUCTION_TIMELINE.md` | Complete chronological bid/bell/open/extend/close history | 14 (bell events) |
| `18_AUTO_ATTENDANCE_LOGIN.md` | Auto-mark attendance on any borrower-portal login on auction day | none |
| `19_CUSTOMER_PAYMENT_PROOF.md` | Customer uploads payment proof/UTR; staff approve/reject queue | none |
| `20_NAV_BREADCRUMB_FIX.md` | Fix: auction room back/breadcrumb lands on chit home instead of the group page | none |
| `21_CHIT_CASHFLOW_REPORTS.md` | Fixes a cash-flow report bug (chit payouts excluded from outflow); adds in/out + 40-group portfolio reports | none |
| `22_DIVIDEND_DETAIL_CURRENT_PERIOD_VIEWS.md` | Step-by-step dividend breakdown component; current-period-first borrower views with overdue accordion | 16 (`periodWindow`) |
| `23_WHATSAPP_AUTOMATION.md` | WhatsApp inbound payments+proof, outbound automation, bidding by WhatsApp (Meta Cloud API) | 14, 15, 18, 19 |

### Phased rollout (one migration per phase, all additive/nullable)

- **Phase 0** (no schema): `20_NAV_BREADCRUMB_FIX.md`, `21_CHIT_CASHFLOW_REPORTS.md`.
- **Phase 1** (migration A — config): `16_CUSTOM_FREQUENCY_ENGINE.md` → `13_BID_FLOOR_COMMISSION.md`.
- **Phase 2** (migration B — live room): `14_ORGANIZER_BELL_ENGINE.md` → `17_AUCTION_TIMELINE.md` → `15_WINNER_SUMMARY.md` + `22_DIVIDEND_DETAIL_CURRENT_PERIOD_VIEWS.md` Part A.
- **Phase 3** (migration C — payments): `22_DIVIDEND_DETAIL_CURRENT_PERIOD_VIEWS.md` Part B → `19_CUSTOMER_PAYMENT_PROOF.md`.
- **Phase 4** (migration D — automation): `18_AUTO_ATTENDANCE_LOGIN.md` → `23_WHATSAPP_AUTOMATION.md` (outbound → inbound → WA bids).

User decisions locked into these specs: nav fix returns to the chit **group** page (not the groups list); bell auto-close after the final bell is a **per-group toggle**; WhatsApp covers **all three** of inbound payments, outbound automation, and WA bidding; attendance auto-marks on **any borrower-portal login on auction day**, in addition to the existing room-join marking.

## Target business flow after all steps

1. Admin creates a registered chit group with full compliance details.
2. Members are added with ticket numbers, nominees, agreements, and KYC documents.
3. Monthly subscriptions are generated automatically.
4. Collections are recorded with payment mode, receipt number, transaction reference, and collector.
5. Auction notice is prepared.
6. Members attend the auction.
7. Bids are recorded with bid amount/discount/time.
8. Winner is selected based on highest valid discount or configured rule.
9. Auction result is confirmed and minutes are generated.
10. Foreman commission and dividend are calculated by a shared calculation engine.
11. Prize winner submits surety/security documents.
12. Admin approves security.
13. Prize payout is released and posted to accounting/wallet.
14. Dividend is adjusted against future subscriptions or posted separately based on configured method.
15. Reports are available for group ledger, auction register, subscriber ledger, defaults, payouts, and commission.

## Definition of done for the full module

The chit-fund module is production-ready only when all of the following are true:

- Fresh deployment creates all required tables using `npm run db:deploy`.
- Web and mobile use the same calculation logic.
- No prize payout can be made before security/surety approval.
- Payment collection supports partial payments, arrears, penalties, receipts, and reversals.
- Auction has bid history and audit trail.
- Chit group cannot start unless required registration/compliance fields are complete.
- Reports open correctly from the UI and export to CSV/Excel/PDF.
- Tenant and branch isolation is enforced in every API and server action.
- Tests cover group creation, member assignment, collection, auction, payout, default, cancellation, reports, and security abuse cases.

## Important implementation principle

Do not duplicate business calculations in UI, server actions, and API routes. Put all calculation and validation logic in shared library functions under `lib/chits/`, then call those functions from both web and mobile paths.

## Suggested folder structure

Create the following new folders:

```txt
lib/chits/
  calculations.ts
  validation.ts
  status.ts
  receipts.ts
  reports.ts
  audit.ts
  security.ts
  types.ts

tests/chits/
  chitCalculation.test.ts
  chitGroupCompliance.test.ts
  chitCollections.test.ts
  chitAuctionWorkflow.test.ts
  chitPrizePayout.test.ts
  chitReports.test.ts
  chitSecurity.test.ts
```

## Suggested final scripts

Add these scripts to `package.json` after tests are created:

```json
{
  "test:chits": "tsx tests/chits/chitCalculation.test.ts && tsx tests/chits/chitGroupCompliance.test.ts && tsx tests/chits/chitCollections.test.ts && tsx tests/chits/chitAuctionWorkflow.test.ts && tsx tests/chits/chitPrizePayout.test.ts && tsx tests/chits/chitReports.test.ts && tsx tests/chits/chitSecurity.test.ts",
  "test:chits:calculation": "tsx tests/chits/chitCalculation.test.ts",
  "test:chits:security": "tsx tests/chits/chitSecurity.test.ts"
}
```

## Release strategy

Use feature flags if this app is already used by customers:

- `CHIT_COMPLIANCE_ENABLED`
- `CHIT_LIVE_AUCTION_ENABLED`
- `CHIT_SECURITY_APPROVAL_ENABLED`
- `CHIT_REPORTS_V2_ENABLED`

Recommended rollout:

1. Deploy database changes with nullable fields first.
2. Backfill existing chit groups.
3. Enable validation in warning mode.
4. Enable validation in blocking mode.
5. Enable reports.
6. Enable payout security blocking.

## Compliance note

This is a software implementation plan. Chit-fund legal rules, caps, registrations, agreement templates, and filings must be reviewed by a qualified legal/compliance person before production rollout.
