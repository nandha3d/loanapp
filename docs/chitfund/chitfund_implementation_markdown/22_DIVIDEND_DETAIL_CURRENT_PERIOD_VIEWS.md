# Step 22 — Dividend Breakdown Detail + Current-Period-First Views

> **Implementation status (2026-07-14): NOT IMPLEMENTED.** No step-by-step dividend UI exists anywhere (staff or customer); the borrower portal shows every period flat with no current/overdue separation; no accordion/collapse component exists in the codebase. This doc has two parts (22a: breakdown component, 22b: current-period views) that share the same underlying data but ship as one migration since 22b's schema need is really doc 16's `periodWindow`.

## Goal

Two related requests: (10) after dividend calculation, show the detail step-by-step; and (10b) payment-details views should show only the **current** month/period by default, with overdue periods tucked into a separate tab or accordion rather than one long flat list — important because the client runs 40+ chits and a member could be looking at many periods at once today.

## Part A — Dividend Breakdown Component

### Current state

- `lib/chits/calculations.ts:18-54` `calculateChitAuction()` computes every step already: `bidDiscount = chitValue - prizeAmount`, `commission = commissionBase * commissionPct / 100` (basis-aware), `gstAmount = commission * gstPct / 100`, `distributableDividend = bidDiscount - commission`, `dividend = distributableDividend / eligibleMembers` (rounded down to `dividendRounding` increment), `roundingIncome = distributableDividend - dividend*eligibleMembers`. All of this is **already persisted** on `ChitAuction` at finalize time (`finalize.ts:154-171`) — this part is a pure rendering task, no new calculation logic.
- No component anywhere renders these as a labeled step sequence — figures currently appear as bare numbers scattered across the UI (e.g. `AuctionDetailClient.tsx`'s "Prize & security" card, `chit-production-reports.ts`'s dividend register columns) with no "here's how we got this number" explanation.

### Design

New `components/chits/DividendBreakdown.tsx` (server-renderable, pure props-in):

```tsx
type DividendBreakdownProps = {
  chitValue: number; prizeAmount: number; bidDiscount: number;
  commissionPct: number; commissionBasis: 'BID_DISCOUNT' | 'CHIT_VALUE'; commission: number;
  gstPct?: number | null; gstAmount: number;
  distributableDividend: number; dividendEligibleMembers: number; dividend: number; roundingIncome: number;
  dividendPolicy: string; dividendDistribution: string; currencySymbol: string;
};
// Renders a vertical step list: Chit Value → − Prize Amount → = Bid Discount → − Commission (Xpct of {basis}) →
// (± GST if gstPct set) → = Distributable Dividend → ÷ {eligibleMembers} eligible tickets → = Dividend per ticket,
// with Rounding Income shown as a small footnote line when non-zero, and a closing sentence describing
// dividendDistribution mode ("credited to next due" / "accumulated" / "paid in cash").
```

Consumed by: doc 15's winner summary card (both staff and member audience), the group-detail auction row (expand-to-see-breakdown, likely already-existing per-auction rows in `ChitGroupDetailClient.tsx`), and the borrower portal's per-period result view (Part B below). Building one shared component instead of three separate renderings keeps the math presentation consistent and is the reason doc 15 explicitly depends on this doc.

Flutter equivalent: a `DividendBreakdown` stateless widget with the same field list, used from the mobile winner-summary sheet (doc 15) and the borrower chit detail screen.

## Part B — Current-Period-First Views

### Current state

- `app/borrower/chits/page.tsx` — flat, ungrouped list of **every** `ChitSubscription` across **every** group the member belongs to, via `getMyChitContributions` (`customerPortal.ts:122-154`), sorted only by `[memberId, periodNumber]`. For a member in several chits, or any chit with a long duration, this is a long undifferentiated scroll with no "what do I owe right now" focal point.
- No accordion/collapsible component exists anywhere in the repo (confirmed by search) — native `<details>/<summary>` is unstyled but functionally exactly what's needed and requires no client JS/hydration cost, which matters since this page is currently a server component with no `'use client'`.
- Staff-side subscriptions tables (wherever `ChitSubscription` rows are listed per group, e.g. inside `ChitGroupDetailClient.tsx`) have the same flat-list problem at the group level.

### Schema / data dependency

No new schema — this needs doc 16's `periodWindow(startDate, period, freq)` to correctly define "current" for **any** frequency (a daily chit's "current period" window is one day; a monthly chit's is roughly a month) rather than hardcoding month-based logic that would be wrong for daily/weekly chits. **This is why doc 22b is sequenced after doc 16 in the phase plan even though schema-wise it needs nothing of its own.**

### Backend design

New `lib/chits/customerPortal.ts` function `getMyChitContributionsGrouped(customerId, tenantId)`:

```ts
export async function getMyChitContributionsGrouped(customerId: string, tenantId: string) {
  const flat = await getMyChitContributions(customerId, tenantId); // reuse existing, don't duplicate the underlying query
  const byGroup = groupBy(flat, c => c.groupId);
  return Object.entries(byGroup).map(([groupId, periods]) => {
    const freq = parseFrequency(/* group config — extend getMyChitContributions' query to also select frequency fields + startDate, or do a second light query per group */);
    const today = new Date();
    // "Current" = smallest unpaid period whose periodWindow (doc 16) covers today; if none covers today
    // (e.g. between periods, or all caught up), fall back to the next unpaid period by periodNumber.
    const current = periods.find(p => p.status !== 'paid' && withinWindow(periodWindow(startDate, p.periodNumber, freq), today))
      ?? periods.find(p => p.status !== 'paid');
    const overdue = periods.filter(p => p.status !== 'paid' && p !== current && isPast(periodWindow(startDate, p.periodNumber, freq).to, today));
    const upcoming = periods.filter(p => p.status !== 'paid' && p !== current && !overdue.includes(p));
    const history = periods.filter(p => p.status === 'paid');
    return { groupId, groupName: periods[0].groupName, current, overdue, upcoming, history };
  });
}
```

### Web UI

- `app/borrower/chits/page.tsx` rework: per group, a card with the **current period always open/expanded** (net due, dividend credit if any, the doc 19 "I've paid — upload proof" button lives here), an `Overdue (n)` section using the new `components/ui/Collapse.tsx` (styled native `<details>`, red badge on the count when `n > 0`, collapsed by default), an `Upcoming` section (collapsed, informational), and `History` (collapsed, receipts + dividend breakdown per past period using Part A's component).
- New `components/ui/Collapse.tsx`:
  ```tsx
  export function Collapse({ summary, badge, tone, defaultOpen, children }: {
    summary: string; badge?: number; tone?: 'default'|'danger'; defaultOpen?: boolean; children: React.ReactNode;
  }) {
    return (
      <details open={defaultOpen} className="collapse">
        <summary>{summary}{badge != null && <span className={`badge ${tone === 'danger' ? 'badge-danger' : ''}`}>{badge}</span>}</summary>
        <div className="collapse-body">{children}</div>
      </details>
    );
  }
  ```
  Zero client JS, RSC-safe (no `'use client'` needed), matches the "server component page" nature of the existing borrower chits page — do not reach for a JS-driven accordion library when native `<details>` covers the requirement.
- Staff subscriptions table (per group, in `ChitGroupDetailClient.tsx`): add Current / Overdue / All tabs above the existing table (simple client-side filter on already-fetched data, no new query needed — the group detail page already loads all subscriptions).

### Mobile (Flutter)

- Borrower chit list screen: mirror the same current/overdue/upcoming/history grouping, using `ExpansionTile` (Flutter's built-in accordion widget — no custom component needed there, unlike web which has nothing built-in) for overdue/upcoming/history, with the current period always shown expanded at the top of each group's card.

## Edge cases

- Member fully paid up on a group (no current unpaid period) — show a "You're all caught up" state for that group's current-period slot rather than an empty/broken card; still show History.
- A period whose window has passed but is still unpaid is "overdue," not "current" — the `current` selection logic above explicitly excludes already-past windows from being treated as current (falls through to being counted in `overdue` instead via the `isPast` check), so a member doesn't see a severely overdue period misleadingly labeled as "this month's due."
- Daily/weekly chits (doc 16) — "current" must resolve correctly to a single day/week window, not accidentally span a whole month if the grouping logic assumes monthly cadence anywhere; this is precisely why `periodWindow` is frequency-aware rather than a hardcoded date-range.
- Group with zero periods yet generated (not yet activated) — `getMyChitContributionsGrouped` should simply produce an empty result for that group (already handled by `getMyChitContributions` returning `[]` for members with no subscriptions).

## Verification steps

- Unit test `getMyChitContributionsGrouped`'s current/overdue/upcoming bucketing against fixtures covering: on-time member (current = next unpaid, no overdue), a member with 2 overdue periods, a member fully paid up, and a daily-frequency group (window granularity check).
- Manual: borrower portal for a member in 3+ chit groups renders one card per group, current period expanded, overdue/upcoming/history collapsed with correct counts.
- Manual: `DividendBreakdown` renders identically (same component, different call sites) in the winner summary (doc 15), a group-detail auction row, and the borrower per-period result — visually confirm no drift between the three usages.
- Regression: existing `getMyChitContributions` (flat) stays intact/unchanged for any other caller that still needs the flat shape — `getMyChitContributionsGrouped` wraps it rather than replacing its internals.

## Dependencies

Depends on doc 16 (`periodWindow`, `parseFrequency`) — sequence after Phase 1. Doc 15 (winner summary) depends on Part A (`DividendBreakdown`) — build 22a before or alongside 15. Should land in Phase 3.
