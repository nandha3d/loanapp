# Step 14 — Organizer Bell ("Going Once / Twice / Sold")

> **Implementation status (2026-07-14): NOT IMPLEMENTED.** No bell fields, no `lib/chits/bell.ts`, no bell events. This is net-new engine work layered on top of the existing polling live room (`lib/chits/liveAuction.ts`).

## Goal

Traditional physical chit auctions use a bell/gavel: after bidding goes quiet, the organizer rings a bell up to N times (classically 3 — "going once, going twice, sold"); a new bid resets the count. Requested: manual ring + automatic ring after each quiet interval, customizable interval and count, default **3 times / 1 minute**, and — per the user's locked-in decision — whether the room **auto-closes** after the final bell with no new bid is a **per-group configurable toggle** (not hardcoded).

## Architecture constraint (critical)

The live room is deliberately **HTTP polling only** (`lib/chits/liveAuction.ts:1-3`: staff 1.5s, customer mobile 2.5s) — no sockets, no server-side timers/cron for in-room mechanics. Bells must therefore be **lazily evaluated from timestamps on every poll/bid**, exactly like `closeRoomIfExpired`. Do not implement bells with `setTimeout`/cron; a bell "due" at T is computed as "has enough wall-clock time passed since the anchor," and the actual DB write happens on whichever poll or bid request lands first after T.

## Schema changes

```prisma
model ChitGroup {
  // ...existing fields...
  bellEnabled        Boolean @default(true)  @map("bell_enabled")
  bellIntervalSeconds Int    @default(60)     @map("bell_interval_seconds")
  bellCount           Int    @default(3)      @map("bell_count")
  bellAutoClose       Boolean @default(true)  @map("bell_auto_close")
}

model ChitAuction {
  // ...existing fields...
  bellAnchorAt DateTime? @map("bell_anchor_at")  // reset on room open + every new bid
  bellsRung    Int       @default(0) @map("bells_rung")
}
```

`bellAutoClose` default `true` matches the traditional "sold on the third bell" behaviour the client described; groups that want the room to just linger until manual close (e.g. multi-hour informal auctions) can turn it off per group.

## Backend design

New `lib/chits/bell.ts`:

```ts
export type BellState = {
  bellsRung: number;
  bellCount: number;
  nextBellDue: Date | null;   // null once bellsRung === bellCount
  lastBellAt: Date | null;
};

// Lazy, timestamp-derived — mirrors closeRoomIfExpired's pattern exactly.
export async function evaluateBells(tx: any, auctionId: string, now = new Date()) {
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: { id: true, roomStatus: true, bellAnchorAt: true, bellsRung: true,
      chitGroup: { select: { bellEnabled: true, bellIntervalSeconds: true, bellCount: true, bellAutoClose: true } } },
  });
  if (!fresh || !['open', 'extended'].includes(fresh.roomStatus)) return fresh;
  const g = fresh.chitGroup;
  if (!g.bellEnabled || !fresh.bellAnchorAt) return fresh;

  const elapsedIntervals = Math.floor((now.getTime() - fresh.bellAnchorAt.getTime()) / (g.bellIntervalSeconds * 1000));
  const due = Math.min(g.bellCount, Math.max(0, elapsedIntervals));
  if (due <= fresh.bellsRung) return fresh;

  // Optimistic-concurrency guard: only advance if bellsRung still matches what we read,
  // so two overlapping poll requests can't both write duplicate bell events.
  const updated = await tx.chitAuction.updateMany({
    where: { id: auctionId, bellsRung: fresh.bellsRung },
    data: { bellsRung: due },
  });
  if (updated.count === 0) return fresh; // lost the race, another request already advanced it

  // One event per bell number crossed (handles a poll that skips over more than one interval).
  for (let n = fresh.bellsRung + 1; n <= due; n++) {
    await tx.chitAuctionEvent.create({
      data: { auctionId, type: 'bell', message: `Bell ${n} of ${g.bellCount}`,
        // Backdated to the actual due time, not "now", so the timeline (doc 17) reads correctly.
        createdAt: new Date(fresh.bellAnchorAt.getTime() + n * g.bellIntervalSeconds * 1000) },
    });
  }

  if (due >= g.bellCount && g.bellAutoClose) {
    await closeAuctionRoom(tx, auctionId); // existing helper, liveAuction.ts:74
  }
  return { ...fresh, bellsRung: due };
}

export async function ringBellManually(tx: any, auctionId: string, byUserId: string, now = new Date()) {
  // Re-anchor so the NEXT automatic bell is exactly one interval after this manual ring,
  // not skipped/duplicated by the lazy evaluator on the following poll.
}

export async function syncRoom(tx: any, auctionId: string, now = new Date()) {
  await evaluateBells(tx, auctionId, now);
  return closeRoomIfExpired(tx, auctionId, now); // existing helper, liveAuction.ts:54
}
```

`syncRoom()` becomes the **single call site** that replaces every bare `closeRoomIfExpired(tx, auctionId)` currently in:
- `actions.ts:1050` (`openLiveRoom`) — after opening, also set `bellAnchorAt = now`, `bellsRung = 0`.
- `actions.ts:1098` (`getLiveAuctionState` poll)
- `customerAuction.ts:32` (`buildCustomerLiveState` poll)
- `customerPortal.ts:83` (`getMyChitAuctionStatus`)
- **Inside `placeChitBid`** (`bidService.ts:65-79`) — call `syncRoom` instead of just `closeRoomIfExpired` before the `isRoomOpen` check, so a bid arriving after the final auto-close bell is correctly rejected with "Bidding room is not open" rather than racing the close.
- **Every accepted bid resets the anchor**: after a bid is created in `placeChitBid` (`bidService.ts:97-113`), also `update({ data: { bellAnchorAt: new Date(), bellsRung: 0 } })` on the auction — a new bid means the countdown to "sold" starts over.

## Web UI

- `AuctionDetailClient.tsx` room-controls area (`165-199`): add interval/count/auto-close inputs to the "Open room" dialog (or the group settings form, since these are per-group defaults — decide during implementation whether per-auction override is needed; default is group-level only, no per-auction override, to keep this simple).
- During an open room: a bell indicator showing `bellsRung / bellCount`, a manual "Ring bell 🔔" button (staff role only, calls new `ringBell(auctionId)` action), and a countdown to the next automatic bell derived from `bellAnchorAt + bellsRung*intervalSeconds` vs `serverTime` (never the device clock, same rule as the existing room countdown).
- Play a chime + show a toast/banner ("Going once!" / "Going twice!" / "Sold to ticket #7!") when the poll response's `bellsRung` increases since the last poll — client compares previous vs new value, does not re-chime on an unchanged count.

## Mobile (Flutter)

- `borrower_chit_live_screen.dart` (poll+tick timers at 53-76): same bell state added to the poll payload; play a system sound via `audioplayers` (already a dependency for the voice-bid feature) on `bellsRung` increase; show the same going-once/twice/sold banner.
- `chit_live_auction_screen.dart` (staff mobile): same, plus the manual ring button for staff role.

## Poll payload additions

Both `getLiveAuctionState` (`actions.ts`) and `buildCustomerLiveState` (`customerAuction.ts`) gain:

```json
"bell": { "enabled": true, "bellsRung": 1, "bellCount": 3, "intervalSeconds": 60, "nextBellAt": "2026-07-14T10:31:00.000Z", "autoClose": true }
```

## Edge cases

- Room opened with `bellEnabled=false` → `bellAnchorAt` still set (harmless) but `evaluateBells` short-circuits immediately; no bell UI shown.
- Manual ring when `bellsRung` already `== bellCount` → no-op (room should already be closing/closed via autoClose, or waiting for manual close).
- `bellAutoClose=false` and final bell rung → room stays open indefinitely until staff manually closes; UI should show "Final bell rung — awaiting manual close" so staff isn't confused why nothing happened.
- Anti-snipe extension (`antiSnipeExtension`, `liveAuction.ts:20-28`) and bell auto-close both derive a close time — when both are active, the room's **effective** close is whichever is later is wrong; actually the correct behaviour is: anti-snipe protects against last-second sniping on the room's `biddingClosesAt` deadline, while bells are an independent "quiet period" mechanism. Treat them as two independent close triggers — either one closing the room is sufficient (`closeRoomIfExpired` handles the `biddingClosesAt` deadline; `evaluateBells` handles the bell-triggered close). A bid resets both (extends `biddingClosesAt` via anti-snipe AND resets `bellAnchorAt`).
- Concurrent poll requests: the `updateMany({ where: { bellsRung: fresh.bellsRung } })` guard (optimistic concurrency) prevents duplicate bell events under the two-tab race the existing `closeRoomIfExpired` already handles the same way for room close.

## Verification steps

- Unit test `evaluateBells` due-math: given `bellAnchorAt` N seconds ago and `intervalSeconds`/`bellCount`, assert correct `due` count including the "poll skipped over multiple intervals" case (e.g. staff tab left idle for 5 minutes with a 60s interval, 3-bell cap — must land at exactly 3, not 5).
- Unit test the race guard: two concurrent `evaluateBells` calls against the same pre-bell state must produce exactly one set of bell events (assert via a second call after the first "wins" returns `updated.count === 0`).
- Integration: two-browser-tab manual test — open room with interval=5s, count=3, autoClose=true; let it sit quiet; assert exactly 3 `ChitAuctionEvent(type:'bell')` rows created, then room auto-closes; place a bid after bell 1 and confirm `bellsRung` resets to 0 and a 4th bell does not fire prematurely.
- Integration: `bellAutoClose=false` — after 3rd bell, room stays `open`/`extended`, staff manual close still works.

## Dependencies

Depends on nothing new (builds directly on existing `liveAuction.ts`/`bidService.ts`). Doc 17 (timeline) depends on this for rendering bell events. Doc 23 (WhatsApp bids) depends on this because a WA-submitted bid must also go through `syncRoom`/bell-reset via the shared `placeChitBid`.
