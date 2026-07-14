// Customer-facing live-auction helpers — the self-service counterpart of the
// staff routes under app/api/v1/chits/[id]/auctions/[auctionId]/. Every
// lookup here is scoped to the calling customer's own membership; never trust
// a memberId supplied by the request body (mirrors lib/chits/customerPortal.ts).
import prisma from '@/lib/db';
import { closeRoomIfExpired, isRoomOpen, secondsRemaining } from './liveAuction';
import { roundMoney } from './calculations';

export async function findOwnLiveAuction(customerId: string, tenantId: string, groupId: string, auctionId: string) {
  const member = await prisma.chitMember.findFirst({
    where: {
      customerId,
      chitGroupId: groupId,
      chitGroup: { tenantId, appType: 'chitfunds', deletedAt: null },
    },
  });
  if (!member) return null;

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroupId: groupId },
    include: { chitGroup: true },
  });
  // Customer self-bidding only applies to the live-room auction type — other
  // types (manual/sealed/lottery/fixed_rotation) stay staff-run for now.
  if (!auction || auction.chitGroup.auctionType !== 'open_live') return null;

  return { member, auction };
}

export async function buildCustomerLiveState(groupId: string, auctionId: string, memberId: string) {
  await prisma.$transaction(async (tx) => {
    await closeRoomIfExpired(tx, auctionId);
  });

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroupId: groupId },
    include: {
      chitGroup: true,
      bids: { where: { status: { in: ['valid', 'winning'] } }, include: { member: true }, orderBy: { bidTime: 'desc' } },
      winnerMember: { include: { customer: { select: { name: true } } } },
    },
  });
  if (!auction) return null;

  const member = await prisma.chitMember.findUnique({
    where: { id: memberId },
    select: { id: true, ticketNo: true, hasWon: true, subscriberStatus: true },
  });
  const attendance = await prisma.chitAuctionAttendance.findUnique({
    where: { auctionId_memberId: { auctionId, memberId } },
    select: { admissionStatus: true },
  });

  const now = new Date();
  const sealed = auction.chitGroup.auctionType === 'sealed' && auction.roomStatus !== 'closed';
  const bids = sealed ? [] : auction.bids;

  const highestBid = bids.length
    ? bids.reduce((top, bid) => (Number(bid.bidDiscount) > Number(top.bidDiscount) ? bid : top), bids[0])
    : null;

  const chitValueNum = Number(auction.chitGroup.chitValue);
  const minPct = auction.chitGroup.minDiscountPct != null
    ? Number(auction.chitGroup.minDiscountPct)
    : auction.chitGroup.commissionPct != null
      ? Number(auction.chitGroup.commissionPct)
      : 0;
  const floorDiscount = minPct > 0 ? roundMoney((chitValueNum * minPct) / 100) : 0;
  const increment = auction.chitGroup.bidIncrement ? Number(auction.chitGroup.bidIncrement) : 0;
  const minNextDiscount = highestBid
    ? roundMoney(Math.max(Number(highestBid.bidDiscount) + increment, floorDiscount))
    : floorDiscount > 0
      ? floorDiscount
      : increment > 0
        ? increment
        : null;

  const myBids = bids
    .filter((bid) => bid.memberId === memberId)
    .map((bid) => ({
      id: bid.id,
      bidAmount: Number(bid.bidAmount),
      bidDiscount: Number(bid.bidDiscount),
      source: bid.source,
      createdAt: bid.bidTime,
    }));

  const messageRows = await prisma.chitRoomMessage.findMany({
    where: { auctionId, visibility: 'public' },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, senderName: true, body: true, createdAt: true },
  });

  return {
    roomStatus: auction.roomStatus,
    auctionStatus: auction.status,
    auctionType: auction.chitGroup.auctionType,
    roomAdmission: auction.chitGroup.roomAdmission,
    serverTime: now,
    biddingClosesAt: auction.biddingClosesAt,
    secondsRemaining: secondsRemaining(auction, now),
    autoExtendSeconds: auction.autoExtendSeconds,
    chitValue: chitValueNum,
    minDiscountPct: auction.chitGroup.minDiscountPct != null ? Number(auction.chitGroup.minDiscountPct) : null,
    maxDiscountPct: auction.chitGroup.maxDiscountPct != null ? Number(auction.chitGroup.maxDiscountPct) : null,
    bidIncrement: increment || null,
    minNextDiscount,
    currentHighestBid: highestBid
      ? { ticketNo: highestBid.member.ticketNo, bidAmount: Number(highestBid.bidAmount), bidDiscount: Number(highestBid.bidDiscount) }
      : null,
    myMembership: {
      memberId,
      ticketNo: member?.ticketNo ?? null,
      hasWon: member?.hasWon ?? false,
      subscriberStatus: member?.subscriberStatus ?? 'active',
      admissionStatus: attendance?.admissionStatus ?? 'not_joined',
    },
    myBids,
    myLatestBid: myBids[0] ?? null,
    isRoomOpen: isRoomOpen(auction, now),
    winner: auction.winnerMember
      ? { memberId: auction.winnerMemberId, ticketNo: auction.winnerMember.ticketNo, isMe: auction.winnerMemberId === memberId }
      : null,
    latestMessages: messageRows.reverse(),
  };
}
