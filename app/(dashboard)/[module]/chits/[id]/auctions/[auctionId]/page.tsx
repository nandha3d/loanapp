import prisma from '@/lib/db';
import { getSetting } from '@/lib/tenant';
import { notFound } from 'next/navigation';
import AuctionDetailClient from './AuctionDetailClient';
import { getCurrentLanguage, getDictionary } from '@/lib/i18n';
import {
  canApproveChitSecurity,
  canReleaseChitPayout,
  getWebChitScope,
  scopedChitGroupWhere,
} from '@/lib/chits/access';
import { calculateReserveFloor } from '@/lib/chits/engineCalculator';
import { parseChitEngineConfig, resolveEngineTypeFromGroup } from '@/lib/chits/engineTypes';
import { loadAuctionTableCashSummary } from '@/lib/chits/tableCash';
import { computeAutomatedBidBounds } from '@/lib/chits/validation';

export default async function ChitAuctionDetailPage({ params }: { params: Promise<{ id: string; auctionId: string; module: string }> }) {
  const { id, auctionId } = await params;
  const scope = await getWebChitScope();
  const tenantId = scope.tenantId;
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const [dict, lang] = await Promise.all([getDictionary(tenantId), getCurrentLanguage(tenantId)]);

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope, { OR: [{ id }, { groupCode: id }] }) },
    include: {
        chitGroup: {
          include: {
            members: {
              orderBy: { memberNumber: 'asc' },
              include: { customer: { select: { id: true, name: true, profilePhoto: true } } },
            },
          },
        },
        bids: {
          orderBy: { bidTime: 'desc' },
          include: { member: { include: { customer: { select: { name: true } } } } },
        },
        attendance: true,
        winnerMember: { include: { customer: { select: { name: true, profilePhoto: true } } } },
    },
  });
  if (!auction) notFound();

  const security = auction.winnerMemberId
    ? await prisma.chitSecurity.findFirst({
        where: { auctionId: auction.id, chitGroupId: auction.chitGroupId, tenantId },
        orderBy: { updatedAt: 'desc' },
      })
    : null;
  const securityDocuments = security
    ? await prisma.chitDocument.findMany({
        where: {
          tenantId,
          appType: scope.appType,
          entityType: 'chit_security',
          entityId: security.id,
        },
        orderBy: [{ documentType: 'asc' }, { uploadedAt: 'desc' }],
      })
    : [];

  const roomMessages = await prisma.chitRoomMessage.findMany({
    where: { auctionId: auction.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      senderName: true,
      visibility: true,
      messageType: true,
      body: true,
      audioUrl: true,
      audioDurationSec: true,
      createdAt: true,
    },
  });

  const payoutReceipt = await prisma.chitReceipt.findFirst({
    where: {
      tenantId,
      entityType: 'auction',
      entityId: auction.id,
      receiptType: 'payout',
      status: 'active',
    },
    orderBy: { issuedAt: 'desc' },
  });

  const engineType = resolveEngineTypeFromGroup(auction.chitGroup);
  const engineCfg = parseChitEngineConfig(auction.chitGroup.engineConfig, engineType);
  const chitValueNum = Number(auction.chitGroup.chitValue);
  const validBids = auction.bids.filter((b) => ['valid', 'winning'].includes(b.status));
  const highestDiscount = validBids.reduce(
    (max, b) => Math.max(max, Number(b.bidDiscount)),
    0,
  );
  const reserveFloorPct =
    engineType === 'AUCTION_RESERVE_PRICE' && engineCfg.discountRules.reservePriceStepPct > 0
      ? calculateReserveFloor({
          chitValue: chitValueNum,
          totalPeriods: auction.chitGroup.totalMembers,
          periodNumber: auction.periodNumber,
          reservePriceStepPct: engineCfg.discountRules.reservePriceStepPct,
          maxDiscountPct: engineCfg.discountRules.uncapped
            ? null
            : auction.chitGroup.maxDiscountPct != null
              ? Number(auction.chitGroup.maxDiscountPct)
              : null,
        }).reserveFloorPct
      : null;
  const groupIncrement = auction.chitGroup.bidIncrement ? Number(auction.chitGroup.bidIncrement) : 0;
  const engineIncrement =
    engineCfg.discountRules.bidIncrementMultiple > 0 ? engineCfg.discountRules.bidIncrementMultiple : 0;
  const initialBidBounds = computeAutomatedBidBounds({
    chitValue: chitValueNum,
    maxDiscountPct: auction.chitGroup.maxDiscountPct != null ? Number(auction.chitGroup.maxDiscountPct) : null,
    minDiscountPct: auction.chitGroup.minDiscountPct != null ? Number(auction.chitGroup.minDiscountPct) : null,
    commissionPct: auction.chitGroup.commissionPct != null ? Number(auction.chitGroup.commissionPct) : null,
    bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
    reserveFloorPct,
    uncapped: engineType === 'AUCTION_UNCAPPED_ENTERPRISE' || engineCfg.discountRules.uncapped,
    bidIncrement: groupIncrement > 0 ? groupIncrement : engineIncrement,
    strictBidMultiple: Boolean(engineCfg.discountRules.strictBidMultiple),
    currentHighestDiscount: highestDiscount,
    auctionType: auction.chitGroup.auctionType,
  });

  const wonAuctions = await prisma.chitAuction.findMany({
    where: {
      chitGroupId: auction.chitGroupId,
      OR: [{ winnerMemberId: { not: null } }, { winners: { some: {} } }],
    },
    orderBy: [{ auctionDate: 'desc' }, { periodNumber: 'desc' }],
    select: {
      id: true,
      periodNumber: true,
      auctionDate: true,
      confirmedAt: true,
      status: true,
      payoutStatus: true,
      prizeAmount: true,
      bidDiscount: true,
      dividend: true,
      winnerMemberId: true,
      winnerMember: {
        select: {
          id: true,
          ticketNo: true,
          memberNumber: true,
          customer: { select: { name: true } },
        },
      },
      winners: {
        select: {
          memberId: true,
          prizeAmount: true,
          bidDiscount: true,
          payoutStatus: true,
          winType: true,
          member: {
            select: {
              id: true,
              ticketNo: true,
              memberNumber: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  type PreviousWinnerRow = {
    auctionId: string | null;
    memberId: string;
    ticketNo: string;
    memberName: string;
    periodNumber: number | null;
    wonDate: string | null;
    prizeAmount: number;
    bidDiscount: number;
    dividend: number;
    payoutStatus: string;
    source: 'auction' | 'historical';
  };
  const winnerMap = new Map<string, PreviousWinnerRow>();
  for (const wa of wonAuctions) {
    const wonDateIso = (wa.confirmedAt ?? wa.auctionDate)?.toISOString?.() ?? null;
    if (wa.winners && wa.winners.length > 0) {
      for (const w of wa.winners) {
        const key = `${wa.id}:${w.memberId}`;
        winnerMap.set(key, {
          auctionId: wa.id,
          memberId: w.memberId,
          ticketNo: String(w.member?.ticketNo ?? w.member?.memberNumber ?? '—'),
          memberName: w.member?.customer?.name ?? 'Member',
          periodNumber: wa.periodNumber,
          wonDate: wonDateIso,
          prizeAmount: Number(w.prizeAmount ?? wa.prizeAmount ?? 0),
          bidDiscount: Number(w.bidDiscount ?? wa.bidDiscount ?? 0),
          dividend: Number(wa.dividend ?? 0),
          payoutStatus: String(w.payoutStatus ?? wa.payoutStatus ?? 'pending'),
          source: 'auction',
        });
      }
    } else if (wa.winnerMemberId && wa.winnerMember) {
      winnerMap.set(`${wa.id}:${wa.winnerMemberId}`, {
        auctionId: wa.id,
        memberId: wa.winnerMemberId,
        ticketNo: String(wa.winnerMember.ticketNo ?? wa.winnerMember.memberNumber ?? '—'),
        memberName: wa.winnerMember.customer?.name ?? 'Member',
        periodNumber: wa.periodNumber,
        wonDate: wonDateIso,
        prizeAmount: Number(wa.prizeAmount ?? 0),
        bidDiscount: Number(wa.bidDiscount ?? 0),
        dividend: Number(wa.dividend ?? 0),
        payoutStatus: String(wa.payoutStatus ?? 'pending'),
        source: 'auction',
      });
    }
  }
  const seenWinnerMemberIds = new Set(Array.from(winnerMap.values()).map((r) => r.memberId));
  for (const m of auction.chitGroup.members) {
    if (m.hasWon && !seenWinnerMemberIds.has(m.id)) {
      winnerMap.set(`hist:${m.id}`, {
        auctionId: null,
        memberId: m.id,
        ticketNo: String(m.ticketNo ?? m.memberNumber),
        memberName: m.customer?.name ?? 'Member',
        periodNumber: m.prizedCycleNumber ?? null,
        wonDate: m.wonAt ? m.wonAt.toISOString() : null,
        prizeAmount: m.historicalPrizeAmount != null ? Number(m.historicalPrizeAmount) : chitValueNum,
        bidDiscount:
          m.historicalPrizeAmount != null
            ? Math.max(0, chitValueNum - Number(m.historicalPrizeAmount))
            : 0,
        dividend: 0,
        payoutStatus: Number(m.historicalPayoutPendingAmount ?? 0) > 0 ? 'pending' : 'paid',
        source: 'historical',
      });
    }
  }
  const previousWinners = Array.from(winnerMap.values()).sort((a, b) => {
    const ta = a.wonDate ? new Date(a.wonDate).getTime() : 0;
    const tb = b.wonDate ? new Date(b.wonDate).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (b.periodNumber ?? 0) - (a.periodNumber ?? 0);
  });

  const initialTableCashSummary = await loadAuctionTableCashSummary(prisma, {
    chitGroupId: auction.chitGroupId,
    periodNumber: auction.periodNumber,
    monthlyContrib: Number(auction.chitGroup.monthlyContrib),
    winnerMemberId: auction.winnerMemberId,
    chitEngineType: auction.chitGroup.chitEngineType,
    auctionType: auction.chitGroup.auctionType,
    engineConfig: auction.chitGroup.engineConfig,
  });

  const nextAuction = await prisma.chitAuction.findFirst({
    where: {
      chitGroupId: auction.chitGroupId,
      periodNumber: { gt: auction.periodNumber },
      status: { not: 'cancelled' },
    },
    orderBy: { periodNumber: 'asc' },
    select: { id: true, periodNumber: true, auctionDate: true, status: true },
  });

  const canApproveSecurity = canApproveChitSecurity(scope.role, scope.staffPermissions, scope.approvalPolicy);
  const canReleasePayout = canReleaseChitPayout(scope.role, scope.staffPermissions, scope.approvalPolicy);

  return (
    <AuctionDetailClient
      auction={JSON.parse(JSON.stringify(auction))}
      security={security ? JSON.parse(JSON.stringify(security)) : null}
      securityDocuments={JSON.parse(JSON.stringify(securityDocuments))}
      payoutReceipt={payoutReceipt ? JSON.parse(JSON.stringify(payoutReceipt)) : null}
      initialMessages={JSON.parse(JSON.stringify(roomMessages.reverse()))}
      previousWinners={previousWinners}
      initialBidBounds={initialBidBounds}
      initialTableCashSummary={initialTableCashSummary}
      nextAuction={nextAuction ? JSON.parse(JSON.stringify(nextAuction)) : null}
      viewerRole={scope.role}
      canApproveSecurity={canApproveSecurity}
      canReleasePayout={canReleasePayout}
      currencySymbol={currencySymbol}
      lang={lang}
      dict={dict}
    />
  );
}
