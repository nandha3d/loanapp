// Server-computed detailed chit & per-member dividend ledger (STABLE-8).
// Both staff UI and customer/borrower portal render these authoritative figures
// directly without performing client-side arithmetic.

import prisma from '@/lib/db';
import { roundMoney } from './calculations';
import {
  calculateAscaMaturityDistribution,
  calculateChitPeriodEngine,
  calculateGoldValueMaturity,
  computeSubscriptionBalances,
  summarizeGoldWeightMember,
  type ChitPeriodCalculationBreakdown,
} from './engineCalculator';
import {
  CHIT_ENGINE_CATALOG,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
  type ChitEngineConfig,
  type ChitEngineType,
} from './engineTypes';
import { scopedChitGroupWhere } from './access';
import type { ChitScope } from './types';

export type MemberPeriodStatementRow = {
  periodNumber: number;
  dueDate: string;
  baseDue: number;
  dividendEarned: number;
  deferredDividend: number;
  dividendForfeited: boolean;
  premiumAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  netDue: number;
  paidAmount: number;
  outstanding: number;
  status: string;
  goldRateApplied: number | null;
  goldGramsCredited: number;
  wonThisPeriod: boolean;
  prizeAmount: number;
};

export type MemberDividendStatement = {
  memberId: string;
  customerId: string;
  customerCode: string;
  memberName: string;
  ticketNo: string | null;
  fractionNo: string | null;
  ticketShare: number;
  subscriberStatus: string;
  isForemanTicket: boolean;
  hasWon: boolean;
  wonPeriods: number[];
  prizeWonAmount: number;
  totalGrossBaseDue: number;
  totalDividendEarned: number;
  totalDividendAdjusted: number;
  totalDividendCashPaid: number;
  totalDeferredDividend: number;
  totalForfeitedDividend: number;
  totalPremiumCharged: number;
  totalWinnerInterest: number;
  totalPenalty: number;
  totalNetPayable: number;
  totalPaid: number;
  totalOutstanding: number;
  goldTotalGrams: number;
  goldWeightedAvgRate: number;
  maturityRedemptionValue: number;
  ascaProfitShare: number;
  netFinancialOutcome: number;
  effectiveSavingsPct: number;
  periods: MemberPeriodStatementRow[];
};

export type ChitPeriodLedgerSummary = {
  auctionId: string;
  periodNumber: number;
  auctionDate: string;
  status: string;
  payoutStatus: string;
  winnerNames: string[];
  winnerTicketNos: string[];
  prizeAmount: number;
  bidDiscount: number;
  commission: number;
  gstAmount: number;
  distributableDividend: number;
  dividendPerTicket: number;
  roundingIncome: number;
  forfeitedDividendTotal: number;
  netInstalmentPerFullTicket: number;
  reserveFloorAmount: number | null;
  breakdown: ChitPeriodCalculationBreakdown;
};

export type ChitGroupDividendLedger = {
  groupSummary: {
    id: string;
    name: string;
    groupCode: string | null;
    status: string;
    isCompleted: boolean;
    chitType: string;
    chitEngineType: ChitEngineType;
    engineName: string;
    regulatoryTier: string;
    payoutAssetType: string;
    collectionFrequency: string;
    dividendPolicy: string;
    dividendDistribution: string;
    chitValue: number;
    monthlyContrib: number;
    totalMembers: number;
    totalPeriods: number;
    completedPeriodsCount: number;
    totalGrossSubscriptions: number;
    totalDividendsDistributed: number;
    totalDeferredBonusPool: number;
    totalForfeitedDividends: number;
    totalForemanCommission: number;
    totalGst: number;
    totalRoundingIncome: number;
    totalPrizesDisbursed: number;
    totalCollected: number;
    totalOutstanding: number;
    totalGoldGramsAccumulated: number;
    ascaPoolSummary: {
      totalInterestEarned: number;
      totalAdminExpenses: number;
      netProfit: number;
      activeInternalLoansPrincipal: number;
    } | null;
    config: ChitEngineConfig;
  };
  periodSummaries: ChitPeriodLedgerSummary[];
  memberStatements: MemberDividendStatement[];
};

function parseOrComputeAuctionBreakdown(
  auction: any,
  group: any,
  engineType: ChitEngineType,
  config: ChitEngineConfig,
  members: any[],
): ChitPeriodCalculationBreakdown {
  if (auction.calculationBreakdown) {
    try {
      const parsed = JSON.parse(auction.calculationBreakdown);
      if (parsed && typeof parsed === 'object') return parsed as ChitPeriodCalculationBreakdown;
    } catch {
      // fall through to deterministic recompute
    }
  }
  const winnerIds: string[] =
    auction.winners?.length > 0
      ? auction.winners.map((w: any) => w.memberId)
      : auction.winnerMemberId
        ? [auction.winnerMemberId]
        : [];

  return calculateChitPeriodEngine({
    engineType,
    config,
    chitValue: Number(group.chitValue),
    monthlyContrib: Number(group.monthlyContrib),
    totalMembers: group.totalMembers,
    periodNumber: auction.periodNumber,
    commissionPct: Number(group.commissionPct),
    commissionBasis: group.commissionBasis as any,
    gstPct: group.gstPct != null ? Number(group.gstPct) : null,
    dividendPolicy: group.dividendPolicy,
    dividendDistribution: group.dividendDistribution,
    dividendRounding: group.dividendRounding,
    winnerInterestType: group.winnerInterestType,
    winnerInterestValue: group.winnerInterestValue != null ? Number(group.winnerInterestValue) : null,
    winnerInterestPeriods: group.winnerInterestPeriods,
    winnerMemberIds: winnerIds,
    prizeAmount: auction.prizeAmount != null ? Number(auction.prizeAmount) : null,
    fixedDiscountPct: group.fixedDiscountPct != null ? Number(group.fixedDiscountPct) : null,
    goldRatePerGram: auction.goldRatePerGram != null ? Number(auction.goldRatePerGram) : null,
    multiDivisionWinners: auction.winners?.length
      ? auction.winners.map((w: any) => ({
          memberId: w.memberId,
          winType: w.winType,
          prizeAmount: Number(w.prizeAmount),
          bidDiscount: Number(w.bidDiscount),
        }))
      : undefined,
    members: members.map((m) => ({
      memberId: m.id,
      memberName: m.customer.name,
      ticketNo: m.ticketNo,
      fractionNo: m.fractionNo,
      ticketShare: Number(m.ticketShare),
      hasWonBeforePeriod: false,
      isActive: m.subscriberStatus === 'active',
    })),
  });
}

function buildLedgerFromLoadedGroup(
  group: any,
  poolTxns: any[],
): ChitGroupDividendLedger {
  const engineType = resolveEngineTypeFromGroup(group);
  const config = parseChitEngineConfig(group.engineConfig, engineType);
  const catalog = CHIT_ENGINE_CATALOG[engineType];

  const completedAuctions = group.auctions.filter((a: any) =>
    ['confirmed', 'paid', 'completed'].includes(a.status),
  );
  const totalPeriods = group.totalMembers;
  const isCompleted =
    group.status === 'closed' ||
    group.status === 'completed' ||
    (totalPeriods > 0 && completedAuctions.length >= totalPeriods);

  const periodSummaries: ChitPeriodLedgerSummary[] = completedAuctions.map((a: any) => {
    const breakdown = parseOrComputeAuctionBreakdown(a, group, engineType, config, group.members);
    const winnersList = a.winners?.length
      ? a.winners.map((w: any) => ({
          name: w.member?.customer?.name ?? '—',
          ticketNo: w.member?.ticketNo ?? String(w.member?.memberNumber ?? '—'),
        }))
      : a.winnerMember
        ? [
            {
              name: a.winnerMember.customer?.name ?? '—',
              ticketNo: a.winnerMember.ticketNo ?? String(a.winnerMember.memberNumber ?? '—'),
            },
          ]
        : [];

    return {
      auctionId: a.id,
      periodNumber: a.periodNumber,
      auctionDate: a.auctionDate.toISOString(),
      status: a.status,
      payoutStatus: a.payoutStatus,
      winnerNames: winnersList.map((w: any) => w.name),
      winnerTicketNos: winnersList.map((w: any) => w.ticketNo),
      prizeAmount: breakdown.prizeAmount,
      bidDiscount: breakdown.bidDiscount,
      commission: breakdown.commission,
      gstAmount: breakdown.gstAmount,
      distributableDividend: breakdown.distributableDividend,
      dividendPerTicket: breakdown.dividendPerTicket,
      roundingIncome: breakdown.roundingIncome,
      forfeitedDividendTotal: breakdown.forfeitedDividendTotal,
      netInstalmentPerFullTicket: roundMoney(
        Math.max(
          0,
          breakdown.baseInstalment -
            (group.dividendDistribution === 'ADJUST_NEXT_DUE' ? breakdown.dividendPerTicket : 0),
        ),
      ),
      reserveFloorAmount: breakdown.reserveFloorAmount,
      breakdown,
    };
  });

  // ASCA pool computations (if applicable)
  let ascaPoolSummary: ChitGroupDividendLedger['groupSummary']['ascaPoolSummary'] = null;
  let ascaSharesByMember = new Map<string, number>();
  if (engineType === 'ASCA_SHG_REVOLVING') {
    const totalInterestEarned = roundMoney(
      poolTxns.reduce(
        (s, t) => s + (t.txnType === 'interest_income' || t.txnType === 'internal_loan_repay' ? Number(t.interestAmount || 0) : 0),
        0,
      ),
    );
    const totalAdminExpenses = roundMoney(
      poolTxns.reduce((s, t) => s + (t.txnType === 'admin_expense' ? Number(t.principalAmount || 0) : 0), 0),
    );
    const disbursed = poolTxns.reduce(
      (s, t) => s + (t.txnType === 'internal_loan_disburse' ? Number(t.principalAmount || 0) : 0),
      0,
    );
    const repaid = poolTxns.reduce(
      (s, t) => s + (t.txnType === 'internal_loan_repay' ? Number(t.principalAmount || 0) : 0),
      0,
    );
    const ascaCalc = calculateAscaMaturityDistribution({
      members: group.members.map((m: any) => ({
        memberId: m.id,
        ticketShare: Number(m.ticketShare),
        totalContributed: m.subscriptions.reduce((s: number, sub: any) => s + Number(sub.paidAmount || 0), 0),
      })),
      totalInterestEarned,
      totalAdminExpenses,
    });
    ascaPoolSummary = {
      totalInterestEarned,
      totalAdminExpenses,
      netProfit: ascaCalc.netProfit,
      activeInternalLoansPrincipal: roundMoney(Math.max(0, disbursed - repaid)),
    };
    ascaSharesByMember = new Map(ascaCalc.memberShares.map((s) => [s.memberId, s.profitDividendShare]));
  }

  // Build per-member detailed statements
  const memberStatements: MemberDividendStatement[] = group.members.map((m: any) => {
    const ticketShare = Number(m.ticketShare);
    const wonEntriesByPeriod = new Map<number, number>();
    for (const a of completedAuctions) {
      if (a.winners?.length) {
        const match = a.winners.find((w: any) => w.memberId === m.id);
        if (match) wonEntriesByPeriod.set(a.periodNumber, Number(match.prizeAmount || 0));
      } else if (a.winnerMemberId === m.id) {
        wonEntriesByPeriod.set(a.periodNumber, Number(a.prizeAmount || 0));
      }
    }

    const wonPeriods = Array.from(wonEntriesByPeriod.keys()).sort((a, b) => a - b);
    const prizeWonAmount = roundMoney(Array.from(wonEntriesByPeriod.values()).reduce((s, v) => s + v, 0));

    // Also compute earned dividend from period breakdowns (covers period N and CASH_PAYOUT/DEFERRED)
    const earnedByPeriod = new Map<number, { earned: number; deferred: number; forfeited: number }>();
    for (const ps of periodSummaries) {
      const mb = ps.breakdown.memberBreakdowns.find((r) => r.memberId === m.id);
      if (mb) {
        earnedByPeriod.set(ps.periodNumber, {
          earned: mb.dividendEarned,
          deferred: mb.deferredDividend,
          forfeited: mb.forfeitedDividend,
        });
      }
    }

    const periods: MemberPeriodStatementRow[] = (m.subscriptions || []).map((sub: any) => {
      const bal = computeSubscriptionBalances(sub, group.dividendDistribution);
      // Dividend attributable to period P comes either from subscription row
      // (for ADJUST_NEXT_DUE, dividend for auction P lands on P+1) or from auction P snapshot.
      const subDiv = bal.dividendAmount;
      const periodAuctionStats = earnedByPeriod.get(sub.periodNumber);
      const dividendEarned =
        group.dividendDistribution === 'ADJUST_NEXT_DUE'
          ? subDiv
          : Math.max(subDiv, periodAuctionStats?.earned ?? 0);
      const deferredDividend =
        group.dividendDistribution === 'DEFERRED_BONUS_POOL' || group.dividendDistribution === 'ACCUMULATE'
          ? Math.max(bal.deferredDividendAmount, subDiv, periodAuctionStats?.deferred ?? 0)
          : bal.deferredDividendAmount;

      return {
        periodNumber: sub.periodNumber,
        dueDate: sub.dueDate.toISOString(),
        baseDue: bal.baseDueAmount,
        dividendEarned,
        deferredDividend,
        dividendForfeited: bal.dividendForfeited,
        premiumAmount: bal.premiumAmount,
        interestAmount: bal.interestAmount,
        penaltyAmount: bal.penaltyAmount,
        netDue: bal.netDue,
        paidAmount: bal.paidAmount,
        outstanding: bal.outstanding,
        status: sub.status,
        goldRateApplied: sub.goldRateApplied != null ? Number(sub.goldRateApplied) : null,
        goldGramsCredited: sub.goldGramsCredited != null ? Number(sub.goldGramsCredited) : 0,
        wonThisPeriod: wonEntriesByPeriod.has(sub.periodNumber),
        prizeAmount: wonEntriesByPeriod.get(sub.periodNumber) ?? 0,
      };
    });

    const totalGrossBaseDue = roundMoney(periods.reduce((s, p) => s + p.baseDue, 0));
    const totalDividendAdjusted =
      group.dividendDistribution === 'ADJUST_NEXT_DUE'
        ? roundMoney(periods.reduce((s, p) => s + p.dividendEarned, 0))
        : 0;
    const totalDividendCashPaid =
      group.dividendDistribution === 'CASH_PAYOUT'
        ? roundMoney(Array.from(earnedByPeriod.values()).reduce((s, e) => s + e.earned, 0))
        : 0;
    const totalDeferredDividend = roundMoney(periods.reduce((s, p) => s + p.deferredDividend, 0));
    const totalForfeitedDividend = roundMoney(
      Array.from(earnedByPeriod.values()).reduce((s, e) => s + e.forfeited, 0),
    );
    const totalDividendEarned = roundMoney(
      group.dividendDistribution === 'ADJUST_NEXT_DUE'
        ? periods.reduce((s, p) => s + p.dividendEarned, 0)
        : Math.max(
            Array.from(earnedByPeriod.values()).reduce((s, e) => s + e.earned, 0),
            totalDeferredDividend,
          ),
    );

    const totalPremiumCharged = roundMoney(periods.reduce((s, p) => s + p.premiumAmount, 0));
    const totalWinnerInterest = roundMoney(periods.reduce((s, p) => s + p.interestAmount, 0));
    const totalPenalty = roundMoney(periods.reduce((s, p) => s + p.penaltyAmount, 0));
    const totalNetPayable = roundMoney(periods.reduce((s, p) => s + p.netDue, 0));
    const totalPaid = roundMoney(periods.reduce((s, p) => s + p.paidAmount, 0));
    const totalOutstanding = roundMoney(periods.reduce((s, p) => s + p.outstanding, 0));

    const goldWeightSummary = summarizeGoldWeightMember(
      periods.map((p) => ({ paidAmount: p.paidAmount, gramsCredited: p.goldGramsCredited })),
    );

    let maturityRedemptionValue = 0;
    if (engineType === 'GOLD_VALUE_ACCUMULATION') {
      const gv = calculateGoldValueMaturity({
        totalInstalmentsPaid: totalPaid,
        monthlyContrib: roundMoney(Number(group.monthlyContrib) * ticketShare),
        bonusMonths: config.goldScheme?.bonusMonths ?? 0,
        bonusPct: config.goldScheme?.bonusPct ?? 0,
        goldRatePerGram: config.goldScheme?.defaultGoldRatePerGram ?? 0,
      });
      maturityRedemptionValue = gv.totalRedemptionValue;
    } else if (engineType === 'FESTIVAL_COMMODITY') {
      const bonus =
        (config.commodityScheme?.merchantBonusAmount ?? 0) > 0
          ? roundMoney((config.commodityScheme?.merchantBonusAmount ?? 0) * ticketShare)
          : roundMoney((totalPaid * (config.commodityScheme?.merchantBonusPct ?? 0)) / 100);
      maturityRedemptionValue = roundMoney(totalPaid + bonus);
    }

    const ascaProfitShare = ascaSharesByMember.get(m.id) ?? 0;
    const totalBenefitReceived = roundMoney(
      prizeWonAmount + maturityRedemptionValue + totalDividendCashPaid + totalDeferredDividend + ascaProfitShare,
    );
    const netFinancialOutcome = roundMoney(totalBenefitReceived - totalPaid);
    const effectiveSavingsPct =
      totalGrossBaseDue > 0 ? roundMoney((totalDividendEarned / totalGrossBaseDue) * 100) : 0;

    return {
      memberId: m.id,
      customerId: m.customerId,
      customerCode: m.customer.customerCode ?? '',
      memberName: m.customer.name,
      ticketNo: m.ticketNo,
      fractionNo: m.fractionNo ?? null,
      ticketShare,
      subscriberStatus: m.subscriberStatus,
      isForemanTicket: Boolean(m.isForemanTicket),
      hasWon: Boolean(m.hasWon),
      wonPeriods,
      prizeWonAmount,
      totalGrossBaseDue,
      totalDividendEarned,
      totalDividendAdjusted,
      totalDividendCashPaid,
      totalDeferredDividend,
      totalForfeitedDividend,
      totalPremiumCharged,
      totalWinnerInterest,
      totalPenalty,
      totalNetPayable,
      totalPaid,
      totalOutstanding,
      goldTotalGrams: goldWeightSummary.totalGrams,
      goldWeightedAvgRate: goldWeightSummary.weightedAvgRate,
      maturityRedemptionValue,
      ascaProfitShare,
      netFinancialOutcome,
      effectiveSavingsPct,
      periods,
    };
  });

  const groupSummary = {
    id: group.id,
    name: group.name,
    groupCode: group.groupCode,
    status: group.status,
    isCompleted,
    chitType: group.chitType,
    chitEngineType: engineType,
    engineName: catalog.name,
    regulatoryTier: config.regulatoryTier,
    payoutAssetType: config.payoutAssetType,
    collectionFrequency: config.collectionFrequency,
    dividendPolicy: group.dividendPolicy,
    dividendDistribution: group.dividendDistribution,
    chitValue: Number(group.chitValue),
    monthlyContrib: Number(group.monthlyContrib),
    totalMembers: group.totalMembers,
    totalPeriods,
    completedPeriodsCount: completedAuctions.length,
    totalGrossSubscriptions: roundMoney(memberStatements.reduce((s, m) => s + m.totalGrossBaseDue, 0)),
    totalDividendsDistributed: roundMoney(periodSummaries.reduce((s, p) => s + p.breakdown.totalDividendDistributed, 0)),
    totalDeferredBonusPool: roundMoney(memberStatements.reduce((s, m) => s + m.totalDeferredDividend, 0)),
    totalForfeitedDividends: roundMoney(periodSummaries.reduce((s, p) => s + p.forfeitedDividendTotal, 0)),
    totalForemanCommission: roundMoney(periodSummaries.reduce((s, p) => s + p.commission, 0)),
    totalGst: roundMoney(periodSummaries.reduce((s, p) => s + p.gstAmount, 0)),
    totalRoundingIncome: roundMoney(periodSummaries.reduce((s, p) => s + p.roundingIncome, 0)),
    totalPrizesDisbursed: roundMoney(
      completedAuctions.reduce((s: number, a: any) => {
        if (a.winners?.length) {
          return s + a.winners.reduce((ws: number, w: any) => ws + Number(w.prizeAmount || 0), 0);
        }
        return s + Number(a.prizeAmount || 0);
      }, 0),
    ),
    totalCollected: roundMoney(memberStatements.reduce((s, m) => s + m.totalPaid, 0)),
    totalOutstanding: roundMoney(memberStatements.reduce((s, m) => s + m.totalOutstanding, 0)),
    totalGoldGramsAccumulated: roundMoney(memberStatements.reduce((s, m) => s + m.goldTotalGrams, 0), 4),
    ascaPoolSummary,
    config,
  };

  return { groupSummary, periodSummaries, memberStatements };
}

/**
 * Staff-audience full group ledger — enforces tenantId, appType, and active branchId.
 */
export async function buildChitGroupDividendLedger(
  groupId: string,
  scope: ChitScope,
): Promise<ChitGroupDividendLedger | null> {
  const group = await prisma.chitGroup.findFirst({
    where: scopedChitGroupWhere(scope, { OR: [{ id: groupId }, { groupCode: groupId }] }),
    include: {
      members: {
        orderBy: { memberNumber: 'asc' },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          subscriptions: { orderBy: { periodNumber: 'asc' } },
        },
      },
      auctions: {
        orderBy: { periodNumber: 'asc' },
        include: {
          winnerMember: { include: { customer: { select: { id: true, name: true } } } },
          winners: { include: { member: { include: { customer: { select: { id: true, name: true } } } } } },
        },
      },
    },
  });
  if (!group) return null;

  const poolTxns =
    resolveEngineTypeFromGroup(group) === 'ASCA_SHG_REVOLVING'
      ? await prisma.chitPoolTransaction.findMany({
          where: { tenantId: scope.tenantId, appType: scope.appType, chitGroupId: group.id },
          orderBy: { txnDate: 'asc' },
        })
      : [];

  return buildLedgerFromLoadedGroup(group, poolTxns);
}

export type MemberPortalDividendStatement = {
  groupId: string;
  groupName: string;
  groupCode: string | null;
  groupStatus: string;
  isCompleted: boolean;
  chitEngineType: ChitEngineType;
  engineName: string;
  payoutAssetType: string;
  collectionFrequency: string;
  dividendPolicy: string;
  dividendDistribution: string;
  chitValue: number;
  monthlyContrib: number;
  totalPeriods: number;
  completedPeriodsCount: number;
  myStatement: MemberDividendStatement;
  completedPeriods: Array<{
    auctionId: string;
    periodNumber: number;
    auctionDate: string;
    winnerTicketNo: string | null;
    iWon: boolean;
    excludedFromDividend: boolean;
    forfeitedOnLate: boolean;
    chitValue: number;
    prizeAmount: number;
    bidDiscount: number;
    commissionPct: number;
    commissionBasis: 'BID_DISCOUNT' | 'CHIT_VALUE';
    commission: number;
    gstPct: number | null;
    gstAmount: number;
    distributableDividend: number;
    dividendEligibleMembers: number;
    dividendPerTicket: number;
    roundingIncome: number;
    myDividend: number;
    myDeferredDividend: number;
    myNextDue: number | null;
    foremanCompensationMode: string;
    reserveFloorAmount: number | null;
    multiDivisionWinners: Array<{ ticketNo: string | null; winType: string; prizeAmount: number; bidDiscount: number }> | null;
    formulaLines: ChitPeriodCalculationBreakdown['formulaLines'];
  }>;
};

/**
 * Customer / borrower portal dividend statement — strictly scoped to customerId + tenantId.
 * Never exposes other members' names or private payment details.
 */
export async function buildMemberChitDividendStatement(
  customerId: string,
  tenantId: string,
): Promise<MemberPortalDividendStatement[]> {
  const myMembers = await prisma.chitMember.findMany({
    where: { customerId, chitGroup: { tenantId, appType: 'chitfunds', deletedAt: null } },
    select: { id: true, chitGroupId: true },
    orderBy: { joinedAt: 'desc' },
  });
  if (!myMembers.length) return [];

  const groupIds = Array.from(new Set(myMembers.map((m) => m.chitGroupId)));
  const [groups, poolTxns] = await Promise.all([
    prisma.chitGroup.findMany({
      where: { id: { in: groupIds }, tenantId, appType: 'chitfunds', deletedAt: null },
      include: {
        members: {
          orderBy: { memberNumber: 'asc' },
          include: {
            customer: { select: { id: true, name: true, customerCode: true } },
            subscriptions: { orderBy: { periodNumber: 'asc' } },
          },
        },
        auctions: {
          orderBy: { periodNumber: 'asc' },
          include: {
            winnerMember: { include: { customer: { select: { id: true, name: true } } } },
            winners: { include: { member: { include: { customer: { select: { id: true, name: true } } } } } },
          },
        },
      },
    }),
    prisma.chitPoolTransaction.findMany({
      where: { tenantId, appType: 'chitfunds', chitGroupId: { in: groupIds } },
      orderBy: { txnDate: 'asc' },
    }),
  ]);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const results: MemberPortalDividendStatement[] = [];

  for (const membership of myMembers) {
    const group = groupById.get(membership.chitGroupId);
    if (!group) continue;
    const ledger = buildLedgerFromLoadedGroup(
      group,
      poolTxns.filter((t) => t.chitGroupId === group.id),
    );
    const myStatement = ledger.memberStatements.find((ms) => ms.memberId === membership.id);
    if (!myStatement) continue;

    const completedPeriods = ledger.periodSummaries.map((ps) => {
      const b = ps.breakdown;
      const myRow = b.memberBreakdowns.find((r) => r.memberId === membership.id);
      const iWon = myStatement.wonPeriods.includes(ps.periodNumber);
      const excludedFromDividend =
        (b.dividendPolicy === 'NON_WINNERS_ONLY' && iWon) ||
        (b.dividendPolicy === 'NON_PRIZED_ONLY' && (iWon || myRow?.roleThisPeriod === 'previously_prized'));

      return {
        auctionId: ps.auctionId,
        periodNumber: ps.periodNumber,
        auctionDate: ps.auctionDate,
        winnerTicketNo: ps.winnerTicketNos[0] ?? null,
        iWon,
        excludedFromDividend,
        forfeitedOnLate: myRow?.roleThisPeriod === 'forfeited_late',
        chitValue: b.chitValue,
        prizeAmount: b.prizeAmount,
        bidDiscount: b.bidDiscount,
        commissionPct: b.commissionPct,
        commissionBasis: b.commissionBasis,
        commission: b.commission,
        gstPct: group.gstPct != null ? Number(group.gstPct) : null,
        gstAmount: b.gstAmount,
        distributableDividend: b.distributableDividend,
        dividendEligibleMembers: b.dividendEligibleTickets,
        dividendPerTicket: b.dividendPerTicket,
        roundingIncome: b.roundingIncome,
        myDividend: myRow?.dividendEarned ?? 0,
        myDeferredDividend: myRow?.deferredDividend ?? 0,
        myNextDue: myRow?.netPayableNextPeriod ?? null,
        foremanCompensationMode: b.foremanCompensationMode,
        reserveFloorAmount: b.reserveFloorAmount,
        multiDivisionWinners: b.multiDivisionWinners
          ? b.multiDivisionWinners.map((w) => ({
              ticketNo: w.ticketNo,
              winType: w.winType,
              prizeAmount: w.prizeAmount,
              bidDiscount: w.bidDiscount,
            }))
          : null,
        formulaLines: b.formulaLines,
      };
    });

    results.push({
      groupId: ledger.groupSummary.id,
      groupName: ledger.groupSummary.name,
      groupCode: ledger.groupSummary.groupCode,
      groupStatus: ledger.groupSummary.status,
      isCompleted: ledger.groupSummary.isCompleted,
      chitEngineType: ledger.groupSummary.chitEngineType,
      engineName: ledger.groupSummary.engineName,
      payoutAssetType: ledger.groupSummary.payoutAssetType,
      collectionFrequency: ledger.groupSummary.collectionFrequency,
      dividendPolicy: ledger.groupSummary.dividendPolicy,
      dividendDistribution: ledger.groupSummary.dividendDistribution,
      chitValue: ledger.groupSummary.chitValue,
      monthlyContrib: ledger.groupSummary.monthlyContrib,
      totalPeriods: ledger.groupSummary.totalPeriods,
      completedPeriodsCount: ledger.groupSummary.completedPeriodsCount,
      myStatement,
      completedPeriods,
    });
  }

  return results;
}
