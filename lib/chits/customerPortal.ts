// Read-only chit data for the customer/borrower portal. No bidding, no
// payment writes, no messaging — Release 2 is visibility only. A member row
// only ever surfaces here if it belongs to the requesting customerId; never
// trust a memberId/groupId supplied by the caller without this ownership check.
import prisma from '@/lib/db';
import { closeRoomIfExpired, isRoomOpen, secondsRemaining } from './liveAuction';

export async function getMyChitMemberships(customerId: string, tenantId: string) {
  const members = await prisma.chitMember.findMany({
    where: { customerId, chitGroup: { tenantId, deletedAt: null } },
    include: {
      chitGroup: {
        select: {
          id: true,
          name: true,
          groupCode: true,
          chitValue: true,
          monthlyContrib: true,
          durationMonths: true,
          status: true,
          auctions: {
            where: { status: { in: ['pending', 'notice_sent', 'in_progress'] } },
            orderBy: { periodNumber: 'asc' },
            take: 1,
            select: { id: true, periodNumber: true, scheduledAt: true, auctionDate: true, roomStatus: true },
          },
        },
      },
      subscriptions: {
        where: { status: { in: ['upcoming', 'partial', 'missed'] } },
        orderBy: { periodNumber: 'asc' },
        take: 1,
        select: { id: true, periodNumber: true, dueDate: true, dueAmount: true, paidAmount: true, status: true },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  return members.map((m) => ({
    memberId: m.id,
    ticketNo: m.ticketNo,
    hasWon: m.hasWon,
    subscriberStatus: m.subscriberStatus,
    group: {
      id: m.chitGroup.id,
      name: m.chitGroup.name,
      groupCode: m.chitGroup.groupCode,
      chitValue: Number(m.chitGroup.chitValue),
      monthlyContrib: Number(m.chitGroup.monthlyContrib),
      durationMonths: m.chitGroup.durationMonths,
      status: m.chitGroup.status,
    },
    nextAuction: m.chitGroup.auctions[0]
      ? {
          id: m.chitGroup.auctions[0].id,
          periodNumber: m.chitGroup.auctions[0].periodNumber,
          scheduledAt: m.chitGroup.auctions[0].scheduledAt?.toISOString() ?? null,
          auctionDate: m.chitGroup.auctions[0].auctionDate.toISOString(),
          roomStatus: m.chitGroup.auctions[0].roomStatus,
        }
      : null,
    nextDue: m.subscriptions[0]
      ? {
          id: m.subscriptions[0].id,
          periodNumber: m.subscriptions[0].periodNumber,
          dueDate: m.subscriptions[0].dueDate.toISOString(),
          dueAmount: Number(m.subscriptions[0].dueAmount),
          paidAmount: Number(m.subscriptions[0].paidAmount),
          status: m.subscriptions[0].status,
        }
      : null,
  }));
}

export async function getMyChitAuctionStatus(customerId: string, groupId: string, auctionId: string) {
  const member = await prisma.chitMember.findFirst({
    where: { customerId, chitGroupId: groupId },
    select: { id: true, hasWon: true, subscriberStatus: true },
  });
  if (!member) throw new Error('You are not a member of this chit group');

  await prisma.$transaction(async (tx) => {
    await closeRoomIfExpired(tx, auctionId);
  });

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroupId: groupId },
    include: { chitGroup: { select: { chitValue: true, auctionType: true } } },
  });
  if (!auction) throw new Error('Auction not found');

  const sealed = auction.chitGroup.auctionType === 'sealed' && auction.roomStatus !== 'closed';
  const highest = sealed
    ? null
    : await prisma.chitBid.findFirst({
        where: { auctionId, status: { in: ['valid', 'winning'] } },
        orderBy: { bidDiscount: 'desc' },
        select: { bidAmount: true, bidDiscount: true },
      });

  return {
    groupId,
    auctionId,
    periodNumber: auction.periodNumber,
    roomStatus: auction.roomStatus,
    serverTime: new Date().toISOString(),
    biddingClosesAt: auction.biddingClosesAt?.toISOString() ?? null,
    secondsRemaining: secondsRemaining(auction),
    isOpen: isRoomOpen(auction),
    chitValue: Number(auction.chitGroup.chitValue),
    currentHighestPrize: highest ? Number(highest.bidAmount) : null,
    currentHighestDiscount: highest ? Number(highest.bidDiscount) : null,
    myMembership: {
      memberId: member.id,
      eligible: !member.hasWon && member.subscriberStatus === 'active',
      hasWon: member.hasWon,
      subscriberStatus: member.subscriberStatus,
    },
  };
}

export async function getMyChitContributions(customerId: string, tenantId: string) {
  const members = await prisma.chitMember.findMany({
    where: { customerId, chitGroup: { tenantId, deletedAt: null } },
    select: { id: true, ticketNo: true, chitGroup: { select: { id: true, name: true } } },
  });
  if (!members.length) return [];

  const subscriptions = await prisma.chitSubscription.findMany({
    where: { memberId: { in: members.map((m) => m.id) } },
    orderBy: [{ memberId: 'asc' }, { periodNumber: 'asc' }],
  });

  const groupByMember = new Map(members.map((m) => [m.id, m]));
  return subscriptions.map((s) => {
    const member = groupByMember.get(s.memberId)!;
    const netDue = Number(s.dueAmount) - Number(s.dividendAmount) + Number(s.penaltyAmount);
    return {
      subscriptionId: s.id,
      groupId: member.chitGroup.id,
      groupName: member.chitGroup.name,
      ticketNo: member.ticketNo,
      periodNumber: s.periodNumber,
      dueDate: s.dueDate.toISOString(),
      baseDueAmount: Number(s.baseDueAmount ?? s.dueAmount),
      dividendAmount: Number(s.dividendAmount),
      penaltyAmount: Number(s.penaltyAmount),
      netDue,
      paidAmount: Number(s.paidAmount),
      outstanding: Math.max(0, netDue - Number(s.paidAmount)),
      status: s.status,
    };
  });
}

export async function getMyChitReceipts(customerId: string, tenantId: string) {
  const members = await prisma.chitMember.findMany({
    where: { customerId, chitGroup: { tenantId, deletedAt: null } },
    select: { id: true, subscriptions: { select: { id: true } } },
  });
  const subscriptionIds = members.flatMap((m) => m.subscriptions.map((s) => s.id));
  if (!subscriptionIds.length) return [];

  const receipts = await prisma.chitReceipt.findMany({
    where: { tenantId, entityType: 'subscription', entityId: { in: subscriptionIds }, status: 'active' },
    orderBy: { issuedAt: 'desc' },
  });

  return receipts.map((r) => ({
    id: r.id,
    receiptNo: r.receiptNo,
    receiptType: r.receiptType,
    amount: Number(r.amount),
    paymentMode: r.paymentMode,
    issuedAt: r.issuedAt.toISOString(),
  }));
}
