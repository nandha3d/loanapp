import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { loadScopedGroup, LIVE_WRITE_ROLES } from '@/lib/chit/liveAuction';

// PATCH /api/v1/chits/[id]/auctions/[auctionId]/schedule
// Here auctionId is the real ChitAuction id. Body: { scheduledAt: ISOString }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!LIVE_WRITE_ROLES.includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;

  try {
    const group = await loadScopedGroup(id, ctx);
    if (!group) return fail('Chit group not found', 404);
    const body = await req.json().catch(() => ({}));
    const scheduledAt = new Date(String(body.scheduledAt ?? ''));
    if (Number.isNaN(scheduledAt.getTime())) return fail('Invalid scheduledAt', 400);

    const auction = await prisma.chitAuction.findFirst({
      where: { id: auctionId, chitGroupId: id },
    });
    if (!auction) return fail('Auction not found', 404);
    if (!['pending', 'notice_sent'].includes(auction.status)) {
      return fail('Only pending or notice-sent auctions can be rescheduled', 409);
    }

    const updated = await prisma.chitAuction.update({
      where: { id: auction.id },
      data: {
        scheduledAt,
        auctionDate: scheduledAt,
        reminder1DayAt: null,
        reminder1HourAt: null,
      },
      select: { id: true, periodNumber: true, scheduledAt: true, auctionDate: true, status: true },
    });
    return ok({
      ...updated,
      scheduledAt: updated.scheduledAt?.toISOString() ?? null,
      auctionDate: updated.auctionDate.toISOString(),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to reschedule auction', 500);
  }
}

export const POST = PATCH;
