import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  loadScopedGroup,
  ensureAuction,
  nextSeq,
  buildLiveState,
  LIVE_WRITE_ROLES,
} from '@/lib/chit/liveAuction';

// POST /api/v1/chits/[id]/auctions/[period]/pass — a member sits out this round.
// Body: { memberId }
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
    const memberId = body.memberId ? String(body.memberId) : '';
    if (!memberId) return fail('memberId required', 400);

    const auction = await ensureAuction(id, periodNumber);
    if (auction.status !== 'live') return fail('Auction is not live', 409);

    const member = await prisma.chitMember.findFirst({
      where: { id: memberId, chitGroupId: id },
      select: { id: true, hasWon: true },
    });
    if (!member) return fail('Member not in this chit group', 404);
    if (member.hasWon) return fail('Member has already won a prior period', 409);

    const seq = await nextSeq(auction.id);
    await prisma.chitBid.create({
      data: {
        chitGroupId: id,
        auctionId: auction.id,
        periodNumber,
        memberId,
        prizeAmount: 0,
        discountAmount: 0,
        kind: 'pass',
        source: 'tap',
        seq,
        createdById: ctx.userId,
      },
    });

    const state = await buildLiveState(group, periodNumber);
    // Hint the client that only one bidder remains, so it can auto-close.
    return ok({ ...state, autoClose: state.activeCount <= 1 && !!state.currentBest });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to pass', 500);
  }
}
