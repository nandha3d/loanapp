# Step 8 — Chit Reports, Exports, and Dashboard Fixes

> **Implementation status (2026-07-08): DONE except one slug.** All builders below are registered in `lib/reports/registry.ts:212-232` including `vacant-chit-report` and aliases for the analytics-page links. Still broken: analytics uses bare `prized-subscriber-report` (`analytics/page.tsx:355`) which has no registry alias — one-line fix. See `IMPLEMENTATION_STATUS_GAP_ANALYSIS.md` gap 7.

## Goal

Fix existing chit report mismatch and add production-ready chit-fund reports.

Current issue found:

- Report builders exist:
  - `lib/reports/builders/chit-group-report.ts`
  - `lib/reports/builders/chit-auction-report.ts`
  - `lib/reports/builders/chit-subscription-due.ts`
- UI/report slugs may refer to names like:
  - `chit-group-ledger`
  - `auction-bid-history`
  - `prized-subscriber-report`
  - `vacant-chit-report`
- If registry names and UI slugs do not match, report clicks can fail.

Target state:

- Report slugs match registry.
- Core chit reports are available from UI.
- Reports support filters, branch security, exports, and clear column names.

## Files to inspect/update

```txt
lib/reports/registry.ts
lib/reports/data.ts
lib/reports/builders/chit-group-report.ts
lib/reports/builders/chit-auction-report.ts
lib/reports/builders/chit-subscription-due.ts
app/(dashboard)/[module]/reports/page.tsx
app/(dashboard)/[module]/reports/[slug]/page.tsx
app/(dashboard)/[module]/chits/page.tsx
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
```

## New report builders to create

```txt
lib/reports/builders/chit-group-ledger.ts
lib/reports/builders/chit-subscriber-ledger.ts
lib/reports/builders/chit-auction-register.ts
lib/reports/builders/chit-bid-history.ts
lib/reports/builders/chit-prized-subscriber-report.ts
lib/reports/builders/chit-dividend-register.ts
lib/reports/builders/chit-foreman-commission-report.ts
lib/reports/builders/chit-default-report.ts
lib/reports/builders/chit-payout-report.ts
lib/reports/builders/chit-security-pending-report.ts
lib/reports/builders/chit-agreement-pending-report.ts
lib/reports/builders/chit-receipt-register.ts
```

## Recommended report list

| Report slug | Report name | Purpose |
|---|---|---|
| `chit-group-report` | Chit Group Report | Summary of all chit groups. |
| `chit-group-ledger` | Chit Group Ledger | Period-wise collections, auctions, dividends, payout, commission. |
| `chit-subscriber-ledger` | Subscriber Ledger | Member-wise due, paid, dividend, penalty, balance. |
| `chit-auction-register` | Auction Register | Auction period, winner, bid, commission, dividend, status. |
| `chit-bid-history` | Auction Bid History | All bids placed for each auction. |
| `chit-prized-subscriber-report` | Prized Subscriber Report | Members who have won and payout/security status. |
| `chit-dividend-register` | Dividend Register | Dividend generated and adjusted per period/member. |
| `chit-foreman-commission-report` | Foreman Commission Report | Commission income period-wise. |
| `chit-default-report` | Default / Missed Payment Report | Missed/overdue subscriptions and penalties. |
| `chit-payout-report` | Prize Payout Report | Payouts released and pending. |
| `chit-security-pending-report` | Security Pending Report | Winners waiting for surety/security approval. |
| `chit-agreement-pending-report` | Agreement Pending Report | Members missing signed/verified agreements. |
| `chit-receipt-register` | Chit Receipt Register | All collection, penalty, payout, reversal receipts. |

## Registry update

Update `lib/reports/registry.ts` so every report has a matching slug and builder.

Example structure:

```ts
import { buildChitGroupLedger } from './builders/chit-group-ledger';
import { buildChitSubscriberLedger } from './builders/chit-subscriber-ledger';
import { buildChitAuctionRegister } from './builders/chit-auction-register';

export const reportRegistry = {
  // existing reports
  'chit-group-report': buildChitGroupReport,
  'chit-subscription-due': buildChitSubscriptionDue,
  'chit-auction-report': buildChitAuctionReport,

  // new reports
  'chit-group-ledger': buildChitGroupLedger,
  'chit-subscriber-ledger': buildChitSubscriberLedger,
  'chit-auction-register': buildChitAuctionRegister,
  'chit-bid-history': buildChitBidHistory,
  'chit-prized-subscriber-report': buildChitPrizedSubscriberReport,
  'chit-dividend-register': buildChitDividendRegister,
  'chit-foreman-commission-report': buildChitForemanCommissionReport,
  'chit-default-report': buildChitDefaultReport,
  'chit-payout-report': buildChitPayoutReport,
  'chit-security-pending-report': buildChitSecurityPendingReport,
  'chit-agreement-pending-report': buildChitAgreementPendingReport,
  'chit-receipt-register': buildChitReceiptRegister,
};
```

Adjust to match the actual registry pattern in the repo.

## Common report filters

Every chit report should support:

- `fromDate`
- `toDate`
- `branchId`
- `groupId`
- `status`
- `memberId` where applicable
- `periodNumber` where applicable

Tenant and branch must be enforced from authenticated context, not just request filters.

## Report builder rules

Each builder should return a standard report object matching existing report types.

Recommended columns should use simple business names.

Example `chit-subscriber-ledger` columns:

```txt
Group Name
Ticket No
Member No
Customer Name
Phone
Period No
Due Date
Base Due
Dividend
Penalty
Payable Amount
Paid Amount
Balance
Status
Last Receipt No
Payment Mode
```

Example query logic:

```ts
const rows = await prisma.chitSubscription.findMany({
  where: {
    member: {
      chitGroup: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        deletedAt: null,
        ...branchFilter,
      },
    },
  },
  include: {
    member: {
      include: {
        customer: true,
        chitGroup: true,
      },
    },
  },
  orderBy: [
    { dueDate: 'asc' },
    { periodNumber: 'asc' },
  ],
});
```

## Dashboard improvements

Update chit dashboard/list page:

```txt
app/(dashboard)/[module]/chits/page.tsx
```

Add cards:

- Active chit groups
- Draft groups pending activation
- Total chit value active
- This month collection due
- This month collected
- Missed subscriptions
- Auctions pending confirmation
- Security approvals pending
- Prize payouts pending

## Group detail report shortcuts

In:

```txt
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
```

Add buttons:

- Group ledger
- Subscriber ledger
- Auction register
- Bid history
- Payout report
- Receipt register

Each button should pass `groupId` filter.

## Export support

Existing report system appears to have:

```txt
lib/reports/csv.ts
lib/reports/excel.ts
lib/reports/pdf.tsx
```

Ensure all new reports export correctly to:

- CSV
- Excel
- PDF if existing report framework supports it

Money columns should be formatted consistently.

## Access control

Recommended access:

| Role | Access |
|---|---|
| Agent | Own branch/group collection reports only. No payout/security report unless allowed. |
| Admin | Branch-level chit reports. |
| Superadmin | Tenant-wide reports. |
| Developer | Full debug access. |

## Acceptance criteria

- All report slugs shown in UI exist in registry.
- Chit reports open without 404/fallback errors.
- Exports work for all new reports.
- Branch users cannot view other branch report data.
- Group detail page has report shortcuts.
- Dashboard cards show accurate numbers.
- Tests cover at least one CSV/export path for chit reports.

## Implementation prompt for coding agent

```txt
Implement Step 8 for the ZoloFund chit-fund module.

Fix the mismatch between chit report UI slugs and report registry/builders. Add new chit reports: group ledger, subscriber ledger, auction register, bid history, prized subscriber report, dividend register, foreman commission report, default report, payout report, security pending report, agreement pending report, and receipt register.

Ensure filters, tenant/branch security, CSV/Excel/PDF exports, dashboard cards, and group detail report shortcuts work. Add report tests for at least registry existence, report output rows, and export generation.
```
