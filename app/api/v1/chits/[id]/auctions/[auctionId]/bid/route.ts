import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  loadScopedGroup,
  ensureAuction,
  nextSeq,
  buildLiveState,
  ANTI_SNIPE_SECONDS,
  LIVE_WRITE_ROLES,
} from '@/lib/chit/liveAuction';

// POST /api/v1/chits/[id]/auctions/[period]/bid — place a bid (reverse auction:
// prizeAmount must be LOWER than the current best by at least minBidDecrement).
// Body: { memberId, prizeAmount, source?, transcript? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  // Phase 4 will relax this so members can POST their own bids from their device.
  if (!LIVE_WRITE_ROLES.includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const periodNumber = Number(auctionId);
  if (!periodNumber) return fail('Invalid period', 400);

  try {
    const group = await loadScopedGroup(id, ctx);
    if (!group) return fail('Chit group not found', 404);

    const body = await req.json().catch(() => ({}));
    const memberId = body.memberId ? String(body.memberId) : '';
    const prizeAmount = Number(body.prizeAmount);
    const source = ['tap', 'voice', 'remote'].includes(body.source) ? body.source : 'tap';
    const transcript = body.transcript ? String(body.transcript).slice(0, 500) : null;
    if (!memberId) return fail('memberId required', 400);
    if (!(prizeAmount > 0)) return fail('prizeAmount must be positive', 400);
    if (prizeAmount >= group.chitValue) return fail('Bid must be below the chit value', 400);

    const auction = await ensureAuction(id, periodNumber);
    if (auction.status !== 'live') return fail('Auction is not live', 409);
    if (auction.endsAt && auction.endsAt.getTime() < Date.now()) {
      return fail('Auction has ended', 409);
    }

    // Member must belong to the group, not have already won, and not have passed
    // this round.
    const member = await prisma.chitMember.findFirst({
      where: { id: memberId, chitGroupId: id },
      select: { id: true, hasWon: true },
    });
    if (!member) return fail('Member not in this chit group', 404);
    if (member.hasWon) return fail('Member has already won a prior period', 409);
    if (auction.startedAt) {
      const lastAction = await prisma.chitBid.findFirst({
        where: { auctionId: auction.id, memberId, kind: { not: 'retracted' }, createdAt: { gte: auction.startedAt } },
        orderBy: { seq: 'desc' },
        select: { kind: true },
      });
      if (lastAction?.kind === 'pass') return fail('Member has passed this round', 409);
    }

    // Current best = lowest prize so far, or the full chit value if no bid yet.
    let currentBest = group.chitValue;
    if (auction.currentBestBidId) {
      const best = await prisma.chitBid.findUnique({
        where: { id: auction.currentBestBidId },
        select: { prizeAmount: true },
      });
      if (best) currentBest = Number(best.prizeAmount);
    }
    const minDec = auction.minBidDecrement != null ? Number(auction.minBidDecrement) : 0;
    if (prizeAmount > currentBest - minDec) {
      return fail(`Bid must be at least ${minDec} below the current best (${currentBest})`, 409);
    }

    const seq = await nextSeq(auction.id);
    const discountAmount = group.chitValue - prizeAmount;
    const bid = await prisma.chitBid.create({
      data: {
        chitGroupId: id,
        auctionId: auction.id,
        periodNumber,
        memberId,
        prizeAmount,
        discountAmount,
        kind: 'bid',
        source,
        transcript,
        seq,
        createdById: ctx.userId,
      },
    });

    // Anti-snipe: a bid in the final seconds extends the clock.
    const data: Record<string, unknown> = { currentBestBidId: bid.id };
    if (auction.endsAt) {
      const remainingMs = auction.endsAt.getTime() - Date.now();
      if (remainingMs < ANTI_SNIPE_SECONDS * 1000) {
        const extended = new Date(Date.now() + ANTI_SNIPE_SECONDS * 1000);
        data.endsAt = extended;
        await prisma.chitAuctionEvent.create({
          data: { auctionId: auction.id, type: 'extend', message: 'Clock extended (late bid)', createdById: ctx.userId },
        });
      }
    }
    await prisma.chitAuction.update({ where: { id: auction.id }, data });

    return ok(await buildLiveState(group, periodNumber));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to place bid', 500);
  }
}
