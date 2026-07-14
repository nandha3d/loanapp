import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { closeAuctionRoom, openAuctionRoom } from '@/lib/chits/liveAuction';
import { syncRoom, ringBellManually } from '@/lib/chits/bell';
import { createChitAudit } from '@/lib/chits/audit';

// Open or close the live bidding room for an open_live auction. Closing (manual or
// lazy) never selects/pays a winner — that stays with the confirm flow.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const body = await req.json().catch(() => null) as any;
  const action = body?.action ? String(body.action) : '';
  if (!['open', 'close', 'ring'].includes(action)) return fail('action must be open, close, or ring', 400);

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!auction) return fail('Auction not found', 404);
    if (auction.chitGroup.auctionType !== 'open_live') return fail('Live room is only available for open_live chits', 400);
    if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) return fail('Auction is locked', 409);

    if (action === 'ring') {
      await prisma.$transaction(async (tx) => {
        await syncRoom(tx, auctionId);
        await ringBellManually(tx, auctionId, ctx.userId);
      });
      const fresh = await prisma.chitAuction.findUnique({
        where: { id: auctionId },
        select: { roomStatus: true, bellsRung: true, bellAnchorAt: true },
      });
      return ok({ roomStatus: fresh?.roomStatus, bellsRung: fresh?.bellsRung, bellAnchorAt: fresh?.bellAnchorAt });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await syncRoom(tx, auctionId);
      if (action === 'open') {
        const fresh = await tx.chitAuction.findUnique({ where: { id: auctionId }, select: { roomStatus: true } });
        if (fresh && ['open', 'extended'].includes(fresh.roomStatus)) throw new Error('Room is already open');
        const durationMinutes = Number(body?.durationMinutes) || 30;
        const result = await openAuctionRoom(tx, {
          auctionId,
          durationMinutes,
          autoExtendSeconds: Number(body?.autoExtendSeconds) || 0,
        });
        await createChitAudit(tx, {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'open_live_room',
          entityType: 'chit_auction',
          entityId: auctionId,
          newValue: { durationMinutes, autoExtendSeconds: Number(body?.autoExtendSeconds) || 0 },
        });
        return result;
      }
      const result = await closeAuctionRoom(tx, auctionId);
      await createChitAudit(tx, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'close_live_room',
        entityType: 'chit_auction',
        entityId: auctionId,
        newValue: { roomStatus: 'closed' },
      });
      return result;
    });
    return ok({
      roomStatus: updated.roomStatus,
      biddingOpensAt: updated.biddingOpensAt,
      biddingClosesAt: updated.biddingClosesAt,
      autoExtendSeconds: updated.autoExtendSeconds,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Room action failed', 500);
  }
}
