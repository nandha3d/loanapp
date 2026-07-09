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

// POST /api/v1/chits/[id]/auctions/[period]/admit — organizer decides on a
// waiting-room member. Body: { memberId, decision: 'admit' | 'deny' }.
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
    const decision = body.decision === 'deny' ? 'denied' : body.decision === 'admit' ? 'admitted' : '';
    if (!memberId) return fail('memberId required', 400);
    if (!decision) return fail("decision must be 'admit' or 'deny'", 400);

    const auction = await ensureAuction(id, periodNumber);
    const attendance = await prisma.chitAuctionAttendance.findUnique({
      where: { auctionId_memberId: { auctionId: auction.id, memberId } },
      select: { id: true },
    });
    if (!attendance) return fail('Member has not joined this room', 404);

    await prisma.chitAuctionAttendance.update({
      where: { id: attendance.id },
      data: { admissionStatus: decision, markedById: ctx.userId },
    });
    await prisma.chitAuctionEvent.create({
      data: {
        auctionId: auction.id,
        type: 'announce',
        memberId,
        message: decision === 'admitted' ? 'Member admitted to room' : 'Member denied entry',
        createdById: ctx.userId,
      },
    });

    return ok(await buildLiveState(group, periodNumber));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to update admission', 500);
  }
}
