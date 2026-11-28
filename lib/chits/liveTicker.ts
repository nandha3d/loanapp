// Shared server-side live auction ticker & activity snippet service (STRUCT-2, STABLE-8).
// Computes authoritative live/upcoming auction summaries, countdowns, and highest bid
// snippets across all chit engines for both staff Topbar and borrower portal views.

import type { PrismaClient } from '@prisma/client';
import { syncRoom } from './bell';
import { calculateReserveFloor } from './engineCalculator';
import {
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
  resolvePeriodRoomMode,
  supportsBellForPeriod,
  type PeriodRoomMode,
} from './engineTypes';
import { secondsRemaining } from './liveAuction';
import { computeAutomatedBidBounds } from './validation';

export interface ChitLiveTickerItem {
  auctionId: string;
  chitGroupId: string;
  groupCode: string | null;
  groupName: string;
  periodNumber: number;
  chitValue: number;
  auctionType: string;
  roomMode: PeriodRoomMode;
  bellSupported: boolean;
  roomStatus: string;
  status: string;
  scheduledAt: string | null;
  secondsRemaining: number;
  startsInSeconds: number | null;
  isOverdueToStart: boolean;
  durationMinutes: number;
  autoStartEnabled: boolean;
  bellsRung: number;
  bellCount: number;
  bellEnabled: boolean;
  presentCount: number;
  totalMembers: number;
  startingPrize: number;
  highestBid: {
    bidId: string;
    memberName: string;
    ticketNo: string;
    prizeAmount: number;
    bidDiscount: number;
    bidTime: string;
  } | null;
  latestEventKey: string;
  latestEventKind: 'bid' | 'bell' | 'open';
}

export interface ChitLiveTickerPayload {
  currencySymbol: string;
  serverTime: string;
  liveAuctions: ChitLiveTickerItem[];
  upcomingAuctions: ChitLiveTickerItem[];
}

async function queryAndBuildTicker(
  prisma: PrismaClient,
  params: {
    groupWhere: Record<string, unknown>;
    currencySymbol: string;
    now?: Date;
  },
): Promise<ChitLiveTickerPayload> {
  const now = params.now ?? new Date();
  const candidates = await prisma.chitAuction.findMany({
    where: {
      winnerMemberId: null,
      status: { in: ['pending', 'notice_sent', 'in_progress', 'completed'] },
      chitGroup: params.groupWhere,
    },
    select: {
      id: true,
      roomStatus: true,
      status: true,
      scheduledAt: true,
      chitGroup: { select: { auctionType: true } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { auctionDate: 'asc' }],
    take: 24,
  });

  // Evaluate lazy scheduled auto-open, bells, and expiry before building snapshots.
  for (const cand of candidates) {
    const isBidding = ['open_live', 'open_manual', 'sealed'].includes(cand.chitGroup.auctionType);
    const shouldSync =
      isBidding &&
      (['open', 'extended'].includes(cand.roomStatus) ||
        (cand.roomStatus === 'scheduled' && cand.scheduledAt != null && cand.scheduledAt.getTime() <= now.getTime()));
    if (shouldSync) {
      try {
        await prisma.$transaction(async (tx) => {
          await syncRoom(tx, cand.id, now);
        });
      } catch {
        // Non-fatal: continue building ticker for remaining auctions.
      }
    }
  }

  const rows = await prisma.chitAuction.findMany({
    where: {
      winnerMemberId: null,
      status: { in: ['pending', 'notice_sent', 'in_progress', 'completed'] },
      chitGroup: params.groupWhere,
    },
    include: {
      chitGroup: {
        select: {
          id: true,
          groupCode: true,
          name: true,
          chitValue: true,
          totalMembers: true,
          auctionType: true,
          chitEngineType: true,
          engineConfig: true,
          maxDiscountPct: true,
          minDiscountPct: true,
          commissionPct: true,
          bidStartAtCommission: true,
          bidIncrement: true,
          bellEnabled: true,
          bellCount: true,
          hasForemanTicket: true,
        },
      },
      bids: {
        where: { status: { in: ['valid', 'winning'] } },
        orderBy: [{ bidDiscount: 'desc' }, { bidTime: 'asc' }],
        take: 1,
        include: {
          member: {
            select: {
              ticketNo: true,
              memberNumber: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
      attendance: {
        where: { status: { in: ['present', 'proxy'] } },
        select: { id: true },
      },
    },
    orderBy: [{ scheduledAt: 'asc' }, { auctionDate: 'asc' }],
    take: 24,
  });

  const liveAuctions: ChitLiveTickerItem[] = [];
  const upcomingCandidates: ChitLiveTickerItem[] = [];

  for (const a of rows) {
    const g = a.chitGroup;
    const engineType = resolveEngineTypeFromGroup(g);
    const engineCfg = parseChitEngineConfig(g.engineConfig, engineType);
    const roomMode = resolvePeriodRoomMode(g, a.periodNumber);
    const bellSupported = supportsBellForPeriod(g, a.periodNumber);
    const chitValueNum = Number(g.chitValue);

    const groupIncrement = g.bidIncrement ? Number(g.bidIncrement) : 0;
    const engineIncrement =
      engineCfg.discountRules.bidIncrementMultiple > 0 ? engineCfg.discountRules.bidIncrementMultiple : 0;
    const reserveFloorPct =
      engineType === 'AUCTION_RESERVE_PRICE' && engineCfg.discountRules.reservePriceStepPct > 0
        ? calculateReserveFloor({
            chitValue: chitValueNum,
            totalPeriods: g.totalMembers,
            periodNumber: a.periodNumber,
            reservePriceStepPct: engineCfg.discountRules.reservePriceStepPct,
            maxDiscountPct: engineCfg.discountRules.uncapped
              ? null
              : g.maxDiscountPct != null
                ? Number(g.maxDiscountPct)
                : null,
          }).reserveFloorPct
        : null;

    const bounds = computeAutomatedBidBounds({
      chitValue: chitValueNum,
      maxDiscountPct: g.maxDiscountPct != null ? Number(g.maxDiscountPct) : null,
      minDiscountPct: g.minDiscountPct != null ? Number(g.minDiscountPct) : null,
      commissionPct: g.commissionPct != null ? Number(g.commissionPct) : null,
      bidStartAtCommission: g.bidStartAtCommission,
      reserveFloorPct,
      uncapped: engineType === 'AUCTION_UNCAPPED_ENTERPRISE' || engineCfg.discountRules.uncapped,
      bidIncrement: groupIncrement > 0 ? groupIncrement : engineIncrement,
      strictBidMultiple: Boolean(engineCfg.discountRules.strictBidMultiple),
      currentHighestDiscount: 0,
      auctionType: g.auctionType,
    });

    const isMaskedSealed = roomMode === 'SEALED_TENDER' && a.roomStatus !== 'closed';
    const topBidRow = !isMaskedSealed && a.bids?.[0] ? a.bids[0] : null;
    const highestBid = topBidRow
      ? {
          bidId: String(topBidRow.id),
          memberName: topBidRow.member?.customer?.name || 'Member',
          ticketNo: String(topBidRow.member?.ticketNo ?? topBidRow.member?.memberNumber ?? ''),
          prizeAmount: Number(topBidRow.bidAmount),
          bidDiscount: Number(topBidRow.bidDiscount),
          bidTime: topBidRow.bidTime.toISOString(),
        }
      : null;

    const slotDate: Date | null = a.scheduledAt ?? a.auctionDate ?? null;
    const startsInSeconds = slotDate ? Math.round((slotDate.getTime() - now.getTime()) / 1000) : null;
    const isOverdueToStart =
      Boolean(startsInSeconds !== null && startsInSeconds <= 0) &&
      ['pending', 'notice_sent'].includes(a.status) &&
      !['open', 'extended'].includes(a.roomStatus);

    const latestEventKind: 'bid' | 'bell' | 'open' =
      bellSupported && a.bellsRung > 0 ? 'bell' : highestBid ? 'bid' : 'open';
    const latestEventKey =
      bellSupported && a.bellsRung > 0
        ? `bell:${a.id}:${a.bellsRung}:${highestBid?.bidId ?? 'none'}`
        : highestBid
          ? `bid:${highestBid.bidId}`
          : `open:${a.id}:${a.roomStatus}:${a.status}`;

    const item: ChitLiveTickerItem = {
      auctionId: a.id,
      chitGroupId: g.id,
      groupCode: g.groupCode ?? null,
      groupName: g.name,
      periodNumber: a.periodNumber,
      chitValue: chitValueNum,
      auctionType: g.auctionType,
      roomMode,
      bellSupported,
      roomStatus: a.roomStatus,
      status: a.status,
      scheduledAt: slotDate ? slotDate.toISOString() : null,
      secondsRemaining: secondsRemaining(a, now),
      startsInSeconds,
      isOverdueToStart,
      durationMinutes: engineCfg.meetingSchedule?.defaultDurationMinutes ?? 30,
      autoStartEnabled: Boolean(engineCfg.meetingSchedule?.autoStartAtScheduledTime),
      bellsRung: a.bellsRung,
      bellCount: g.bellCount,
      bellEnabled: bellSupported,
      presentCount: a.attendance?.length ?? 0,
      totalMembers: g.totalMembers,
      startingPrize: bounds.startingPrize,
      highestBid,
      latestEventKey,
      latestEventKind,
    };

    const isLiveItem =
      ['open', 'extended'].includes(a.roomStatus) ||
      ((roomMode === 'OPEN_AUCTION' || roomMode === 'SEALED_TENDER') && a.status === 'in_progress') ||
      (roomMode === 'LOTTERY_DRAW' && a.status === 'in_progress');

    if (isLiveItem) {
      liveAuctions.push(item);
    } else if (
      ['pending', 'notice_sent'].includes(a.status) &&
      startsInSeconds !== null &&
      startsInSeconds <= 36 * 3600 &&
      startsInSeconds >= -12 * 3600
    ) {
      upcomingCandidates.push(item);
    }
  }

  return {
    currencySymbol: params.currencySymbol,
    serverTime: now.toISOString(),
    liveAuctions: liveAuctions.slice(0, 5),
    upcomingAuctions: upcomingCandidates.slice(0, 3),
  };
}

export async function getStaffChitLiveTicker(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    branchId?: string | null;
    currencySymbol: string;
    now?: Date;
  },
): Promise<ChitLiveTickerPayload> {
  return queryAndBuildTicker(prisma, {
    groupWhere: {
      tenantId: params.tenantId,
      appType: 'chitfunds',
      deletedAt: null,
      status: 'active',
      ...(params.branchId ? { branchId: params.branchId } : {}),
    },
    currencySymbol: params.currencySymbol,
    now: params.now,
  });
}

export async function getBorrowerChitLiveTicker(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    customerId: string;
    currencySymbol: string;
    now?: Date;
  },
): Promise<ChitLiveTickerPayload> {
  const memberships = await prisma.chitMember.findMany({
    where: {
      customerId: params.customerId,
      subscriberStatus: 'active',
      chitGroup: {
        tenantId: params.tenantId,
        appType: 'chitfunds',
        deletedAt: null,
        status: 'active',
      },
    },
    select: { chitGroupId: true },
  });
  const groupIds = Array.from(new Set(memberships.map((m) => String(m.chitGroupId))));
  if (groupIds.length === 0) {
    return {
      currencySymbol: params.currencySymbol,
      serverTime: (params.now ?? new Date()).toISOString(),
      liveAuctions: [],
      upcomingAuctions: [],
    };
  }
  return queryAndBuildTicker(prisma, {
    groupWhere: {
      id: { in: groupIds },
      tenantId: params.tenantId,
      appType: 'chitfunds',
      deletedAt: null,
      status: 'active',
    },
    currencySymbol: params.currencySymbol,
    now: params.now,
  });
}
