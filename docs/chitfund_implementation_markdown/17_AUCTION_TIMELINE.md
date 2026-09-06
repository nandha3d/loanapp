# Step 17 — Complete Auction Timeline (Bids, Bells, Opens, Extends, by Whom)

> **Implementation status (2026-07-14): PARTIAL.** Bid history exists (`ChitBid` rows, plus a report builder `buildChitBidHistory`); room lifecycle events (open/extend/bell/close/pass/retraction) are largely NOT persisted as a queryable trail today. This doc adds the merged, chronological, audience-scoped timeline.

## Goal

Requested: "complete bid history by time, bid amount, by whom, and bell events." One chronological feed per auction covering every bid, every bell, room open/extend/close, passes, and retractions — for staff (full detail) and for members (scoped, no other members' private organizer chat, no denied-admission details of others).

## Current state (verified)

- `ChitBid` (`schema.prisma:1316-1351`) — has `bidTime`, `source`, `status` (`valid`/`winning`/`retracted`), `remarks`, `createdById`, `seq`. Already a solid per-bid audit trail; queried in `getLiveAuctionState` (`actions.ts:1101-1145`) and reported via `lib/reports/builders/chit-production-reports.ts:205-245` (`buildChitBidHistory`).
- `ChitAuctionEvent` (`schema.prisma:1355-1368`) — model comment already says "every open/extend/announce/pass/close/winner/cancel event, in order" but **no code currently writes to it** for the live-polling room path (`openAuctionRoom`/`closeRoomIfExpired`/`closeAuctionRoom` in `liveAuction.ts` update `ChitAuction` fields directly, they don't create `ChitAuctionEvent` rows). This is the gap to close — the model exists, the writes don't happen yet.
- `ChitRoomMessage` (`schema.prisma:1446-1461`) has `visibility: 'public' | 'organizer'` — organizer-only chat must never leak to a member-audience timeline.
- Doc 14 (bell engine) will write `ChitAuctionEvent(type:'bell')` rows — this doc's timeline builder is what renders them, so bells become visible without doc 17 doing any bell-specific work itself.
- `AuctionDetailClient.tsx` seat modal (`855-895`) shows a per-member bid list already but it's local/inline, not a full chronological cross-type feed.
- Mobile `_MyBidHistory` (`borrower_chit_live_screen.dart:816`) is scoped to the viewing member's own bids only.

## Schema changes

None — `ChitAuctionEvent` already has the right shape (`type`, `message`, `memberId`, `amount`, `createdById`, `createdAt`). This doc is pure backend logic (start writing events) + a new read/merge builder.

## Backend design

1. **Start writing events going forward** at the existing room-lifecycle call sites (additive, doesn't change their return behaviour):
   - `openAuctionRoom` (`liveAuction.ts:30-49`) → `ChitAuctionEvent{type:'open', message:'Room opened', createdById}`.
   - Anti-snipe extension branch in `placeChitBid` (`bidService.ts:72-78`) → `ChitAuctionEvent{type:'extend', message:'Anti-snipe extension', amount: newCloseDelta}`.
   - `closeRoomIfExpired`/`closeAuctionRoom` (`liveAuction.ts:54-89`) → `ChitAuctionEvent{type:'close', message: auto ? 'Auto-closed (time expired)' : 'Manually closed'}`.
   - `retractLiveMemberBid` (`actions.ts:632`) → `ChitAuctionEvent{type:'pass', message:'Bid retracted', memberId}` (retraction already flips `ChitBid.status='retracted'`; this adds the timeline-visible event).
   - Winner finalize (`finalize.ts:151-153`) → `ChitAuctionEvent{type:'winner', memberId: selectedBid.memberId, amount: calc.prizeAmount}`.
   - Doc 14's `evaluateBells` already writes `type:'bell'` events (see doc 14) — no extra work here.

2. New `lib/chits/timeline.ts`:
   ```ts
   export async function buildAuctionTimeline(auctionId: string, opts: { audience: 'staff' | 'member'; memberId?: string; cursor?: string; limit?: number }) {
     const limit = Math.min(opts.limit ?? 100, 300);
     const [bids, events, messages] = await Promise.all([
       prisma.chitBid.findMany({ where: { auctionId }, include: { member: { include: { customer: { select: { name: true } } } } }, orderBy: { bidTime: 'desc' }, take: limit }),
       prisma.chitAuctionEvent.findMany({ where: { auctionId }, orderBy: { createdAt: 'desc' }, take: limit }),
       opts.audience === 'staff'
         ? prisma.chitRoomMessage.findMany({ where: { auctionId }, orderBy: { createdAt: 'desc' }, take: limit })
         : prisma.chitRoomMessage.findMany({ where: { auctionId, visibility: 'public' }, orderBy: { createdAt: 'desc' }, take: limit }),
     ]);
     // Merge all three into one array tagged with a discriminant `kind`, sort by timestamp desc, cap at `limit`.
     // Member audience additionally: redact other members' bid amounts only if the group is sealed-type and still open
     // (reuse the existing `sealed` gating already used in getLiveAuctionState/buildCustomerLiveState — don't invent new rules).
   }
   ```

3. **Historical auctions with no events yet** (everything that ran before this ships): synthesize a minimal `open`/`close` pair from `auction.startedAt`/`completedAt` so old auctions still show *something* in the timeline rather than an empty gap — clearly labeled as reconstructed (e.g. `message: 'Room opened (reconstructed)'`) rather than pretending it's a real audit event.

## API routes

- `app/api/v1/chits/[id]/auctions/[auctionId]/timeline/route.ts` (staff/mobile-staff) → `buildAuctionTimeline(auctionId, { audience: 'staff' })`.
- `app/api/v1/borrower/chits/[groupId]/auctions/[auctionId]/timeline/route.ts` (borrower, memberId from session) → `buildAuctionTimeline(auctionId, { audience: 'member', memberId })`.
- Cursor-paginate past the initial 100-300 cap for long-running/high-activity auctions (`cursor` = last-seen composite timestamp+id).

## Web UI

- `AuctionDetailClient.tsx`: new collapsible "Auction activity" section (reuse `components/ui/Collapse.tsx` from doc 22b once it exists, or ship a minimal inline `<details>` first and swap later) below the poker table, rendering the merged feed with icons per `kind`/`type` (💰 bid, 🔔 bell, 🚪 open/close, ⏱ extend, ↩ retracted, 🏆 winner, 💬 message). **Not** part of the hot 1.5s poll loop — fetch on-demand when the section is expanded, and refresh only on a slower interval (e.g. every 5-10s while expanded) or on explicit refresh, to avoid adding load to the already-frequent room poll.

## Mobile (Flutter)

- Extend `_MyBidHistory` (`borrower_chit_live_screen.dart:816`) into a full "Auction activity" bottom sheet reachable from a new button, calling the borrower timeline route; keep the existing always-visible `_MyBidHistory` as the lightweight "my bids only" view for the common case, with the full timeline as an opt-in deeper view (mirrors the web's collapsible pattern).
- `chit_live_auction_screen.dart` (staff mobile): same feed, staff audience (sees organizer messages + all members).

## Edge cases

- Sealed auctions (`auctionType='sealed'`) still open: member-audience timeline must hide bid amounts/who's-leading exactly like the existing live-state builders already do — do not let the timeline become a side-channel that leaks sealed bids before close.
- A denied waiting-room admission (`decideRoomAdmission`, `actions.ts:1227`) is **not** a timeline event type by default — the user's locked-in scope for this feature was bid/bell/open/extend/pass/close history, not admission decisions; skip unless a later request asks for it, to avoid scope creep.
- Very high-activity auctions (large groups, many bells/retractions) — the 100-300 row cap + cursor keeps the initial payload bounded; make sure the merge-sort doesn't silently drop newer events in favor of older ones when truncating each source query (`take: limit` on each of the 3 queries before merging, then re-cap after merge, could theoretically under-represent one type if it dominates recent activity — acceptable tradeoff, document it rather than over-engineer).

## Verification steps

- Unit test the merge/sort logic with fixture bids+events+messages interleaved out of insertion order, assert correct chronological output and correct `kind` tagging.
- Integration: run a full auction (open → bids → bell → extend → close → confirm) through the real engine, fetch the staff timeline, assert every lifecycle step appears exactly once with correct ordering and actor attribution.
- Integration: same auction, fetch as a non-winning member — assert organizer-only messages and (if sealed) other members' bid amounts are absent.
- Manual: a pre-existing (pre-migration) confirmed auction with no `ChitAuctionEvent` rows still renders a reasonable reconstructed open/close pair.

## Dependencies

Depends on doc 14 (bell events) for bell rows to exist; otherwise independent. Should land in Phase 2 right after bells.
