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

// POST /api/v1/chits/[id]/auctions/[period]/retract
// Body: { memberId } retracts that member's latest non-retracted bid/pass.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!LIVE_WRITE_ROLES.includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const periodNumber = Number(auctionId);
  if (!periodNumber) return fail('Invalid period', 400);

  try {
    const group = await loadScopedGroup(id, ctx);
    if (!group) return fail('Chit group not found', 404);
    const body = await req.json().catch(() => ({}));
    const memberId = body.memberId ? String(body.memberId) : '';
    if (!memberId) return fail('memberId required', 400);

    const auction = await ensureAuction(id, periodNumber);
    if (auction.status !== 'live') return fail('Auction is not live', 409);
    const since = auction.startedAt ?? new Date(0);
    const last = await prisma.chitBid.findFirst({
      where: { auctionId: auction.id, memberId, kind: { not: 'retracted' }, createdAt: { gte: since } },
      orderBy: { seq: 'desc' },
      select: { id: true },
    });
    if (!last) return fail('No member action to retract', 409);

    await prisma.chitBid.update({ where: { id: last.id }, data: { kind: 'retracted' } });
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
      data: {
        auctionId: auction.id,
        type: 'cancel',
        memberId,
        message: 'Member last action retracted',
        createdById: ctx.userId,
      },
    });

    return ok(await buildLiveState(group, periodNumber));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to retract member bid', 500);
  }
}
