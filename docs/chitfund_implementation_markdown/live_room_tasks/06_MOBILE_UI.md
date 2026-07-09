# Task 06 — Mobile UI: quick-bid chips, history & avatar sheets, schedule, room polish (Milestone 1)

**Owner:** 1 agent. **Depends on:** 03 (`allBids`/`minNextPrize` in state), 04 (schedule endpoint/service).
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first — especially which Flutter screen is which.

## Which screen

- **`mobile/lib/features/chits/live_auction_screen.dart`** — the **router-wired** poker-table screen (route `/chits/:id/auction/:period/live`, `app_router.dart`). It uses the System-B `LiveAuctionState` model (`mobile/lib/data/models/chit_live.dart`) and the service's `liveAuctionState/submitBid/passMember/undoBid/closeAuction/openAuction`. **This is the primary screen — do the work here.**
- `mobile/lib/features/chits/chit_live_auction_screen.dart` is the secondary Map-based screen reached from the detail sheet. Apply the same three additions if time permits, but prioritize the router-wired one.

Grep the poker screen for how it reads state (`_state`, `recentBids`, `currentBest`, `seats`) before adding fields, and match its existing widget style (`AppColors`, `AppTypography`, `AppTokens`).

## Model: `mobile/lib/data/models/chit_live.dart`

Add parsing for the new state fields (task 03):
- `allBids` → `List<LiveBid>` (id, memberId, prizeAmount, discountAmount, kind, source, seq, createdAt). If a `LiveBid`/`recentBids` model already exists, reuse it and just add an `allBids` list.
- `minNextPrize` → `double?`.
Keep it null-safe (old payloads / idle shell may omit them).

## Service: `mobile/lib/data/services/chit_service.dart`

- Add `reschedule(String groupId, String auctionId, DateTime when)` → POST/PATCH `Endpoints.chitAuctionSchedule(groupId, auctionId)` body `{ 'scheduledAt': when.toUtc().toIso8601String() }` (task 04 provides the endpoint constant + route).
- Add `retractMemberBid(String groupId, int period, String memberId)` → POST `Endpoints.chitAuctionRetract(groupId, period)` body `{ 'memberId': memberId }`, returns `LiveAuctionState`. (Add `chitAuctionRetract` to `endpoints.dart` = `/chits/$id/auctions/$period/retract`.)
- Typed bid already covered by `submitBid(..., source:'tap')`.

## Screen additions (`live_auction_screen.dart`)

1. **Quick-bid chip row (point 13)** above/around the table: from `state.minNextPrize` + group `bidIncrement` (or fallback 500), render 3–4 `ActionChip`s (`Min`, `+1`, `+2`, `+5` steps → prize = minNextPrize − k*step, clamped ≥ 0). One tap → `submitBid(groupId, period, memberId: myMemberId, prizeAmount: prize, source:'tap')`. For the organizer/staff view, the "current bidder" is chosen via the existing seat-tap flow; for member mode (M3) `myMemberId` is fixed. Keep chips large and thumb-friendly (point 20).

2. **Bid history bottom sheet (point 12):** a "History" button opens a `showModalBottomSheet` (`showModalBottomSheet<void>(...)`) listing `state.allBids` newest-first: ticket/name, prize, discount, `HH:mm:ss`, and a source icon (`Icons.mic` voice / `Icons.touch_app` tap / `Icons.wifi` remote). Scrollable, dismissible.

3. **Avatar-tap member sheet (point 19):** tapping a seat avatar opens a bottom sheet with that member's name and their bids this session: `state.allBids.where((b) => b.memberId == seat.memberId)` sorted by seq — amount + time each. If the viewer is staff/organizer, add a **Retract last** button → `retractMemberBid(groupId, period, seat.memberId)` then re-poll.

4. **Spectator state (point 15):** if the viewer's member `hasWon` (seat flag), disable bid chips/mic and show a chip "Watching — already won".

5. **Fast polling (point 18):** confirm the poll timer is ≤ 1500ms while the room is `live`/`open`; the server countdown seeds `_secondsAtPoll` and a 1s local ticker interpolates (the merged screen already does this — keep it).

Do **not** touch voice recording here — that is task 08 (M2). Typed + chips + tap must fully work without a mic (point 13).

## Reschedule entry (mobile)

In the chit **detail** screen (`chit_detail_screen.dart`) auction manage sheet, add a "Reschedule" tile for pending auctions → `showDatePicker` + `showTimePicker` → `svc.reschedule(groupId, auctionId, combined)` → refresh. (Detail screen already has an auction manage bottom-sheet from prior work — add one `ListTile`.)

## Verification

```bash
cd mobile && dart analyze lib/features/chits lib/data/services/chit_service.dart lib/data/models/chit_live.dart
dart format lib/features/chits lib/data/services/chit_service.dart lib/data/models/chit_live.dart lib/shared/constants/endpoints.dart
```
Manual (against a dev server with an open `open_live` auction): chips place bids; history sheet lists all bids; avatar sheet shows one member's bids; won member sees spectator chip; reschedule updates the auction.

## Acceptance criteria

- `dart analyze` reports 0 errors for the touched files (pre-existing info/warnings OK).
- Chips, history sheet, avatar sheet, spectator state work with no mic.
- Reschedule from the detail sheet updates schedule.

## Commit

```
feat(chit-mobile): quick-bid chips, bid history & avatar sheets, reschedule

Live poker screen gains one-tap quick-bid chips (mic-free), a full bid-history
bottom sheet for late joiners, an avatar-tap sheet showing a member's session
bids with organizer retract, and a spectator state for members who already won.
Detail screen gains auction reschedule. Service + model parse allBids/minNextPrize.
```
