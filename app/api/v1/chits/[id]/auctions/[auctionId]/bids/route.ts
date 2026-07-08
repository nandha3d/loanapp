import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { assertValidPrizeAmount } from '@/lib/chits/validation';
import { roundMoney } from '@/lib/chits/calculations';
import { antiSnipeExtension, closeRoomIfExpired, isRoomOpen } from '@/lib/chits/liveAuction';

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
  const memberId = body?.memberId ? String(body.memberId) : '';
  const prizeAmount = Number(body?.prizeAmount);
  if (!memberId || !Number.isFinite(prizeAmount)) return fail('memberId and prizeAmount are required', 400);

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!auction) return fail('Auction not found', 404);
    if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) return fail('Auction is locked', 409);
    if (['lottery', 'fixed_rotation'].includes(auction.chitGroup.auctionType)) {
      return fail('This chit uses a draw — bids are not accepted', 400);
    }
    const member = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: id } });
    if (!member) return fail('Member not found', 404);
    if (member.hasWon) return fail('Member has already won', 400);
    if (member.subscriberStatus !== 'active') return fail(`A ${member.subscriberStatus} ticket cannot bid`, 400);
    assertValidPrizeAmount({
      chitValue: Number(auction.chitGroup.chitValue),
      prizeAmount,
      maxDiscountPct: auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
      minDiscountPct: auction.chitGroup.minDiscountPct ? Number(auction.chitGroup.minDiscountPct) : null,
      commissionPct: Number(auction.chitGroup.commissionPct),
    });
    const bidDiscount = Number(auction.chitGroup.chitValue) - prizeAmount;

    const bid = await prisma.$transaction(async (tx) => {
      // Live room: lazily close on expiry, then require an open room for open_live groups.
      if (auction.chitGroup.auctionType === 'open_live') {
        await closeRoomIfExpired(tx, auctionId);
        const fresh = await tx.chitAuction.findUnique({
          where: { id: auctionId },
          select: { roomStatus: true, biddingClosesAt: true, autoExtendSeconds: true },
        });
        if (!fresh || !isRoomOpen(fresh)) throw new Error('Bidding room is not open');
        const extendedClose = antiSnipeExtension(fresh);
        if (extendedClose) {
          await tx.chitAuction.update({
            where: { id: auctionId },
            data: { biddingClosesAt: extendedClose, roomStatus: 'extended' },
          });
        }
      }

      // Bid increment step; exact-cap bids always accepted so cap ties can form.
      if (auction.chitGroup.bidIncrement) {
        const capDiscount = auction.chitGroup.maxDiscountPct
          ? roundMoney((Number(auction.chitGroup.chitValue) * Number(auction.chitGroup.maxDiscountPct)) / 100)
          : null;
        const highest = await tx.chitBid.aggregate({
          where: { auctionId, status: 'valid' },
          _max: { bidDiscount: true },
        });
        const currentHighest = highest._max.bidDiscount ? Number(highest._max.bidDiscount) : 0;
        const atCap = capDiscount != null && bidDiscount === capDiscount;
        if (!atCap && currentHighest > 0 && bidDiscount < currentHighest + Number(auction.chitGroup.bidIncrement)) {
          throw new Error(`Bid discount must exceed the current highest (${currentHighest}) by at least ${Number(auction.chitGroup.bidIncrement)}`);
        }
      }

      const created = await tx.chitBid.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: auction.chitGroup.branchId,
          auctionId,
          chitGroupId: id,
          memberId,
          bidAmount: prizeAmount,
          bidDiscount,
          remarks: body?.remarks ?? null,
          createdById: ctx.userId,
        },
      });
      await tx.chitAuction.update({
        where: { id: auctionId },
        data: { status: auction.status === 'pending' ? 'in_progress' : auction.status, startedAt: auction.startedAt ?? new Date() },
      });
      return created;
    });
    return ok(bid);
  } catch (e: any) {
    return fail(e?.message ?? 'Bid failed', 500);
  }
}
