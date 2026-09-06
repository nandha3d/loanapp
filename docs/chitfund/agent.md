# Chit Fund Module Agent Guide

This guide is the module-only context for ZoloFund chit fund work. Use it before
editing chit fund web pages, API routes, shared services, Prisma schema, mobile
screens, or tests.

## Agent Rules

- Read `AGENTS.md` first. This repo uses Next `16.2.6`; before changing Next
  code, read the relevant guide under `node_modules/next/dist/docs/`.
- Use PowerShell `-LiteralPath` for bracketed route paths such as
  `app/(dashboard)/[module]/chits` and `app/api/v1/chits/[id]`.
- Preserve tenant, app type, branch, role, module-gate, audit, receipt, wallet,
  and accounting behavior. Chit fund changes are never global-only changes.
- Reuse `lib/chits/*` helpers for math, validation, access checks, finalization,
  live room state, collections, payout, receipts, reports, security, and audit.
  Do not duplicate chit calculations in UI or mobile code.
- Keep web and mobile parity in mind. Web Server Actions and `/api/v1/chits/*`
  routes should follow the same business rules unless a route is intentionally
  web-only or mobile-only.

## Architecture

### Web UI

- Web pages live under `app/(dashboard)/[module]/chits`.
- `page.tsx` lists chit groups, applies tenant/app/branch scope, enforces the
  `chitfunds` module gate, and redirects agents to collection.
- `new/page.tsx` and `new/ChitGroupForm.tsx` create draft groups.
- `[id]/page.tsx`, `[id]/ChitGroupDetailClient.tsx`, `[id]/edit/page.tsx`, and
  `[id]/edit/ChitGroupEditForm.tsx` handle detail, activation, member metadata,
  subscription collection, missed payments, cancellation, and compliance edits.
- `[id]/auctions/[auctionId]` contains auction management UI for attendance,
  bids, draw/fixed rotation, live room, confirmation, security, and payout.
- Web mutations are in `app/(dashboard)/[module]/chits/actions.ts` and should
  stay scoped through `getWebChitScope()` and `scopedChitGroupWhere()`.

### API and Mobile

- Mobile/API routes live under `app/api/v1/chits/*`.
- Routes use the shared v1 response envelope through `ok()` and `fail()`.
- Authentication and scoping come from `requireMobileContext()` and
  `scopedBranchWhere()`.
- Admin, superadmin, and developer roles can manage chit groups. Agent access is
  limited to allowed collection workflows.
- API routes cover list/create/detail/update, activation/cancel, members,
  subscriptions, payments, penalties, receipt reversal, auctions, attendance,
  bids, live room state, draw, confirmation, security, and payout.

### Domain Core

- `lib/chits/calculations.ts` owns auction, dividend, fixed-discount, rounding,
  and payment status calculations.
- `lib/chits/validation.ts` owns group config, commission, prize, discount, and
  activation validation.
- `lib/chits/access.ts` owns role checks and scoped chit queries.
- `lib/chits/auction.ts`, `lottery.ts`, and `liveAuction.ts` own winner
  selection, tie handling, audited draws, and live room clock behavior.
- `lib/chits/finalize.ts` is the shared winner finalization path for web,
  mobile/API, draws, and foreman-ticket resolution. It applies dividends and
  creates security/audit state, but does not release prize payout.
- `lib/chits/collections.ts` posts contribution payments, receipts, account
  entries, and branch wallet movement.
- `lib/chits/payout.ts`, `security.ts`, `receipts.ts`, `reports.ts`, and
  `audit.ts` own payout release, security gates, receipt numbering/reversal,
  report helpers, and audit logging.

### Data Model

Chit fund persistence is in `prisma/schema.prisma`.

- `ChitGroup`: tenant/app/branch scoped group config, registration/compliance
  metadata, auction rules, dividend rules, and status.
- `ChitMember`: subscriber/customer link, ticket number/share, agreement,
  nominee, foreman-ticket flag, and prize-won state.
- `ChitAuction`: period schedule, attendance/notice/minutes, winner, prize,
  discount, commission, dividend, GST, rounding income, live room, and payout
  status.
- `ChitSubscription`: member-period dues, base due, dividend credit, penalty,
  payment status, receipt reference, collector, and notes.
- `ChitBid`: tenant/branch scoped auction bid with discount, status, remarks,
  creator, and bidder member.
- `ChitAuctionAttendance`: member attendance/proxy records per auction.
- `ChitReceipt`: collection, dividend payout, prize payout, penalty, and reversal
  receipt records.
- `ChitSecurity`: winner security submission, verification, approval, and
  rejection state before payout.
- `ChitPenalty`: late fee or other subscription-linked penalty, payment, and
  waiver state.
- `ChitDocument`: uploaded documents for chit entities.

### Mobile Parity

- Mobile service calls live in `mobile/lib/data/services/chit_service.dart`.
- Mobile models live in `mobile/lib/data/models/chit.dart`.
- Mobile screens live in `mobile/lib/features/chits/`.
- The mobile client should not compute authoritative chit math. It sends inputs
  and displays server-calculated values from the API.
- Keep endpoint names and payloads aligned with `mobile/lib/shared/constants`
  endpoint definitions and `/api/v1/chits/*` route behavior.

## Automation Checklist

### Existing Coverage to Keep Running

- `npm run test:chits`
- `tsx tests/chits/chitAuctionWorkflow.test.ts`
- `tsx tests/chitsApi.test.ts`
- `npm run test:mobile-parity-api`
- `npm run test:rbac-new-modules`
- `npx playwright test tests/e2e/new-modules --project=e2e --no-deps`

### Automate Next

- Chit lifecycle API + DB: create draft, add/update members, activate, generate
  subscriptions and auctions, collect payment, mark missed, create/pay/waive
  penalty, and cancel group.
- Auction lifecycle: attendance, bid validation, tied-bid lottery, draw or fixed
  rotation, confirm, dividend distribution, security approval, and payout
  release.
- Isolation and security: tenant/app/branch scoping, module disabled behavior,
  and agent/admin/superadmin/developer permissions.
- Money assertions: receipt rows, account entries, branch wallet movement,
  payout status, and receipt reversal behavior.
- Mobile contract: Dart model parsing and service endpoint parity for
  list/detail/members/auctions/payments/security/live room.
- Browser visual smoke: chit list, create, detail, auction manage, live auction
  room, and subscription gate.

## Verification

For this documentation-only file, run:

```powershell
git diff -- docs/chitfund/agent.md
```

No code tests are required unless source code changes. Before browser proof,
confirm Node is `v22.22.0` or newer with:

```powershell
node -v
```

Then run the chit-focused browser smoke:

```powershell
npx playwright test tests/e2e/new-modules/01-chits.spec.ts --project=e2e --no-deps
```
