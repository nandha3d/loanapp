// Server-side Chit Funds Dashboard aggregator (STABLE-8, STRUCT-2, SCOPE-1/2/3/15).
// No next/headers or auth() imports — receives tenantId & branchId explicitly.

import type { PrismaClient } from '@prisma/client';
import { startOfBusinessToday, startOfBusinessTomorrow } from '@/lib/businessTime';
import { roundMoney } from './calculations';
import { normalizeCashDenominations } from './denominations';
import { calculateChitPeriodEngine, computeSubscriptionBalances } from './engineCalculator';
import { parseChitEngineConfig, resolveEngineTypeFromGroup } from './engineTypes';
import type { ChitCommissionBasis } from './types';

export interface ChitDashboardKpis {
  activeChitGroups: number;
  totalMembers: number;
  liveAuctionsCount: number;
  auctionsThisMonth: number;
  upcomingAuctionsCount: number;
  pendingApprovals: number;
}

export interface ChitDashboardHeroAuction {
  auctionId: string;
  chitGroupId: string;
  groupCode: string | null;
  groupName: string;
  chitValue: number;
  periodNumber: number;
  totalMembers: number;
  enrolledMembers: number;
  roomStatus: string;
  status: string;
  isLive: boolean;
  isPaused: boolean;
  currentHighestPrize: number;
  bidDiscount: number;
  discountPct: number;
  leadingMemberName: string | null;
  leadingTicketNo: string | null;
  auctionDateIso: string;
}

export interface ChitDashboardGroupRow {
  id: string;
  groupCode: string | null;
  name: string;
  enrolledMembers: number;
  totalMembers: number;
  chitValue: number;
  currentPeriod: number;
  status: string;
}

export interface ChitDashboardSettlementSummary {
  auctionId: string;
  periodNumber: number;
  groupName: string;
  chitValue: number;
  bidDiscount: number;
  discountPct: number;
  commission: number;
  commissionPct: number;
  commissionBasis: string;
  dividendPerTicket: number;
  eligibleTickets: number;
  netInstallmentPerMember: number;
  netPayableToWinner: number;
  winnerName: string | null;
  winnerTicketNo: string | null;
}

export interface ChitDashboardCollectionPoint {
  periodNumber: number;
  label: string;
  expected: number;
  collected: number;
}

export interface ChitDashboardCollectionPerformance {
  groupName: string | null;
  collectedTotal: number;
  expectedTotal: number;
  collectionPct: number;
  peakPeriodLabel: string | null;
  peakCollected: number;
  points: ChitDashboardCollectionPoint[];
}

export interface ChitDashboardCashDenominationRow {
  denomination: number;
  count: number;
  amount: number;
}

export interface ChitDashboardPayoutSummary {
  auctionId: string | null;
  periodNumber: number | null;
  groupName: string | null;
  payoutStatus: string;
  grossPrize: number;
  disbursedAmount: number;
  arrearsAndPenaltyOffset: number;
  netTargetAfterArrears: number;
  balancePending: number;
  payoutProgressPct: number;
  denominations: ChitDashboardCashDenominationRow[];
  totalCashPayout: number;
}

export interface ChitDashboardUpcomingAuction {
  id: string;
  chitGroupId: string;
  groupName: string;
  periodNumber: number;
  totalMembers: number;
  chitValue: number;
  dateIso: string;
  monthShort: string;
  dayOfMonth: string;
  daysUntil: number;
}

export interface ChitDashboardActivityItem {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  createdAtIso: string;
  minutesAgo: number;
}

export interface ChitDashboardOverdueRow {
  id: string;
  customerName: string;
  customerCode: string;
  chitGroupName: string;
  dueDateIso: string;
  overdueAmount: number;
  daysOverdue: number;
}

export interface ChitFundsDashboardOverview {
  kpis: ChitDashboardKpis;
  heroAuction: ChitDashboardHeroAuction | null;
  groupOverview: ChitDashboardGroupRow[];
  settlementSummary: ChitDashboardSettlementSummary | null;
  collectionPerformance: ChitDashboardCollectionPerformance;
  payoutSummary: ChitDashboardPayoutSummary;
  upcomingAuctions: ChitDashboardUpcomingAuction[];
  recentActivity: ChitDashboardActivityItem[];
  overdueSubscriptions: ChitDashboardOverdueRow[];
  todayExpected: number;
  todayCollected: number;
  todayGap: number;
  totalOverdueAmount: number;
}

/**
 * Computes period-by-period collection trend points and percentage server-side (STABLE-8).
 */
export function computeCollectionSeriesFromSubs(
  subs: Array<{ periodNumber: number; dueAmount: unknown; paidAmount: unknown }>,
  groupName: string | null = null,
): ChitDashboardCollectionPerformance {
  const byPeriod = new Map<number, { expected: number; collected: number }>();
  for (const s of subs) {
    const p = Math.max(1, Math.trunc(Number(s.periodNumber) || 1));
    const cur = byPeriod.get(p) ?? { expected: 0, collected: 0 };
    cur.expected = roundMoney(cur.expected + Math.max(0, Number(s.dueAmount) || 0));
    cur.collected = roundMoney(cur.collected + Math.max(0, Number(s.paidAmount) || 0));
    byPeriod.set(p, cur);
  }
  const sortedPeriods = Array.from(byPeriod.keys()).sort((a, b) => a - b).slice(-10);
  const points: ChitDashboardCollectionPoint[] = sortedPeriods.map((p) => {
    const row = byPeriod.get(p)!;
    return {
      periodNumber: p,
      label: `P${p}`,
      expected: row.expected,
      collected: row.collected,
    };
  });

  // Focus progress bar on the latest active period with dues/payments if available, else sum
  const latestWithActivity = [...points].reverse().find((pt) => pt.collected > 0 || pt.expected > 0) ?? null;
  const collectedTotal = latestWithActivity ? latestWithActivity.collected : 0;
  const expectedTotal = latestWithActivity ? latestWithActivity.expected : 0;
  const collectionPct =
    expectedTotal > 0
      ? roundMoney(Math.min(100, (collectedTotal / expectedTotal) * 100), 2)
      : collectedTotal > 0
        ? 100
        : 0;

  let peakPeriodLabel: string | null = null;
  let peakCollected = 0;
  for (const pt of points) {
    if (pt.collected >= peakCollected) {
      peakCollected = pt.collected;
      peakPeriodLabel = pt.label;
    }
  }

  return {
    groupName,
    collectedTotal,
    expectedTotal,
    collectionPct,
    peakPeriodLabel,
    peakCollected,
    points,
  };
}

/**
 * Computes winner payout disbursement progress and balance server-side (STABLE-8).
 */
export function computePayoutProgressSummary(input: {
  grossPrize: number;
  arrearsOffset: number;
  penaltyOffset: number;
  netPayableAmount?: number | null;
  disbursedAmount: number;
}): {
  grossPrize: number;
  arrearsAndPenaltyOffset: number;
  netTargetAfterArrears: number;
  disbursedAmount: number;
  balancePending: number;
  payoutProgressPct: number;
} {
  const grossPrize = roundMoney(Math.max(0, Number(input.grossPrize) || 0));
  const arrearsAndPenaltyOffset = roundMoney(
    Math.max(0, (Number(input.arrearsOffset) || 0) + (Number(input.penaltyOffset) || 0)),
  );
  const netTargetAfterArrears =
    input.netPayableAmount != null
      ? roundMoney(Math.max(0, Number(input.netPayableAmount)))
      : roundMoney(Math.max(0, grossPrize - arrearsAndPenaltyOffset));
  const disbursedAmount = roundMoney(Math.max(0, Number(input.disbursedAmount) || 0));
  const balancePending = roundMoney(Math.max(0, netTargetAfterArrears - disbursedAmount));
  const settledDenominator = grossPrize > 0 ? grossPrize : netTargetAfterArrears + arrearsAndPenaltyOffset;
  const payoutProgressPct =
    netTargetAfterArrears > 0
      ? Math.min(100, Math.round((disbursedAmount / netTargetAfterArrears) * 100))
      : settledDenominator > 0
        ? 100
        : 0;

  return {
    grossPrize,
    arrearsAndPenaltyOffset,
    netTargetAfterArrears,
    disbursedAmount,
    balancePending,
    payoutProgressPct,
  };
}

export async function getChitFundsDashboardData(
  prisma: PrismaClient,
  tenantId: string,
  branchId?: string | null,
): Promise<ChitFundsDashboardOverview> {
  const today = startOfBusinessToday();
  const tomorrow = startOfBusinessTomorrow();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const now = new Date();

  const branchFilter = branchId ? { branchId } : {};
  const scopedGroupWhere = { tenantId, appType: 'chitfunds', deletedAt: null, ...branchFilter };

  const [
    activeChitGroups,
    totalMembers,
    liveAuctionsCount,
    auctionsThisMonth,
    upcomingAuctionsCount,
    pendingApprovalReqs,
    pendingSecurityApprovals,
    todaySubscriptions,
    overdueSubscriptionsRaw,
    activeChitGroupsList,
    liveOrLatestAuctions,
    upcomingAuctionsRaw,
    latestWinnerAuction,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.chitGroup.count({
      where: { ...scopedGroupWhere, status: 'active' },
    }),
    prisma.chitMember.count({
      where: { chitGroup: scopedGroupWhere },
    }),
    prisma.chitAuction.count({
      where: {
        chitGroup: scopedGroupWhere,
        roomStatus: { in: ['open', 'extended', 'paused'] },
      },
    }),
    prisma.chitAuction.count({
      where: {
        chitGroup: scopedGroupWhere,
        auctionDate: { gte: monthStart, lt: tomorrow },
      },
    }),
    prisma.chitAuction.count({
      where: {
        chitGroup: { ...scopedGroupWhere, status: 'active' },
        status: { in: ['scheduled', 'pending'] },
        roomStatus: { in: ['scheduled', 'open', 'extended', 'paused'] },
        winnerMemberId: null,
      },
    }),
    prisma.approvalRequest.count({
      where: {
        tenantId,
        appType: 'chitfunds',
        status: 'pending',
        ...(branchId ? { requestedBy: { branchId } } : {}),
      },
    }),
    prisma.chitSecurity.count({
      where: {
        tenantId,
        status: 'submitted',
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.chitSubscription.findMany({
      where: {
        member: { chitGroup: scopedGroupWhere },
        dueDate: { gte: today, lt: tomorrow },
      },
      select: { dueAmount: true, paidAmount: true },
    }),
    prisma.chitSubscription.findMany({
      where: {
        member: { chitGroup: scopedGroupWhere },
        dueDate: { lt: today },
        status: { not: 'paid' },
      },
      include: {
        member: {
          include: {
            customer: { select: { name: true, customerCode: true } },
            chitGroup: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.chitGroup.findMany({
      where: { ...scopedGroupWhere, status: 'active' },
      include: {
        _count: { select: { members: true } },
        auctions: {
          orderBy: { periodNumber: 'desc' },
          take: 1,
          select: { periodNumber: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.chitAuction.findMany({
      where: {
        chitGroup: { ...scopedGroupWhere, status: { in: ['active', 'completed'] } },
      },
      include: {
        chitGroup: {
          select: {
            id: true,
            name: true,
            groupCode: true,
            chitValue: true,
            monthlyContrib: true,
            totalMembers: true,
            commissionPct: true,
            commissionBasis: true,
            gstPct: true,
            dividendPolicy: true,
            dividendDistribution: true,
            chitEngineType: true,
            engineConfig: true,
            _count: { select: { members: true } },
          },
        },
        winnerMember: {
          select: {
            id: true,
            ticketNo: true,
            customer: { select: { name: true } },
          },
        },
        bids: {
          where: { status: { in: ['valid', 'winning'] } },
          orderBy: [{ discountAmount: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          include: {
            member: {
              select: {
                ticketNo: true,
                customer: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ completedAt: 'desc' }, { auctionDate: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    }),
    prisma.chitAuction.findMany({
      where: {
        chitGroup: { ...scopedGroupWhere, status: 'active' },
        winnerMemberId: null,
        status: { in: ['scheduled', 'pending'] },
      },
      include: {
        chitGroup: {
          select: { id: true, name: true, totalMembers: true, chitValue: true },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { auctionDate: 'asc' }],
      take: 4,
    }),
    prisma.chitAuction.findFirst({
      where: {
        chitGroup: scopedGroupWhere,
        winnerMemberId: { not: null },
      },
      include: {
        chitGroup: { select: { name: true } },
        payoutDisbursements: {
          orderBy: { trancheNumber: 'asc' },
          select: {
            amount: true,
            paymentMode: true,
            denominationBreakdown: true,
          },
        },
      },
      orderBy: [{ completedAt: 'desc' }, { auctionDate: 'desc' }],
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId,
        AND: [
          { user: { role: { not: 'developer' }, ...branchFilter } },
          {
            OR: [
              { entityType: { startsWith: 'chit' } },
              { user: { appType: 'chitfunds' } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const pendingApprovals = pendingApprovalReqs + pendingSecurityApprovals;
  const todayExpected = roundMoney(todaySubscriptions.reduce((s, item) => s + Number(item.dueAmount), 0));
  const todayCollected = roundMoney(todaySubscriptions.reduce((s, item) => s + Number(item.paidAmount), 0));
  const todayGap = roundMoney(Math.max(0, todayExpected - todayCollected));

  const overdueRows: ChitDashboardOverdueRow[] = overdueSubscriptionsRaw.map((item) => {
    const dueMs = new Date(item.dueDate).setHours(0, 0, 0, 0);
    return {
      id: item.id,
      customerName: item.member.customer.name,
      customerCode: item.member.customer.customerCode,
      chitGroupName: item.member.chitGroup.name,
      dueDateIso: item.dueDate.toISOString(),
      overdueAmount: roundMoney(Math.max(0, Number(item.dueAmount) - Number(item.paidAmount))),
      daysOverdue: Math.max(0, Math.floor((today.getTime() - dueMs) / (24 * 60 * 60 * 1000))),
    };
  });
  const totalOverdueAmount = roundMoney(overdueRows.reduce((s, r) => s + r.overdueAmount, 0));

  // Hero auction: live/paused first, else most recent confirmed/bid auction, else latest upcoming
  const liveCandidate = liveOrLatestAuctions.find((a) => ['open', 'extended', 'paused'].includes(a.roomStatus));
  const winnerOrBidCandidate =
    liveCandidate ??
    liveOrLatestAuctions.find((a) => a.winnerMemberId != null || a.bids.length > 0) ??
    liveOrLatestAuctions[0] ??
    null;

  let heroAuction: ChitDashboardHeroAuction | null = null;
  let settlementSummary: ChitDashboardSettlementSummary | null = null;

  if (winnerOrBidCandidate) {
    const grp = winnerOrBidCandidate.chitGroup;
    const chitVal = roundMoney(Number(grp.chitValue));
    const topBid = winnerOrBidCandidate.bids[0] ?? null;
    const currentPrize =
      winnerOrBidCandidate.prizeAmount != null
        ? roundMoney(Number(winnerOrBidCandidate.prizeAmount))
        : topBid?.prizeAmount != null
          ? roundMoney(Number(topBid.prizeAmount))
          : chitVal;
    const bidDiscount =
      winnerOrBidCandidate.bidDiscount != null
        ? roundMoney(Number(winnerOrBidCandidate.bidDiscount))
        : topBid?.discountAmount != null
          ? roundMoney(Number(topBid.discountAmount))
          : roundMoney(Math.max(0, chitVal - currentPrize));
    const discountPct = chitVal > 0 ? roundMoney((bidDiscount / chitVal) * 100, 2) : 0;
    const isLive = ['open', 'extended'].includes(winnerOrBidCandidate.roomStatus);
    const isPaused = winnerOrBidCandidate.roomStatus === 'paused';

    const leaderName =
      winnerOrBidCandidate.winnerMember?.customer?.name ??
      topBid?.member?.customer?.name ??
      null;
    const leaderTicket =
      winnerOrBidCandidate.winnerMember?.ticketNo ??
      topBid?.member?.ticketNo ??
      null;

    heroAuction = {
      auctionId: winnerOrBidCandidate.id,
      chitGroupId: grp.id,
      groupCode: grp.groupCode,
      groupName: grp.name,
      chitValue: chitVal,
      periodNumber: winnerOrBidCandidate.periodNumber,
      totalMembers: grp.totalMembers,
      enrolledMembers: grp._count.members,
      roomStatus: winnerOrBidCandidate.roomStatus,
      status: winnerOrBidCandidate.status,
      isLive,
      isPaused,
      currentHighestPrize: currentPrize,
      bidDiscount,
      discountPct,
      leadingMemberName: leaderName,
      leadingTicketNo: leaderTicket,
      auctionDateIso: winnerOrBidCandidate.auctionDate.toISOString(),
    };

    // Server-side Settlement Summary for the featured auction period (STABLE-8)
    const settlementSource =
      liveOrLatestAuctions.find((a) => a.winnerMemberId != null || a.bids.length > 0) ?? winnerOrBidCandidate;
    const sGrp = settlementSource.chitGroup;
    const sChitVal = roundMoney(Number(sGrp.chitValue));
    const sTopBid = settlementSource.bids[0] ?? null;
    const sPrize =
      settlementSource.prizeAmount != null
        ? roundMoney(Number(settlementSource.prizeAmount))
        : sTopBid?.prizeAmount != null
          ? roundMoney(Number(sTopBid.prizeAmount))
          : sChitVal;
    const sDiscount =
      settlementSource.bidDiscount != null
        ? roundMoney(Number(settlementSource.bidDiscount))
        : sTopBid?.discountAmount != null
          ? roundMoney(Number(sTopBid.discountAmount))
          : roundMoney(Math.max(0, sChitVal - sPrize));

    const engineType = resolveEngineTypeFromGroup(sGrp);
    const cfg = parseChitEngineConfig(sGrp.engineConfig, engineType);
    const commissionPct = Number(sGrp.commissionPct ?? 5);
    const membersForCalc = Array.from({ length: Math.max(1, sGrp.totalMembers) }, (_, idx) => ({
      memberId: `m-${idx + 1}`,
      memberName: `Member ${idx + 1}`,
      ticketNo: String(idx + 1),
      ticketShare: 1,
      hasWonBeforePeriod: false,
      isActive: true,
    }));
    const breakdown = calculateChitPeriodEngine({
      engineType,
      config: cfg,
      chitValue: sChitVal,
      monthlyContrib: Number(sGrp.monthlyContrib),
      totalMembers: sGrp.totalMembers,
      periodNumber: settlementSource.periodNumber,
      commissionPct,
      commissionBasis: (sGrp.commissionBasis === 'CHIT_VALUE' ? 'CHIT_VALUE' : 'BID_DISCOUNT') as ChitCommissionBasis,
      gstPct: Number(sGrp.gstPct ?? 0),
      dividendPolicy: sGrp.dividendPolicy || 'ALL_MEMBERS',
      dividendDistribution: sGrp.dividendDistribution || 'ADJUST_NEXT_DUE',
      winnerMemberIds: ['m-1'],
      prizeAmount: sPrize,
      members: membersForCalc,
    });

    // Check if winner already paid their current-period installment
    let winnerUnpaid = breakdown.baseInstalment - breakdown.dividendPerTicket;
    if (settlementSource.winnerMemberId) {
      const winnerSub = await prisma.chitSubscription.findFirst({
        where: {
          memberId: settlementSource.winnerMemberId,
          periodNumber: settlementSource.periodNumber,
        },
        select: {
          dueAmount: true,
          baseDueAmount: true,
          paidAmount: true,
          dividendAmount: true,
          interestAmount: true,
          penaltyAmount: true,
          premiumAmount: true,
          deferredDividendAmount: true,
        },
      });
      if (winnerSub) {
        winnerUnpaid = computeSubscriptionBalances(winnerSub, sGrp.dividendDistribution).outstanding;
      }
    } else {
      winnerUnpaid = 0;
    }

    settlementSummary = {
      auctionId: settlementSource.id,
      periodNumber: settlementSource.periodNumber,
      groupName: sGrp.name,
      chitValue: sChitVal,
      bidDiscount: sDiscount,
      discountPct: sChitVal > 0 ? roundMoney((sDiscount / sChitVal) * 100, 2) : 0,
      commission: roundMoney(
        settlementSource.commission != null ? Number(settlementSource.commission) : breakdown.commission,
      ),
      commissionPct,
      commissionBasis: sGrp.commissionBasis || 'BID_DISCOUNT',
      dividendPerTicket: roundMoney(
        settlementSource.dividend != null ? Number(settlementSource.dividend) : breakdown.dividendPerTicket,
      ),
      eligibleTickets: Math.max(1, breakdown.dividendEligibleTickets || sGrp.totalMembers),
      netInstallmentPerMember: roundMoney(Math.max(0, breakdown.baseInstalment - breakdown.dividendPerTicket)),
      netPayableToWinner: roundMoney(Math.max(0, sPrize - winnerUnpaid)),
      winnerName: settlementSource.winnerMember?.customer?.name ?? sTopBid?.member?.customer?.name ?? null,
      winnerTicketNo: settlementSource.winnerMember?.ticketNo ?? sTopBid?.member?.ticketNo ?? null,
    };
  }

  // Collection performance series for featured group (or primary active group)
  const chartGroupId = heroAuction?.chitGroupId ?? activeChitGroupsList[0]?.id ?? null;
  const chartGroupName = heroAuction?.groupName ?? activeChitGroupsList[0]?.name ?? null;
  const chartSubs = chartGroupId
    ? await prisma.chitSubscription.findMany({
        where: { member: { chitGroupId: chartGroupId } },
        select: { periodNumber: true, dueAmount: true, paidAmount: true },
      })
    : [];
  const collectionPerformance = computeCollectionSeriesFromSubs(chartSubs, chartGroupName);

  // Payout & cash denomination summary for latest winning auction
  let payoutSummary: ChitDashboardPayoutSummary = {
    auctionId: null,
    periodNumber: null,
    groupName: null,
    payoutStatus: 'not_ready',
    grossPrize: 0,
    disbursedAmount: 0,
    arrearsAndPenaltyOffset: 0,
    netTargetAfterArrears: 0,
    balancePending: 0,
    payoutProgressPct: 0,
    denominations: [],
    totalCashPayout: 0,
  };

  if (latestWinnerAuction) {
    const denomTotals = new Map<number, number>();
    let disbursedSum = 0;
    for (const pd of latestWinnerAuction.payoutDisbursements) {
      disbursedSum = roundMoney(disbursedSum + Number(pd.amount));
      const map = normalizeCashDenominations(pd.denominationBreakdown);
      for (const [note, cnt] of Object.entries(map ?? {})) {
        const d = Number(note);
        if (cnt > 0 && Number.isFinite(d)) {
          denomTotals.set(d, (denomTotals.get(d) ?? 0) + cnt);
        }
      }
    }
    if (denomTotals.size === 0) {
      const legacyReceipt = await prisma.chitReceipt.findFirst({
        where: {
          tenantId,
          entityType: 'chit_auction',
          entityId: latestWinnerAuction.id,
          receiptType: 'prize_payout',
          status: 'active',
        },
        select: { amount: true, cashDenominationsJson: true },
      });
      if (legacyReceipt) {
        if (disbursedSum === 0) disbursedSum = roundMoney(Number(legacyReceipt.amount));
        const map = normalizeCashDenominations(legacyReceipt.cashDenominationsJson);
        for (const [note, cnt] of Object.entries(map ?? {})) {
          const d = Number(note);
          if (cnt > 0 && Number.isFinite(d)) {
            denomTotals.set(d, (denomTotals.get(d) ?? 0) + cnt);
          }
        }
      }
    }
    const effectiveDisbursed = Math.max(
      disbursedSum,
      roundMoney(Number(latestWinnerAuction.totalDisbursedAmount ?? 0)),
    );
    const calcPayout = computePayoutProgressSummary({
      grossPrize: Number(latestWinnerAuction.grossPrizeAmount ?? latestWinnerAuction.prizeAmount ?? 0),
      arrearsOffset: Number(latestWinnerAuction.arrearsDeductedAmount ?? 0),
      penaltyOffset: Number(latestWinnerAuction.penaltyDeductedAmount ?? 0),
      netPayableAmount:
        latestWinnerAuction.netPayableAmount != null ? Number(latestWinnerAuction.netPayableAmount) : null,
      disbursedAmount: effectiveDisbursed,
    });
    const denominations: ChitDashboardCashDenominationRow[] = Array.from(denomTotals.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([denomination, count]) => ({
        denomination,
        count,
        amount: roundMoney(denomination * count),
      }));
    const totalCashPayout = roundMoney(denominations.reduce((s, r) => s + r.amount, 0));

    payoutSummary = {
      auctionId: latestWinnerAuction.id,
      periodNumber: latestWinnerAuction.periodNumber,
      groupName: latestWinnerAuction.chitGroup.name,
      payoutStatus: latestWinnerAuction.payoutStatus,
      grossPrize: calcPayout.grossPrize,
      disbursedAmount: calcPayout.disbursedAmount,
      arrearsAndPenaltyOffset: calcPayout.arrearsAndPenaltyOffset,
      netTargetAfterArrears: calcPayout.netTargetAfterArrears,
      balancePending: calcPayout.balancePending,
      payoutProgressPct: calcPayout.payoutProgressPct,
      denominations,
      totalCashPayout,
    };
  }

  const upcomingAuctions: ChitDashboardUpcomingAuction[] = upcomingAuctionsRaw.map((a) => {
    const dt = a.scheduledAt ?? a.auctionDate;
    const dayStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const diffDays = Math.max(0, Math.round((dayStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      id: a.id,
      chitGroupId: a.chitGroupId,
      groupName: a.chitGroup.name,
      periodNumber: a.periodNumber,
      totalMembers: a.chitGroup.totalMembers,
      chitValue: roundMoney(Number(a.chitGroup.chitValue)),
      dateIso: dt.toISOString(),
      monthShort: dt.toLocaleDateString('en-US', { month: 'short' }),
      dayOfMonth: String(dt.getDate()),
      daysUntil: diffDays,
    };
  });

  const groupOverview: ChitDashboardGroupRow[] = activeChitGroupsList.map((g) => ({
    id: g.id,
    groupCode: g.groupCode,
    name: g.name,
    enrolledMembers: g._count.members,
    totalMembers: g.totalMembers,
    chitValue: roundMoney(Number(g.chitValue)),
    currentPeriod: g.auctions[0]?.periodNumber ?? 1,
    status: g.status,
  }));

  const recentActivity: ChitDashboardActivityItem[] = recentAuditLogs.map((log) => ({
    id: log.id,
    actorName: log.user?.name || 'System',
    action: log.action,
    entityType: log.entityType,
    createdAtIso: log.createdAt.toISOString(),
    minutesAgo: Math.max(0, Math.floor((now.getTime() - log.createdAt.getTime()) / 60000)),
  }));

  return {
    kpis: {
      activeChitGroups,
      totalMembers,
      liveAuctionsCount,
      auctionsThisMonth,
      upcomingAuctionsCount,
      pendingApprovals,
    },
    heroAuction,
    groupOverview,
    settlementSummary,
    collectionPerformance,
    payoutSummary,
    upcomingAuctions,
    recentActivity,
    overdueSubscriptions: overdueRows,
    todayExpected,
    todayCollected,
    todayGap,
    totalOverdueAmount,
  };
}
