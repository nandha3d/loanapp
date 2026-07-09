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

// POST /api/v1/chits/[id]/auctions/[period]/close — declare the winner and settle.
// Winner = the current best bid, unless { winnerMemberId, prizeAmount } override
// the resolution (manual declare). Idempotent: a second close is rejected by the
// settlement guard, so a late poll + a manual tap can never double-settle.
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

    const auction = await ensureAuction(id, periodNumber);
    if (auction.status === 'completed') return fail('Auction already completed', 409);

    const body = await req.json().catch(() => ({}));
    let winnerMemberId = body.winnerMemberId ? String(body.winnerMemberId) : null;
    let prizeAmount = body.prizeAmount != null ? Number(body.prizeAmount) : null;

    // Resolve winner from the current best bid when not explicitly provided.
    if ((!winnerMemberId || prizeAmount == null) && auction.currentBestBidId) {
      const best = await prisma.chitBid.findUnique({
        where: { id: auction.currentBestBidId },
        select: { memberId: true, prizeAmount: true },
      });
      if (best) {
        winnerMemberId = winnerMemberId ?? best.memberId;
        prizeAmount = prizeAmount ?? Number(best.prizeAmount);
      }
    }
    if (!winnerMemberId || prizeAmount == null) {
      return fail('No bids to declare a winner', 409);
    }

    const { settleAuctionWinner } = await import('@/lib/chit/settlement');
    const result = await settleAuctionWinner({
      auctionId: auction.id,
      winnerMemberId,
      prizeAmount,
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      actorUserId: ctx.userId,
    });

    await prisma.chitAuctionEvent.createMany({
      data: [
        { auctionId: auction.id, type: 'close', message: 'Auction closed', createdById: ctx.userId },
        { auctionId: auction.id, type: 'winner', memberId: winnerMemberId, amount: prizeAmount, message: 'Winner declared', createdById: ctx.userId },
      ],
    });

    // Notify members who have a linked app user (skip members without one).
    try {
      const members = await prisma.chitMember.findMany({
        where: { chitGroupId: id },
        select: { id: true, customer: { select: { userId: true } } },
      });
      const winnerName = await prisma.chitMember.findUnique({
        where: { id: winnerMemberId },
        select: { customer: { select: { name: true } } },
      });
      const userIds = members
        .map((m) => m.customer?.userId)
        .filter((u): u is string => !!u);
      if (userIds.length) {
        const { sendPushToUsers } = await import('@/lib/notify/channels/push');
        await sendPushToUsers(userIds, {
          title: `${group.name}: auction won`,
          body: `${winnerName?.customer?.name ?? 'A member'} won period ${periodNumber} at ₹${prizeAmount.toLocaleString('en-IN')}. Dividend ₹${Math.round(result.dividend).toLocaleString('en-IN')}.`,
          link: `/chits/${id}`,
        });
      }
    } catch (e) {
      console.error('[chit close] notify failed', e);
    }

    const state = await buildLiveState(group, periodNumber);
    return ok({ ...state, settlement: result });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to close auction', 500);
  }
}
