# Step 21 — In/Out Chit Cash-Flow Reports (40+ Group Portfolio View)

> **Implementation status (2026-07-14): PARTIAL + one confirmed bug.** 16 chit report builders exist in the registry but only 4 are exposed in the analytics UI, and the generic cash-flow report silently omits chit money movements. This doc fixes the bug and adds the "money flow across 40+ chits" views the client actually asked for.

## Goal

Client runs 40+ live chit groups and needs reports that give "proper understanding of money flow" — both a time-series in/out view (like a cash-flow statement, but chit-aware) and a per-group portfolio rollup (collected vs outstanding vs paid-out vs commission/dividend, one row per group, so 40 groups can be scanned at a glance).

## Current state (verified)

- `lib/reports/registry.ts:94-112` — 16 chit builders imported from `chit-production-reports.ts` and registered (`chit-group-report`, `chit-auction-report`, `chit-subscription-due`, `chit-group-ledger`, `chit-subscriber-ledger`, `chit-auction-register`, `auction-bid-history`/`chit-bid-history`, `chit-prized-subscriber-report`/`chit-prized-subscribers`/`prized-subscriber-report`, `chit-dividend-register`, `chit-foreman-commission-report`/`chit-foreman-commission`, `chit-default-report`/`chit-defaults-report`, `chit-payout-report`, `chit-security-pending-report`, `chit-agreement-pending-report`, `chit-receipt-register`, `vacant-chit-report`).
- `app/(dashboard)/[module]/analytics/page.tsx:352-357` `moduleReportsByAppType.chitfunds` only lists **4**: `chit-group-ledger`, `auction-bid-history`, `prized-subscriber-report`, `vacant-chit-report`. The other 12 registered builders (dividend register, foreman commission, defaults, payout, security-pending, agreement-pending, receipt register, subscriber ledger, auction register, subscription-due) are **built but unreachable from the UI** — a real gap independent of anything new.
- `lib/reports/builders/cash-flow.ts:37-41` — **confirmed bug**:
  ```ts
  if (['collection', 'capital_add'].includes(e.type)) item.inflow += amount;
  else if (['loan_disburse', 'expense', 'capital_withdraw'].includes(e.type)) item.outflow += amount;
  ```
  Chit prize payouts (`AccountEntry.type:'chit_payout'`, written by `lib/chits/payout.ts:20,35` and the older `lib/chit/settlement.ts:105`) and cash dividend payouts (`type:'chit_dividend_payout'`, written by `lib/chits/finalize.ts:83`) match **neither** list — they are silently excluded from both inflow and outflow, meaning the general cash-flow report **understates outflow** for any tenant running chit funds. Chit **collections** already post `type:'collection'` (`lib/chits/collections.ts:72`) so they're already correctly counted as inflow — only the payout side is missing.
- `lib/reports/types.ts:19-36` `ReportBuilderParams` has `branchId`/`customerId`/etc but **no `groupId`** — chit-group-scoped drill-down isn't possible today; every chit report is tenant/branch-wide only.
- `chit-production-reports.ts` already has a solid `groupWhere(params)` helper (`12-21`) reused across all 12+ builders — extending it to also filter by `chitGroupId` when `params.groupId` is set is a small, consistent change.

## Fixes and additions

### 1. Fix the cash-flow bug (`cash-flow.ts:39`)

```ts
else if (['loan_disburse', 'expense', 'capital_withdraw', 'chit_payout', 'chit_dividend_payout'].includes(e.type)) item.outflow += amount;
```

This is a one-line fix but has real financial-reporting impact for every chit tenant already live — treat as a priority fix independent of the rest of this doc's scope, verify with a before/after reconciliation against `chit-payout-report` + `chit-dividend-register` totals for a date range with known payouts.

### 2. New builder: `chit-cash-flow` (chit-specific, richer than the generic one)

Per-day breakdown of contributions-in / prize-out / dividend-out / commission-retained / net / running balance, scoped optionally to one group or the whole chit portfolio:

```ts
export async function buildChitCashFlow(params: ReportBuilderParams): Promise<ReportPayload> {
  const { from, to } = dateRange(params);
  const [collections, payouts, dividendPayouts] = await Promise.all([
    prisma.chitReceipt.findMany({ where: { tenantId: params.tenantId, appType: params.appType, receiptType: 'collection',
      issuedAt: { gte: from, lte: to }, ...(params.branchId ? { branchId: params.branchId } : {}) } }),
    prisma.chitReceipt.findMany({ where: { tenantId: params.tenantId, appType: params.appType, receiptType: 'payout',
      issuedAt: { gte: from, lte: to }, ...(params.branchId ? { branchId: params.branchId } : {}) } }), // verify actual receiptType string used by lib/chits/payout.ts before implementing — align to whatever it writes
    prisma.chitReceipt.findMany({ where: { tenantId: params.tenantId, appType: params.appType, receiptType: 'dividend_payout',
      issuedAt: { gte: from, lte: to }, ...(params.branchId ? { branchId: params.branchId } : {}) } }),
  ]);
  // group by day, columns: bucket, contributionsIn, prizesOut, dividendsOut, net, balance (running)
  // groupId filter: join through ChitReceipt.entityId -> ChitSubscription.memberId -> ChitMember.chitGroupId
  // when params.groupId is set (receipts don't carry chitGroupId directly — resolve via the entity chain, or
  // add a denormalized chitGroupId to ChitReceipt if this join proves too expensive at 40+ groups scale).
}
```

KPIs: total collected, total paid out (prizes), total dividends paid, net position, plus a top-line "money currently held" figure (collected − prizes − cash dividends, i.e. what ADJUST_NEXT_DUE/ACCUMULATE dividends are *not* cash so don't subtract those).

### 3. New builder: `chit-group-portfolio` — the "40 chits at a glance" view

One row per active/completed group: chit value, members, total collected, total outstanding, prizes paid to date, commission earned, GST collected, dividends distributed (cash vs credited), completion % (periods completed / totalMembers), next auction date. This is the single most useful new report for a 40+-group operator — a portfolio table they can sort/filter without opening each group individually. Reuses the existing `buildChitGroupLedger` (`chit-production-reports.ts:31-93`) as a starting point but adds completion % and next-auction-date columns that aren't there today, and consider whether to extend `chit-group-ledger` in place vs. add a new slug — recommend a **new** slug (`chit-group-portfolio`) to avoid changing the existing report's contract for anyone already relying on it.

### 4. Expose the full catalog + add `groupId` filter

- `analytics/page.tsx:341-358` `moduleReportsByAppType.chitfunds` — replace the 4-entry list with the full set, organized into categories matching the existing `reportCategories` pattern (`360+`) — e.g. **Operations** (group ledger, subscriber ledger, auction register, bid history, subscription due, agreement pending), **Finance** (chit cash flow, group portfolio, dividend register, foreman commission, receipt register, payout report), **Risk** (defaults report, security pending, vacant chit report, prized subscriber report).
- `lib/reports/types.ts:19-36` `ReportBuilderParams` — add `groupId?: string`.
- `ReportBuilderParams`/`ReportShell`/report-serve + export routes — thread `groupId` through exactly like the existing `branchId`/`customerId` filters already are (find the generic serve/export route handlers that build `ReportBuilderParams` from query params and add the one field — no per-report special-casing needed since it's a generic param).
- `components/reports/ReportShell.tsx` (`supportedFilters: string[]` prop, line 11) / `FilterBar.tsx` — add a `groupId` filter type that renders a chit-group picker (searchable select, since there are 40+) when a report's `supportedFilters` includes it; only the chit builders declare it.

## Edge cases

- `groupId` filter on a report whose builder doesn't yet support it — `supportedFilters` gating in `ReportShell` already prevents showing filters a report doesn't declare; make sure new chit builders explicitly opt in rather than the filter silently doing nothing.
- Historical `AccountEntry` rows already written before the `cash-flow.ts` fix — the fix changes report **output**, not stored data, so it retroactively (and correctly) includes past chit payouts the moment it ships; no backfill needed, just confirm this is the desired behaviour (it is — those payouts already happened, the report was just wrong).
- `chit-cash-flow`'s groupId join through `ChitReceipt.entityId` — if this join is too slow at scale (40+ groups × years of receipts), consider it acceptable for now given report queries aren't hot-path, but flag as a candidate for a denormalized `chitGroupId` column on `ChitReceipt` if performance testing during implementation shows it's needed (don't add the column speculatively).

## Verification steps

- Regression: existing `cash-flow` report totals for a tenant with only loan activity (no chits) are unchanged after the fix (empty intersection with the new types).
- Reconciliation: for a tenant with known chit payout/dividend activity in a date range, assert `cash-flow` outflow total now includes those amounts, and that `chit-cash-flow`'s own totals reconcile against `chit-payout-report` + `chit-dividend-register` for the same range (same underlying `ChitReceipt`/`AccountEntry` rows, different presentation).
- Manual: analytics page shows all ~18 chit report slugs (16 existing + 2 new), categorized, each opens and exports (CSV/Excel/PDF) without error.
- Manual: `chit-group-portfolio` report against the client's real 40+-group tenant (or a seeded equivalent) renders in acceptable time and the numbers match manually-checked totals for a handful of spot-checked groups.

## Dependencies

None — no schema changes required (the `chitGroupId`-join question in edge cases is the only place a schema change might become necessary, deferred pending real perf data). Ship in Phase 0 (bug fix + catalog exposure are independent of any live-room work) alongside doc 20.
