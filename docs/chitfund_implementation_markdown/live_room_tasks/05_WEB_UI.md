# Task 05 — Web UI: form, group cards, room button, reschedule, live-room polish (Milestone 1)

**Owner:** 1 agent. **Depends on:** 01, 02 (validation), 03 (`allBids`/`minNextPrize` in state), 04 (`rescheduleAuction`, `auctionTime`/`winnerInterest*` in create).
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first.

## Files

- `app/(dashboard)/[module]/chits/new/ChitGroupForm.tsx` — add auction time + winner-interest fields.
- `app/(dashboard)/[module]/chits/page.tsx` — group list → cards with next-auction schedule + Enter room.
- `app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx` — Enter-room button + per-auction Reschedule.
- `app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx` — quick-bid chips, bid-history panel, avatar-tap sheet, spectator banner, 1.5s poll.

Match the existing style: inline styles + `.card`/`.btn`/`.form-control`/`.badge` classes, `formatCurrency`/`formatDate` from `@/lib/utils`, server actions imported from `../actions` (or `../../../actions`). No new CSS framework.

## 1. `ChitGroupForm.tsx`

**Section 2 (Chit style)** — add an **auction time** input next to frequency:
```tsx
<div className="form-group">
  <label className="form-label">Auction time</label>
  <input name="auctionTime" type="time" className="form-control" defaultValue="10:00" />
  <p style={hintStyle}>Default start time for every auction. Editable per period later.</p>
</div>
```

**Section 5 (draw/dividend rules)** — when `auctionType` is `lottery` or `fixed_rotation` (you already branch on `isDrawType`), add a winner-interest block:
```tsx
{isDrawType && (
  <>
    <div className="form-group">
      <label className="form-label">Winner interest</label>
      <select name="winnerInterestType" className="form-control" value={winnerInterestType} onChange={(e) => setWinnerInterestType(e.target.value)}>
        <option value="NONE">None</option>
        <option value="FIXED">Fixed ₹ per period</option>
        <option value="PERCENT">% of chit value per period</option>
      </select>
      <p style={hintStyle}>Non-bidding winner repays a surcharge on future installments, like a small loan.</p>
    </div>
    {winnerInterestType !== 'NONE' && (
      <>
        <div className="form-group">
          <label className="form-label">{winnerInterestType === 'FIXED' ? `Amount per period (${currencySymbol})` : 'Percent per period (%)'}</label>
          <input name="winnerInterestValue" type="number" step="0.01" min="0" className="form-control" value={winnerInterestValue} onChange={(e) => setWinnerInterestValue(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">For how many periods</label>
          <input name="winnerInterestPeriods" type="number" min="1" className="form-control" placeholder="blank = until group ends" value={winnerInterestPeriods} onChange={(e) => setWinnerInterestPeriods(e.target.value)} />
        </div>
      </>
    )}
  </>
)}
```
Add a **live preview** line under the block, computing per-period + window from the entered values and `chitValue`/`totalMembers`:
```
Winner pays ₹11,000 from the next period for 6 periods (base ₹10,000 + interest ₹1,000).
```
(perPeriod = FIXED→value; PERCENT→chitValue*value/100. base = monthlyContrib. Show `base + perPeriod`.)

Add the three `useState`s (`winnerInterestType='NONE'`, `winnerInterestValue=''`, `winnerInterestPeriods=''`). The fields post via the existing `FormData` submit — no action change needed (task 04 reads them in `createChitGroup`).

## 2. `chits/page.tsx` — group cards

Today this is a table/list. Convert each group to a **card** (point 5). The page is a server component that loads groups; extend its query to include the **next pending auction** per group:
```ts
auctions: {
  where: { status: { in: ['pending', 'notice_sent'] } },
  orderBy: { periodNumber: 'asc' },
  take: 1,
  select: { id: true, periodNumber: true, scheduledAt: true, auctionDate: true, roomStatus: true },
},
```
Card contents:
- Name + status badge.
- Chit value · installment · members `X/total`.
- **Next auction**: `🗓 {formatDate(scheduledAt)} · {time}` (format `scheduledAt` to `DD MMM, h:mm A`; if null show "Not scheduled").
- Auction type chip (Open live / Lottery / …).
- **Enter room** button (link to `/chits/{groupCode ?? id}/auctions/{nextAuction.id}`) shown when `auctionType === 'open_live'` and next auction `roomStatus` in `scheduled|open|extended`. Otherwise a "View" link to the detail page.

Keep it responsive: a CSS grid of cards (`display:grid; gridTemplateColumns: repeat(auto-fill, minmax(280px,1fr)); gap:16px`).

## 3. `ChitGroupDetailClient.tsx`

- Add a prominent **Enter chit room** button near the top for the next pending `open_live` auction (link to that auction's detail page). Reuse the group's auctions already passed in.
- In the auctions table, add a **Reschedule** action (clock icon) per row where `status` ∈ `pending|notice_sent`. Clicking opens a small modal with a `datetime-local` input defaulting to the row's `scheduledAt`; on save call `rescheduleAuction(auction.id, new Date(value).toISOString())` (import from `../actions`), then `router.refresh()`. Follow the existing modal + `run(label, fn)` pattern already in this file.

## 4. `AuctionDetailClient.tsx` — live-room polish

This client already polls `getLiveAuctionState` every 2.5s and renders the live room. Changes:

- **Poll interval 1500ms** while `roomActive` (point 18). Change the `setInterval(tick, 2500)` to `1500`.
- **Quick-bid chips (point 13):** from state `minNextPrize` (task 03) + `bidIncrement`, render a row of one-tap chips when the room is open and the current user's member is eligible (not won). Chips:
  - `Min` → prize = `minNextPrize`.
  - `+1 step` / `+2 step` / `+5 step` → prize = `minNextPrize - k*step` where `step = bidIncrement || 500` (reverse auction: lower prize = higher discount = stronger bid), clamped ≥ 0.
  Each chip calls the same `addAuctionBid(auction.id, memberId, prize)` used by the manual form. Keep the manual numeric input too (typed fallback, point 11) — it already exists.
- **Bid history panel (point 12):** a collapsible "Bid history ({allBids.length})" section listing `live.allBids` newest-first: ticket/name, prize, discount, time, and a source icon (🎤 voice / 👆 tap / 🖥 remote). This is the day/period history a late joiner reads. Use `live.allBids` (task 03).
- **Avatar-tap member sheet (point 19):** clicking a member's name/avatar in the seat list or history opens a modal listing **that member's** bids this session: `live.allBids.filter(b => b.memberId === m.id)` sorted by seq, each with amount + time. If organizer, include a **Retract last** button that calls the `retract` route (task 03) — expose via a new server action `retractMemberBid(auctionId, memberId)` in `actions.ts` OR call the API route; prefer a thin server action mirroring `confirmAuction` for consistency.
- **Spectator banner (point 15):** if the viewing user's member `hasWon`, show a banner "You've already won a period — watching only" and hide bid controls for them. (Server already rejects their bid; this is UX.)
- **Optimistic append (point 18):** on a chip/typed bid, immediately append a provisional row to the local bid list (greyed) before the poll echoes it, then reconcile on next state. Keep it simple — a local `pendingBids` array cleared when the server list contains a matching bid.

## Acceptance criteria (web, manual)

1. Create a lottery group with time 17:00, FIXED 1000 × 6 → form preview shows "₹11,000 … for 6 periods"; activation succeeds.
2. Chits page shows the group as a card with "🗓 … 5:00 PM" and an Enter-room/View button.
3. Detail page: Reschedule a pending auction to a new date/time → row updates, audit written.
4. Open a live (`open_live`) auction room: quick-bid chips place bids one-tap; bid-history panel lists all bids; clicking a member shows their bids; a won member sees the spectator banner; countdown ticks from `serverNow`.
5. `npm run typecheck` passes; no console errors in the room.

## Commit

```
feat(chit-web): scheduled auctions, group cards, room polish

Group form gains auction time + winner-interest fields with live preview;
chits page renders cards with next-auction schedule and Enter-room; detail
page adds Enter-room + per-auction Reschedule; live room adds quick-bid
chips, full bid-history panel, avatar-tap member bids, spectator state, and
1.5s polling with optimistic bid append.
```
