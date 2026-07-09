import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  loadScopedGroup,
  ensureAuction,
  buildLiveState,
  DEFAULT_COUNTDOWN_SECONDS,
  LIVE_WRITE_ROLES,
} from '@/lib/chit/liveAuction';

// POST /api/v1/chits/[id]/auctions/[period]/open — start a live auction.
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

    const body = await req.json().catch(() => ({}));
    const countdownSeconds =
      Number(body.countdownSeconds) > 0
        ? Math.min(Number(body.countdownSeconds), 3600)
        : DEFAULT_COUNTDOWN_SECONDS;
    // Default min decrement scales with the chit value (~0.1%), floored at ₹1.
    const minBidDecrement =
      Number(body.minBidDecrement) > 0
        ? Number(body.minBidDecrement)
        : Math.max(1, Math.round(group.chitValue / 1000));

    const auction = await ensureAuction(id, periodNumber);
    if (auction.status === 'completed') return fail('Auction already completed', 409);

    const now = new Date();
    const endsAt = new Date(now.getTime() + countdownSeconds * 1000);
    await prisma.chitAuction.update({
      where: { id: auction.id },
      data: {
        status: 'live',
        startedAt: now,
        endsAt,
        countdownSeconds,
        minBidDecrement,
        operatorId: ctx.userId,
        currentBestBidId: null,
        winnerMemberId: null,
      },
    });
    await prisma.chitAuctionEvent.create({
      data: { auctionId: auction.id, type: 'open', message: `Auction opened for period ${periodNumber}`, createdById: ctx.userId },
    });

    return ok(await buildLiveState(group, periodNumber));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to open auction', 500);
  }
}
