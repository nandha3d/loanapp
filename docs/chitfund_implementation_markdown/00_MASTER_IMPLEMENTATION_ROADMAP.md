# Chit Fund Module — Master Implementation Roadmap

## Purpose

This roadmap converts the existing LoanTrack chit-fund MVP into a production-ready chit-fund operations module suitable for Tamil Nadu-style chit fund businesses.

The current app already has:

- `ChitGroup`, `ChitMember`, `ChitAuction`, and `ChitSubscription` Prisma models.
- Web pages under `app/(dashboard)/[module]/chits`.
- Mobile APIs under `app/api/v1/chits`.
- Flutter screens under `mobile/lib/features/chits`.
- Basic accounting entries for collections and prize payouts.

The missing production areas are:

- Legal/compliance registration fields.
- Subscriber agreement, nominee, ticket, and document workflow.
- Proper auction workflow with bid history, attendance, minutes, and consistent calculation.
- Surety/security approval before prize payout.
- Strong collection/payment/receipt/reversal workflow.
- Chit-specific reports.
- Branch-level security and mobile parity.
- Tests and deployment migrations.

## Recommended implementation order

Implement these markdown files in the below order. Do not skip the order because later steps depend on earlier database and calculation changes.

| Step | Markdown file | Goal |
|---:|---|---|
| 1 | `01_DATABASE_MIGRATIONS_AND_SCHEMA.md` | Add real Prisma migrations and production-grade chit schema. |
| 2 | `02_SHARED_CHIT_CALCULATION_ENGINE.md` | Centralize chit auction, dividend, commission, and subscription calculations. |
| 3 | `03_CHIT_GROUP_COMPLIANCE_REGISTRATION.md` | Add chit registration, approval, commencement, bank, and foreman security fields. |
| 4 | `04_SUBSCRIBER_AGREEMENT_KYC_NOMINEE_TICKET.md` | Add subscriber agreement, ticket/fraction, nominee, and document workflow. |
| 5 | `05_AUCTION_WORKFLOW_BIDS_ATTENDANCE_MINUTES.md` | Build full auction process: schedule, notice, bids, winner, attendance, minutes. |
| 6 | `06_PRIZE_PAYOUT_SURETY_SECURITY_APPROVAL.md` | Add surety/security verification before prize payout. |
| 7 | `07_COLLECTION_PAYMENTS_RECEIPTS_PENALTIES_REVERSALS.md` | Improve payment collection, receipt, penalty, partial payment, and reversal handling. |
| 8 | `08_REPORTS_EXPORTS_AND_DASHBOARDS.md` | Fix report registry mismatch and add chit-specific reports/exports. |
| 9 | `09_BRANCH_SECURITY_RBAC_AND_MOBILE_PARITY.md` | Enforce tenant + branch security and align mobile APIs with web behavior. |
| 10 | `10_TESTS_SEED_DATA_AND_RELEASE_CHECKLIST.md` | Add tests, seed data, QA evidence, and production release checklist. |

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
