import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  loadScopedGroup,
  ensureAuction,
  buildLiveState,
  LIVE_WRITE_ROLES,
} from '@/lib/chit/liveAuction';

// POST /api/v1/chits/[id]/auctions/[period]/undo — retract the last bid/pass and
// recompute the current best.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; period: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!LIVE_WRITE_ROLES.includes(ctx.role)) return fail('Forbidden', 403);
  const { id, period } = await params;
  const periodNumber = Number(period);
  if (!periodNumber) return fail('Invalid period', 400);

  try {
    const group = await loadScopedGroup(id, ctx);
    if (!group) return fail('Chit group not found', 404);

    const auction = await ensureAuction(id, periodNumber);
    if (auction.status !== 'live') return fail('Auction is not live', 409);

    const since = auction.startedAt ?? new Date(0);
    const last = await prisma.chitBid.findFirst({
      where: { auctionId: auction.id, kind: { not: 'retracted' }, createdAt: { gte: since } },
      orderBy: { seq: 'desc' },
      select: { id: true },
    });
    if (!last) return fail('Nothing to undo', 409);

    await prisma.chitBid.update({ where: { id: last.id }, data: { kind: 'retracted' } });

    // Recompute the best (lowest-prize active bid).
    const best = await prisma.chitBid.findFirst({
      where: { auctionId: auction.id, kind: 'bid', createdAt: { gte: since } },
      orderBy: [{ prizeAmount: 'asc' }, { seq: 'desc' }],
      select: { id: true },
    });
    await prisma.chitAuction.update({
      where: { id: auction.id },
      data: { currentBestBidId: best?.id ?? null },
    });
    await prisma.chitAuctionEvent.create({
      data: { auctionId: auction.id, type: 'cancel', message: 'Last action undone', createdById: ctx.userId },
    });

    return ok(await buildLiveState(group, periodNumber));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to undo', 500);
  }
}
