import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { closeRoomIfExpired, secondsRemaining } from '@/lib/chits/liveAuction';
import { roundMoney } from '@/lib/chits/calculations';

// Live auction room poll — clients call this every 2-3 seconds. Countdown must be
// driven by serverTime/secondsRemaining, never the device clock. Sealed groups get
// bid counts only until the room closes.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;

  try {
    const scopeWhere = {
      id: auctionId,
      chitGroupId: id,
      chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
    };
    const exists = await prisma.chitAuction.findFirst({ where: scopeWhere, select: { id: true } });
    if (!exists) return fail('Auction not found', 404);

    // Lazy close runs before reading room state; polling clients guarantee a request
    // lands within seconds of expiry, so no cron is needed.
    await prisma.$transaction(async (tx) => {
      await closeRoomIfExpired(tx, auctionId);
    });

    const auction = await prisma.chitAuction.findFirst({
      where: scopeWhere,
      include: {
        chitGroup: true,
        bids: {
          where: { status: { in: ['valid', 'winning'] } },
          include: { member: { include: { customer: true } } },
          orderBy: { bidTime: 'desc' },
        },
        attendance: true,
        winnerMember: { include: { customer: true } },
      },
    });
    if (!auction) return fail('Auction not found', 404);

    const now = new Date();
    const sealed = auction.chitGroup.auctionType === 'sealed' && auction.roomStatus !== 'closed';
    const bids = sealed
      ? []
      : auction.bids.map((bid) => ({
          id: bid.id,
          ticketNo: bid.member.ticketNo,
          memberName: bid.member.customer.name,
          bidAmount: Number(bid.bidAmount),
          bidDiscount: Number(bid.bidDiscount),
          bidTime: bid.bidTime,
          status: bid.status,
        }));
    const highestBid = bids.length
      ? bids.reduce((top, bid) => (bid.bidDiscount > top.bidDiscount ? bid : top), bids[0])
      : null;
    const minNextDiscount = highestBid && auction.chitGroup.bidIncrement
      ? roundMoney(highestBid.bidDiscount + Number(auction.chitGroup.bidIncrement))
      : null;

    return ok({
      roomStatus: auction.roomStatus,
      auctionStatus: auction.status,
      auctionType: auction.chitGroup.auctionType,
      serverTime: now,
      biddingOpensAt: auction.biddingOpensAt,
      biddingClosesAt: auction.biddingClosesAt,
      secondsRemaining: secondsRemaining(auction, now),
      autoExtendSeconds: auction.autoExtendSeconds,
      chitValue: Number(auction.chitGroup.chitValue),
      bidCount: auction.bids.length,
      bids,
      highestBid,
      minNextDiscount,
      presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
      totalMembers: auction.chitGroup.totalMembers,
      winner: auction.winnerMember
        ? { memberId: auction.winnerMember.id, name: auction.winnerMember.customer.name, ticketNo: auction.winnerMember.ticketNo }
        : null,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Live room fetch failed', 500);
  }
}
