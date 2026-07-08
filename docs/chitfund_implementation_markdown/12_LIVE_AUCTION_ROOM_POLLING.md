# Step 12 — Live Auction Room (Polling) and Lottery Draw

> **Implementation status (2026-07-08): NOT IMPLEMENTED.** No room fields on ChitAuction, no live/room/draw routes, no `lib/chits/liveAuction.ts` or `lottery.ts` yet. This doc is the spec; implementing it also closes gaps 1–2 (tie-break, lottery draw) in `IMPLEMENTATION_STATUS_GAP_ANALYSIS.md`.

## Goal

Implement "live beat" — real-time online bidding — for groups with `auctionType = open_live`, plus the audited lottery draw used by `auctionType = lottery` and `tieBreakRule = LOTTERY_AMONG_TIED`.

Deliberate architecture choice: **HTTP polling, not WebSockets/SSE**. The production host is a single VPS behind nginx with PM2 (no sticky-session or push infra). A 2–3 second poll on an auction page with tens of participants is negligible load and works unchanged on web and Flutter. Do not introduce socket infrastructure for this.

## Depends on

- Step 5 (bids, attendance, confirm flow) — the live room only changes **how bids arrive**; winner confirmation, minutes, and payout gating are unchanged.
- Step 11 (`auctionType`, `bidIncrement`, `minDiscountPct`, `maxDiscountPct`, `tieBreakRule`).

## Files to create

```txt
lib/chits/liveAuction.ts
lib/chits/lottery.ts
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/live/page.tsx
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/live/LiveAuctionRoomClient.tsx
app/api/v1/chits/[id]/auctions/[auctionId]/live/route.ts
app/api/v1/chits/[id]/auctions/[auctionId]/room/route.ts
app/api/v1/chits/[id]/auctions/[auctionId]/draw/route.ts
mobile/lib/features/chits/chit_live_auction_screen.dart
```

## Files to update

```txt
prisma/schema.prisma
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx
app/api/v1/chits/[id]/auctions/[auctionId]/bids/route.ts
lib/chits/auction.ts
mobile/lib/data/services/chit_service.dart
mobile/lib/data/models/chit.dart
```

## Schema additions (ChitAuction)

```prisma
biddingOpensAt   DateTime? @map("bidding_opens_at")
biddingClosesAt  DateTime? @map("bidding_closes_at")
autoExtendSeconds Int      @default(0) @map("auto_extend_seconds") // anti-snipe; 0 = off
roomStatus       String    @default("scheduled") @map("room_status") // scheduled, open, extended, closed
```

Room status is separate from auction status (Step 5). Mapping:

| roomStatus | Auction status while in it |
|---|---|
| `scheduled` | `pending` / `notice_sent` |
| `open`, `extended` | `in_progress` |
| `closed` | `completed` (winner picked, awaiting confirm) |

## Room lifecycle

```txt
scheduled --open--> open --bid near close--> extended --time up--> closed
```

1. **Open room** — admin action (`POST .../room` with `{"action":"open","durationMinutes":30}`). Sets `biddingOpensAt = now`, `biddingClosesAt = now + duration`, `roomStatus = open`, auction status `in_progress`. Audit log.
2. **Bidding** — existing Step 5 bid endpoint, extra live validations (below).
3. **Anti-snipe extension** — when `autoExtendSeconds > 0` and a valid bid lands within the final `autoExtendSeconds`, push `biddingClosesAt` forward by `autoExtendSeconds` and set `roomStatus = extended`. Repeats as needed. Prevents last-second sniping.
4. **Close** — two paths, same helper in `lib/chits/liveAuction.ts`:
   - **Lazy auto-close**: any poll or bid request arriving after `biddingClosesAt` first runs `closeRoomIfExpired()`. No cron needed — the polling clients guarantee a request arrives within seconds of expiry.
   - **Manual close**: admin `POST .../room` with `{"action":"close"}` (early close, e.g. all bidders done).
5. On close: winner = highest valid discount via Step 5 `getWinningBid` with the group's `tieBreakRule`; tied-at-top with `LOTTERY_AMONG_TIED` triggers the lottery draw (below) among tied bidders. Auction status → `completed`. **Money is never posted here** — admin still reviews and runs the Step 5 confirm flow, then Step 6 security/payout.

Concurrency: open/close/extend and bid-accept must run inside a transaction that re-reads `roomStatus`/`biddingClosesAt` (`SELECT ... FOR UPDATE` via Prisma `$transaction` + fresh `findFirst`), so two simultaneous requests cannot double-close or accept a bid after close.

## Live poll endpoint

```http
GET /api/v1/chits/:id/auctions/:auctionId/live
```

Called every 2–3 s by web room page and Flutter screen. Runs `closeRoomIfExpired()` first, then returns:

```json
{
  "roomStatus": "open",
  "serverTime": "2026-07-08T10:30:00.000Z",
  "biddingClosesAt": "2026-07-08T10:45:00.000Z",
  "secondsRemaining": 900,
  "minNextDiscount": 26000,
  "highestBid": {
    "ticketNo": "7",
    "memberName": "R. Kumar",
    "bidDiscount": 25000,
    "prizeAmount": 75000,
    "bidTime": "2026-07-08T10:29:41.000Z"
  },
  "bids": [
    { "ticketNo": "7", "memberName": "R. Kumar", "bidDiscount": 25000, "bidTime": "..." },
    { "ticketNo": "3", "memberName": "S. Devi", "bidDiscount": 24000, "bidTime": "..." }
  ],
  "presentCount": 17,
  "totalMembers": 20,
  "winner": null
}
```

- Countdown must be computed from `serverTime`/`secondsRemaining`, never the device clock.
- After close, `winner` carries the provisional winning bid (pre-confirmation).
- Sealed-bid groups (`auctionType = sealed`) reuse this endpoint but `bids` returns only counts (`{"bidCount": 5}`) until `roomStatus = closed`; amounts hidden. `highestBid` is null while open.
- Tenant/branch scope enforced exactly like every Step 9 route.

## Live bid validation (extends Step 5 bid rules)

On `POST .../bids` when the group is `open_live`:

1. `roomStatus` must be `open` or `extended` (after `closeRoomIfExpired()` ran).
2. Discount ≥ `minDiscountPct ?? commissionPct` of chit value.
3. Discount ≤ `maxDiscountPct` of chit value (equal allowed — cap bids feed the tie-break).
4. When `bidIncrement` set: `bidDiscount >= currentHighest + bidIncrement`, except an exact-cap bid which is always accepted (that is how ties at cap form).
5. Bidder's ticket: member of group, not already prized, not `vacant`, not defaulted.
6. Apply anti-snipe extension after accepting.

Bids from the member-facing app (if members get login later) and staff-entered proxy bids share this route; `createdById` records who keyed it.

## Lottery draw — `lib/chits/lottery.ts`

Used by `auctionType = lottery` (whole period is a draw) and `LOTTERY_AMONG_TIED` (draw among tied top bidders).

Fairness requirements — the draw must be reproducible and auditable:

```ts
import { randomBytes, createHash } from 'crypto';

export function drawLotteryWinner(input: {
  candidates: { memberId: string; ticketNo: string }[]; // sorted by ticketNo before draw
  auctionId: string;
}) {
  if (!input.candidates.length) throw new Error('No eligible tickets for draw');
  const seed = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(`${input.auctionId}:${seed}`).digest();
  const index = hash.readUInt32BE(0) % input.candidates.length;
  return { winner: input.candidates[index], seed, index };
}
```

- Persist `seed`, `index`, candidate ticket list, and resulting winner in the audit log (`entityType = chit_auction`, action `lottery_draw`) and store a human line in `ChitAuction.minutesText` (e.g. `Draw among 18 tickets, seed 3f9c…, ticket 12 selected`). Anyone can re-run sha256(auctionId:seed) and verify the index.
- Eligible candidates: active, non-prized, non-vacant, non-defaulted tickets (fragments count as their one ticket).
- Endpoint: `POST /api/v1/chits/:id/auctions/:auctionId/draw` — admin+, only when `auctionType = lottery` and auction not yet completed. Creates a synthetic `ChitBid` row (`status = winning`, `bidDiscount` from `fixedDiscountPct`, remarks = draw evidence) so bid-history reports and the confirm flow work identically to auctions.
- Tie-break usage: same helper, candidates = tied top bidders, called inside room close.

## Web room page

`.../auctions/[auctionId]/live/page.tsx` + `LiveAuctionRoomClient.tsx`:

- Header: group, period, chit value, countdown (server-driven), room status pill.
- Highest-bid banner: ticket, name, discount, prize amount after discount.
- Bid entry (staff): ticket selector (eligible only), prize amount or discount input (either entry auto-fills the other), bid button; disabled when room not open.
- Live bid ledger: newest first, auto-refresh from poll.
- Admin controls: open room (duration picker), extend, close early, draw button (lottery groups).
- On close: provisional winner card + "Go to confirmation" linking to Step 5 auction detail.
- Reuse the existing dashboard polling style (mirror how the tracking-log page refreshes) rather than adding a data-fetch library.

## Mobile (Flutter)

`chit_live_auction_screen.dart`:

- Same poll (2–3 s `Timer.periodic`, cancel on dispose/background).
- Agent: view countdown + ledger; enter bids only when role allows (Step 9 matrix).
- Admin: open/extend/close/draw actions.
- Show "room closed — pending confirmation" state; never show money as final before confirmed.

## RBAC (extends Step 9 matrix)

| Action | Agent | Admin | Superadmin | Developer |
|---|---:|---:|---:|---:|
| View live room | Yes, scoped | Yes | Yes | Yes |
| Place bid in room | Optional (config) | Yes | Yes | Yes |
| Open/extend/close room | No | Yes | Yes | Yes |
| Run lottery draw | No | Yes | Yes | Yes |

## Feature flag

Gate everything behind `CHIT_LIVE_AUCTION_ENABLED` (see Step 0 roadmap). With the flag off, `open_live` groups fall back to `open_manual` behavior (staff entry on the Step 5 auction detail page) — no dead ends.

## Acceptance criteria

- Admin can open a timed bidding room; web and mobile show a server-synced countdown.
- Bids in the room enforce min discount, cap, increment, and eligibility; sealed groups hide amounts until close.
- A bid inside the anti-snipe window extends the close time.
- Room auto-closes lazily on the first request after expiry; no cron dependency; concurrent close/bid is transaction-safe.
- Close selects the provisional winner (tie per `tieBreakRule`) but posts no money; confirm/payout remain Steps 5–6.
- Lottery draw is random, seed-audited, reproducible, and recorded in minutes + audit log.
- All routes tenant/branch/role scoped per Step 9.

## Implementation prompt for coding agent

```txt
Implement Step 12 for the LoanTrack chit-fund module.

Add live auction room fields to ChitAuction (biddingOpensAt, biddingClosesAt, autoExtendSeconds, roomStatus). Build lib/chits/liveAuction.ts with openRoom, closeRoomIfExpired, extendOnAntiSnipe, and a transaction-safe close that selects the provisional winner via getWinningBid honoring the group's tieBreakRule. Build lib/chits/lottery.ts with the seed-audited drawLotteryWinner and a draw API route that records evidence in audit log and minutes.

Add GET .../live polling endpoint (2-3s clients), POST .../room open/close actions, and live validations on the existing bid route (min discount, cap, increment, room open, anti-snipe extension; sealed groups hide bid amounts until close). Build the web live room page and Flutter live auction screen with server-driven countdowns. Never post payout from the room; close hands off to the Step 5 confirm flow. Gate with CHIT_LIVE_AUCTION_ENABLED falling back to open_manual. Enforce Step 9 tenant/branch/role scoping everywhere.
```
