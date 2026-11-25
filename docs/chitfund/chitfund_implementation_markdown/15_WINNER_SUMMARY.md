# Step 15 — Post-Win Summary Screen

> **Implementation status (2026-07-14): NOT IMPLEMENTED.** Staff web shows a minimal "Prize & security" card; mobile shows a bare `_WinnerCard`. Neither presents a full breakdown to all participants. No schema change needed — every figure is already persisted at finalize time.

## Goal

After an auction is confirmed/drawn, everyone (staff and every member, not just the winner) should see a clear, shareable summary: who won, prize amount, bid discount, commission, GST, distributable dividend, per-ticket dividend, how the dividend is applied (credited to next due / accumulated / paid in cash), and — for the viewing member specifically — "did I win," "what's my dividend," and "what's my next due now."

## Current state (verified)

- `lib/chits/calculations.ts:18` `calculateChitAuction()` already computes everything needed: `bidDiscount`, `commission`, `gstAmount`, `distributableDividend`, `dividend` (per-ticket, via `roundDividendDown`), `dividendEligibleMembers`, `roundingIncome`.
- `lib/chits/finalize.ts:111` `finalizeAuctionInTx` persists `prizeAmount`, `bidDiscount`, `commission`, `dividend`, `gstAmount`, `roundingIncome` onto `ChitAuction` at confirm time (`125-134`, `154-171`), and `applyDividendDistribution` (`13-105`) applies the dividend per the group's `dividendDistribution` mode.
- Staff web: `AuctionDetailClient.tsx` "Prize & security" card (`635-652`, referenced again `849`) shows prize amount and security status only — no commission/GST/dividend breakdown, no per-member table.
- Mobile: `borrower_chit_live_screen.dart` `_WinnerCard` (`852`) is a bare "You won!" style card with no figures.
- No existing route serves a structured summary payload — this is net-new.

## Backend design

New `lib/chits/winnerSummary.ts`:

```ts
export async function buildWinnerSummary(auctionId: string, opts: { audience: 'staff' | 'member'; memberId?: string }) {
  const auction = await prisma.chitAuction.findUnique({
    where: { id: auctionId },
    include: {
      chitGroup: { select: { name: true, chitValue: true, commissionPct: true, commissionBasis: true,
        gstPct: true, dividendPolicy: true, dividendDistribution: true, totalMembers: true } },
      winnerMember: { include: { customer: { select: { name: true, phone: true } } } },
    },
  });
  if (!auction || auction.status === 'pending') return null; // not confirmed yet — 404 upstream

  const calc = {
    prizeAmount: Number(auction.prizeAmount), bidDiscount: Number(auction.bidDiscount),
    commission: Number(auction.commission), gstAmount: Number(auction.gstAmount),
    dividend: Number(auction.dividend), roundingIncome: Number(auction.roundingIncome),
  }; // re-derive distributableDividend/eligibleMembers from calculateChitAuction() using persisted inputs, don't recompute prize/discount — they're the source of truth once confirmed

  const base = {
    groupName: auction.chitGroup.name, periodNumber: auction.periodNumber,
    winnerName: auction.winnerMember?.customer.name, winnerTicketNo: auction.winnerMember?.ticketNo,
    ...calc,
    distributionMode: auction.chitGroup.dividendDistribution,
  };

  if (opts.audience === 'staff') {
    // Full per-member dividend table — reuse applyDividendDistribution's member-selection logic
    // (NON_WINNERS_ONLY excludes the winner ticket) but READ-ONLY here, no writes.
    const members = await prisma.chitMember.findMany({ where: { chitGroupId: auction.chitGroupId,
      ...(auction.chitGroup.dividendPolicy === 'NON_WINNERS_ONLY' ? { NOT: { ticketNo: auction.winnerMember?.ticketNo } } : {}) },
      select: { id: true, ticketNo: true, ticketShare: true, customer: { select: { name: true } } } });
    return { ...base, memberDividends: members.map(m => ({ ticketNo: m.ticketNo, name: m.customer.name,
      dividend: roundMoney(calc.dividend * Number(m.ticketShare)) })) };
  }

  // member audience: only "my" figures, scoped to opts.memberId (never trust a body-supplied memberId — same rule as customerAuction.ts)
  const iWon = auction.winnerMemberId === opts.memberId;
  const mySub = await prisma.chitSubscription.findFirst({ where: { memberId: opts.memberId, periodNumber: auction.periodNumber + 1 } });
  return { ...base, me: { iWon, myDividend: calc.dividend, myNextDue: mySub ? Number(mySub.dueAmount) : null } };
}

export function formatWinnerSummaryText(summary: Awaited<ReturnType<typeof buildWinnerSummary>>): string {
  // Plain-text rendering reused by: web "Copy"/"Print" button, WhatsApp winner-summary template (doc 23).
}
```

## API routes

- `app/api/v1/chits/[id]/auctions/[auctionId]/summary/route.ts` (staff/mobile-staff, `requireMobileContext` + role check) — wraps `buildWinnerSummary(auctionId, { audience: 'staff' })`.
- `app/api/v1/borrower/chits/[groupId]/auctions/[auctionId]/summary/route.ts` (borrower) — resolves `memberId` from the borrower session (never the request), wraps `buildWinnerSummary(auctionId, { audience: 'member', memberId })`.
- Both return `404` while `auction.status === 'pending'` (not yet confirmed) so clients can poll-then-fetch-once (see below).

## Web UI

- `AuctionDetailClient.tsx` "Prize & security" card (`635-652`): expand into a `WinnerSummaryCard` showing the full breakdown table (Chit value → − Prize → = Discount → − Commission → ± GST → = Distributable → ÷ eligible tickets → = Dividend/ticket, plus rounding income), using the shared `components/chits/DividendBreakdown.tsx` component from doc 22a (so this doc and doc 22 render identically — don't build two breakdown UIs). Add "Copy" (clipboard, `formatWinnerSummaryText`) and "Print" (window.print with a dedicated print stylesheet) buttons.
- Distribution-mode-aware copy: `ADJUST_NEXT_DUE` → "Dividend credited to period {n+1} due"; `ACCUMULATE` → "Dividend accrued, no cash movement"; `CASH_PAYOUT` → "Dividend paid in cash — receipt {no}" (fetch the `ChitReceipt` created by `applyDividendDistribution`, `finalize.ts:57-77`, to show the receipt number).

## Mobile (Flutter)

- Both `borrower_chit_live_screen.dart` and `chit_live_auction_screen.dart` already run poll loops; on detecting `auctionStatus` transition to `confirmed`/`completed`, fetch the summary route **once** (not on every poll) and replace `_WinnerCard` (`852`) with a full-screen result sheet: winner name/ticket, prize, discount, commission, dividend, and (member view) "You won! 🎉" or "Ticket #7 won — your dividend: ₹X, credited to your next due" with a share button (native share sheet, using `formatWinnerSummaryText` served from the API so web/mobile text matches).

## Edge cases

- Auction confirmed via draw (lottery/fixed_rotation) rather than bid — `bidDiscount` may be 0 or a fixed value; the summary must still render correctly (calc fields are already populated identically by `finalizeAuctionInTx` regardless of how the winner was selected).
- `NON_WINNERS_ONLY` dividend policy — winner's own dividend is 0/absent; member-audience summary must show "You won — dividend does not apply to the winning ticket this period" rather than a blank/zero figure that reads as a bug.
- Group with `hasForemanTicket` and the foreman ticket wins — same rendering, no special case needed (foreman ticket is just another `ChitMember`).
- Requesting the summary before confirmation (still `pending`/`in_progress`) → 404, client should not show a broken empty state; gate the fetch on status.

## Verification steps

- Unit test `buildWinnerSummary` against a fixture auction for both audiences, asserting figures match `calculateChitAuction` output exactly (no drift between finalize-time persisted numbers and summary-time re-derivation).
- Integration: confirm an auction, hit both summary routes as staff and as the winning/non-winning member, assert 404 pre-confirmation and correct payload post-confirmation.
- Manual: staff web Copy/Print produce readable output; mobile full-screen result sheet appears exactly once per auction (not re-shown on every subsequent poll).

## Dependencies

Depends on doc 22a (`DividendBreakdown` component) for the shared breakdown UI — build 22a first or stub it. Feeds doc 23 (`chit_winner_summary` WhatsApp outbound event uses `formatWinnerSummaryText`).
