# Task 03 — Live Engine: full bid history in state + member retract (Milestone 1)

**Owner:** 1 agent. **Depends on:** 01 (schema merged; actually needs no new columns, can start immediately after 01 confirmed). **Parallel with:** 02, 04.
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first — especially the System A/B split and the "`[auctionId]` segment = period number" convention for System-B routes.

## Goal

1. Expose the **full bid list** in the live-state payload (today only the last 20 `recentBids` are returned) so late joiners get the day's history and the client can build the avatar-tap "this member's bids" sheet (points 12 & 19).
2. Add a **retract-own-last-bid** capability keyed by member (point 11 fallback for when voice/typed entry was wrong), reusing the existing undo/recompute logic.

All in **System B**: `lib/chit/liveAuction.ts` + routes under `app/api/v1/chits/[id]/auctions/[auctionId]/`.

## 1. `allBids` + `memberBids` in `buildLiveState`

File `lib/chit/liveAuction.ts`. The function already fetches every non-retracted bid into a local `allBids` variable but only surfaces `recentBids` (last 20). Surface the full list (capped) plus a per-member grouping.

In `buildStateShape` args + return, add:
```ts
  allBids: Array<{
    id: string; memberId: string; prizeAmount: number; discountAmount: number;
    kind: string; source: string; seq: number; createdAt: string;
  }>;
```
Return it in the shape object.

In `buildLiveState`, after computing `recentBids`, build:
```ts
const allBidsOut = allBids
  .slice(-200)               // hard cap for payload size; a period rarely exceeds this
  .map((b) => ({
    id: b.id,
    memberId: b.memberId,
    prizeAmount: Number(b.prizeAmount),
    discountAmount: Number(b.discountAmount),
    kind: b.kind,
    source: b.source,
    seq: b.seq,
    createdAt: b.createdAt.toISOString(),
  }));
```
Pass `allBids: allBidsOut` into `buildStateShape({ ... })`. Keep `recentBids` as-is (mobile still uses it). Client derives "member X's bids" by filtering `allBids` on `memberId` — **no separate server field needed** for point 19.

Also add `minNextDiscount` to the payload so quick-bid chips (task 05/06) have a server-authoritative floor:
```ts
// In buildStateShape return, alongside minBidDecrement:
minNextPrize: /* lowest legal next prize */,
```
Compute in `buildLiveState`: the current best prize minus `minBidDecrement` (reverse auction — prize goes DOWN), clamped ≥ 0; if no bids yet, `chitValue`. Expose both `minNextPrize` and the current best so the client needn't recompute. Keep names consistent with what mobile `live_auction_screen.dart` already reads (grep it for `minNextDiscount` / `minNextPrize` before naming — if the merged screen already expects a name, use that exact one).

## 2. Member retract route

The staff `undo` route (`app/api/v1/chits/[id]/auctions/[auctionId]/undo/route.ts`) retracts the **globally last** bid, organizer-only. Add a **per-member** retract so a member (or organizer acting for them) can pull back **their own** latest bid without nuking someone else's.

Create `app/api/v1/chits/[id]/auctions/[auctionId]/retract/route.ts` (mirror `undo/route.ts` structure; remember `[auctionId]` here is the **period number**):

```ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { loadScopedGroup, ensureAuction, buildLiveState, LIVE_WRITE_ROLES } from '@/lib/chit/liveAuction';

// POST /api/v1/chits/[id]/auctions/[auctionId]/retract  body: { memberId }
// Retracts the given member's latest active bid this session and recomputes best.
// Staff (LIVE_WRITE_ROLES) may retract for any member; M3 will let a borrower
// retract only their own (enforced in the borrower route, not here).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; auctionId: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!LIVE_WRITE_ROLES.includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const periodNumber = Number(auctionId);
  if (!periodNumber) return fail('Invalid period', 400);
  const body = await req.json().catch(() => null) as any;
  const memberId = body?.memberId ? String(body.memberId) : '';
  if (!memberId) return fail('memberId required', 400);

  try {
    const group = await loadScopedGroup(id, ctx);
    if (!group) return fail('Chit group not found', 404);
    const auction = await ensureAuction(id, periodNumber);
    if (auction.status !== 'live') return fail('Auction is not live', 409);

    const since = auction.startedAt ?? new Date(0);
    const last = await prisma.chitBid.findFirst({
      where: { auctionId: auction.id, memberId, kind: 'bid', createdAt: { gte: since } },
      orderBy: { seq: 'desc' },
      select: { id: true },
    });
    if (!last) return fail('No bid to retract for this member', 409);
    await prisma.chitBid.update({ where: { id: last.id }, data: { kind: 'retracted' } });

    const best = await prisma.chitBid.findFirst({
      where: { auctionId: auction.id, kind: 'bid', createdAt: { gte: since } },
      orderBy: [{ prizeAmount: 'asc' }, { seq: 'desc' }],
      select: { id: true },
    });
    await prisma.chitAuction.update({ where: { id: auction.id }, data: { currentBestBidId: best?.id ?? null } });
    await prisma.chitAuctionEvent.create({
      data: { auctionId: auction.id, type: 'cancel', message: 'Bid retracted', memberId, createdById: ctx.userId },
    });
    return ok(await buildLiveState(group, periodNumber));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to retract', 500);
  }
}
```

## 3. (Optional, low-risk) typed-bid parity

The existing `bid` route already accepts a numeric `prizeAmount` with `source` (`tap|voice|remote`). **No change needed** for typed entry — the client just posts the typed number with `source:'tap'`. Confirm the route does not require a `transcript` (it should be optional). If it rejects missing transcript, relax it. Do not add a new endpoint.

## Acceptance criteria

- `state` route payload now includes `allBids` (full, capped 200) and a `minNextPrize` (or the existing name the mobile screen expects). `recentBids` unchanged.
- New `retract` route retracts a specific member's last bid, recomputes `currentBestBidId`, logs a `cancel` event, returns fresh state; 409 when that member has no active bid; 403 for non-staff.
- `npm run typecheck` passes.
- Manual: with two members bidding, retract member A's bid → best recomputes to member B's (or null), member B's bid untouched.

## Handoff

- Task 05 (web) and 06 (mobile) consume `allBids` for the history panel + avatar sheet, `minNextPrize` for quick-bid chips, and call `retract`.
- Task 09 (M3 borrower) adds a borrower-scoped wrapper that forces `memberId = own membership` and drops the staff role check.

## Commit

```
feat(chit): expose full bid history in live state + per-member bid retract

buildLiveState returns allBids (capped 200) and minNextPrize so clients can
render day history, avatar-tap member bids, and quick-bid chips. New retract
route pulls back one member's latest bid and recomputes the best.
```
