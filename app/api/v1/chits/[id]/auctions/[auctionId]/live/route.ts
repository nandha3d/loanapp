import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { closeRoomIfExpired, secondsRemaining } from '@/lib/chits/liveAuction';
import { roundMoney } from '@/lib/chits/calculations';
import { startingDiscountAmount } from '@/lib/chits/validation';

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
      chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
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
        attendance: {
          include: { member: { include: { customer: true } } },
          orderBy: { markedAt: 'desc' },
        },
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
    // Minimum discount the NEXT bid must reach. For the very first bid this is
    // the group's discount floor (doc 13: minDiscountPct, or commission % when
    // bidStartAtCommission is on) — otherwise clients would offer a ₹1 discount
    // that the bid validator rejects. For later bids it's the current best plus
    // the increment, but never below the floor.
    const chitValueNum = Number(auction.chitGroup.chitValue);
    const floorDiscount = startingDiscountAmount(chitValueNum, {
      minDiscountPct: auction.chitGroup.minDiscountPct != null ? Number(auction.chitGroup.minDiscountPct) : null,
      bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
      commissionPct: auction.chitGroup.commissionPct != null ? Number(auction.chitGroup.commissionPct) : null,
    });
    const increment = auction.chitGroup.bidIncrement ? Number(auction.chitGroup.bidIncrement) : 0;
    const minNextDiscount = highestBid
      ? roundMoney(Math.max(highestBid.bidDiscount + increment, floorDiscount))
      : floorDiscount > 0
        ? floorDiscount
        : increment > 0
          ? increment
          : null;

    const waiting = auction.attendance
      .filter((entry) => entry.admissionStatus === 'waiting')
      .map((entry) => ({ memberId: entry.memberId, name: entry.member.customer.name, ticketNo: entry.member.ticketNo }));

    return ok({
      roomAdmission: auction.chitGroup.roomAdmission,
      waiting,
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
      attendance: auction.attendance.map((entry) => ({
        id: entry.id,
        memberId: entry.memberId,
        memberName: entry.member.customer.name,
        ticketNo: entry.member.ticketNo,
        status: entry.status,
        proxyName: entry.proxyName,
        remarks: entry.remarks,
        markedAt: entry.markedAt,
      })),
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
