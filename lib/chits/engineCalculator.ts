// Pure 18-engine chit calculation core + subscription net-due helper.
// Zero Prisma / Next.js imports so every formula can run in pure unit tests,
// server components, web actions, and mobile v1 routes (STRUCT-2, TEST-2).

import { calculateChitAuction, roundMoney } from './calculations';
import {
  CHIT_ENGINE_CATALOG,
  type ChitEngineCategory,
  type ChitEngineConfig,
  type ChitEngineType,
  type ChitForemanCompensationMode,
  type ChitPayoutAssetType,
} from './engineTypes';
import type { ChitCommissionBasis, ChitWinnerInterestType } from './types';

function roundDividendDown(value: number, increment: number, roundTo = 2) {
  if (!increment || increment <= 0) return roundMoney(value, roundTo);
  return roundMoney(Math.floor(value / increment) * increment, roundTo);
}

export function calculateForemanCompensation(input: {
  chitValue: number;
  bidDiscount: number;
  periodNumber: number;
  mode: ChitForemanCompensationMode;
  commissionBasis: ChitCommissionBasis;
  commissionPct: number;
  flatFeeAmount?: number;
  reservedForemanCycles?: number[];
  gstPct?: number | null;
}) {
  const reserved = input.reservedForemanCycles ?? [];
  const isReservedForemanCycle =
    (input.mode === 'FREE_TICKET_CYCLE_1' && input.periodNumber === 1) ||
    (input.mode === 'FREE_TICKET_CYCLE_2' && input.periodNumber === 2) ||
    (input.mode === 'HYBRID' && reserved.includes(input.periodNumber)) ||
    reserved.includes(input.periodNumber);

  let commission = 0;
  if (isReservedForemanCycle || input.mode === 'ZERO_COMMISSION') {
    commission = 0;
  } else if (input.mode === 'FLAT_FEE') {
    commission = roundMoney(Math.max(0, input.flatFeeAmount ?? 0));
  } else {
    const base = input.commissionBasis === 'CHIT_VALUE' ? input.chitValue : input.bidDiscount;
    commission = roundMoney((Math.max(0, base) * Math.max(0, input.commissionPct)) / 100);
  }
  const gstAmount = roundMoney((commission * Math.max(0, input.gstPct ?? 0)) / 100);
  return { commission, gstAmount, isReservedForemanCycle };
}

/**
 * §2.2 Reserve-Price Auction (Sarkari Ghaata):
 * R_t = (x% * V) * (N - t + 1)
 */
export function calculateReserveFloor(input: {
  chitValue: number;
  totalPeriods: number;
  periodNumber: number;
  reservePriceStepPct: number;
  maxDiscountPct?: number | null;
}) {
  if (!(input.chitValue > 0)) throw new Error('Chit value must be greater than zero');
  if (!(input.totalPeriods > 0)) throw new Error('Total periods must be greater than zero');
  const remainingCycles = Math.max(1, input.totalPeriods - input.periodNumber + 1);
  const stepPct = Math.max(0, input.reservePriceStepPct);
  const rawFloor = roundMoney(((stepPct / 100) * input.chitValue) * remainingCycles);
  const maxAllowedAmount =
    input.maxDiscountPct != null && input.maxDiscountPct > 0
      ? roundMoney((input.maxDiscountPct / 100) * input.chitValue)
      : roundMoney(input.chitValue * 0.99);
  const reserveFloorAmount = roundMoney(Math.min(maxAllowedAmount, rawFloor));
  const reserveFloorPct = input.chitValue > 0 ? roundMoney((reserveFloorAmount / input.chitValue) * 100) : 0;
  return { reserveFloorAmount, reserveFloorPct, remainingCycles };
}

/**
 * §2.3 Multi-Division Chit (Kerala / KSFE model):
 * 1 (or L) lottery winner(s) at V - C, M auction winners at V - D_{j,t},
 * pooled dividend d_t = sum(max(0, D_{j,t} - C)) / eligibleTickets.
 */
export function calculateMultiDivisionCycle(input: {
  chitValue: number;
  commissionPerTicket: number;
  gstPct?: number | null;
  lotteryWinnersCount: number;
  auctionDiscounts: number[];
  eligibleTicketUnits: number;
  dividendRounding?: number;
}) {
  if (!(input.chitValue > 0)) throw new Error('Chit value must be greater than zero');
  const c = roundMoney(Math.max(0, input.commissionPerTicket));
  const eligible = Math.max(1, input.eligibleTicketUnits);

  const lotteryPayoutPerWinner = roundMoney(Math.max(1, input.chitValue - c));
  const auctionPayouts = input.auctionDiscounts.map((d) => ({
    bidDiscount: roundMoney(Math.max(0, d)),
    prizeAmount: roundMoney(Math.max(1, input.chitValue - Math.max(0, d))),
    netPoolContribution: roundMoney(Math.max(0, Math.max(0, d) - c)),
  }));

  const distributableDividend = roundMoney(
    auctionPayouts.reduce((sum, item) => sum + item.netPoolContribution, 0),
  );
  const rawDividend = distributableDividend / eligible;
  const dividendPerTicket = roundDividendDown(rawDividend, input.dividendRounding ?? 0);
  const roundingIncome = roundMoney(Math.max(0, distributableDividend - dividendPerTicket * eligible));
  const totalWinners = Math.max(0, input.lotteryWinnersCount) + input.auctionDiscounts.length;
  const totalCommission = roundMoney(c * totalWinners);
  const gstAmount = roundMoney((totalCommission * Math.max(0, input.gstPct ?? 0)) / 100);

  return {
    lotteryPayoutPerWinner,
    auctionPayouts,
    distributableDividend,
    dividendPerTicket,
    roundingIncome,
    totalCommission,
    gstAmount,
    totalDiscountPool: roundMoney(input.auctionDiscounts.reduce((sum, d) => sum + Math.max(0, d), 0)),
  };
}

/**
 * §2.4 Base + Premium (Differential Instalment) Chit:
 * Collected_t = (N * S_base) + (k_t * P_prem)
 */
export function calculateBasePlusPremiumCycle(input: {
  baseInstalment: number;
  prizedPremiumAmount: number;
  totalTicketUnits: number;
  alreadyPrizedTicketUnits: number;
  payoutAmount: number;
  commission: number;
}) {
  const nonPrizedInstalment = roundMoney(input.baseInstalment);
  const prizedInstalment = roundMoney(input.baseInstalment + input.prizedPremiumAmount);
  const collectedPool = roundMoney(
    input.totalTicketUnits * input.baseInstalment +
      input.alreadyPrizedTicketUnits * input.prizedPremiumAmount,
  );
  const poolSurplus = roundMoney(collectedPool - input.payoutAmount - input.commission);
  return {
    nonPrizedInstalment,
    prizedInstalment,
    collectedPool,
    alreadyPrizedTicketUnits: input.alreadyPrizedTicketUnits,
    poolSurplus,
  };
}

/**
 * §2.5 Gold Weight-Accumulation:
 * g_t = S_t / R_t (4 decimal places for milligram precision)
 */
export function calculateGoldWeightCredit(input: {
  paymentAmount: number;
  goldRatePerGram: number;
}): number {
  if (!(input.paymentAmount >= 0)) throw new Error('Payment amount cannot be negative');
  if (!(input.goldRatePerGram > 0)) throw new Error('Gold rate per gram must be greater than zero');
  return roundMoney(input.paymentAmount / input.goldRatePerGram, 4);
}

export function summarizeGoldWeightMember(
  credits: Array<{ paidAmount: number; gramsCredited: number }>,
) {
  const totalPaid = roundMoney(credits.reduce((s, c) => s + Number(c.paidAmount || 0), 0));
  const totalGrams = roundMoney(credits.reduce((s, c) => s + Number(c.gramsCredited || 0), 0), 4);
  const weightedAvgRate = totalGrams > 0 ? roundMoney(totalPaid / totalGrams) : 0;
  return { totalPaid, totalGrams, weightedAvgRate };
}

export function calculateGoldValueMaturity(input: {
  totalInstalmentsPaid: number;
  monthlyContrib: number;
  bonusMonths?: number;
  bonusPct?: number;
  goldRatePerGram?: number;
}) {
  const paid = roundMoney(Math.max(0, input.totalInstalmentsPaid));
  const bonusAmount =
    (input.bonusMonths ?? 0) > 0
      ? roundMoney((input.bonusMonths ?? 0) * input.monthlyContrib)
      : roundMoney((paid * (input.bonusPct ?? 0)) / 100);
  const totalRedemptionValue = roundMoney(paid + bonusAmount);
  const effectiveBonusPct = paid > 0 ? roundMoney((bonusAmount / paid) * 100) : 0;
  const indicativeGrams =
    input.goldRatePerGram && input.goldRatePerGram > 0
      ? roundMoney(totalRedemptionValue / input.goldRatePerGram, 4)
      : 0;
  return { totalInstalmentsPaid: paid, bonusAmount, totalRedemptionValue, effectiveBonusPct, indicativeGrams };
}

/**
 * §2.6 ASCA / SHG Revolving Pool:
 * Share_i = sum(S_{i,t}) + (u_i / sum(u_j)) * max(0, I_total - E_admin)
 */
export function calculateAscaMaturityDistribution(input: {
  members: Array<{ memberId: string; ticketShare: number; totalContributed: number }>;
  totalInterestEarned: number;
  totalAdminExpenses: number;
}) {
  const netProfit = roundMoney(Math.max(0, input.totalInterestEarned - input.totalAdminExpenses));
  const totalUnits = input.members.reduce((sum, m) => sum + Math.max(0, m.ticketShare), 0) || 1;
  const memberShares = input.members.map((m) => {
    const unitRatio = Math.max(0, m.ticketShare) / totalUnits;
    const profitDividendShare = roundMoney(unitRatio * netProfit);
    const totalPayout = roundMoney(m.totalContributed + profitDividendShare);
    return {
      memberId: m.memberId,
      ticketShare: m.ticketShare,
      totalContributed: roundMoney(m.totalContributed),
      profitDividendShare,
      totalPayout,
    };
  });
  const distributedProfit = roundMoney(memberShares.reduce((s, m) => s + m.profitDividendShare, 0));
  const roundingIncome = roundMoney(Math.max(0, netProfit - distributedProfit));
  return { netProfit, totalUnits, memberShares, roundingIncome };
}

export type ChitMemberEngineInput = {
  memberId: string;
  memberName: string;
  ticketNo: string | null;
  fractionNo?: string | null;
  ticketShare: number;
  hasWonBeforePeriod: boolean;
  isActive?: boolean;
  isLateThisPeriod?: boolean;
};

export type ChitMultiDivisionWinnerInput = {
  memberId: string;
  winType: 'lottery' | 'auction' | string;
  prizeAmount: number;
  bidDiscount: number;
};

export type ChitPeriodMemberBreakdown = {
  memberId: string;
  memberName: string;
  ticketNo: string | null;
  fractionNo: string | null;
  ticketShare: number;
  roleThisPeriod: 'winner' | 'previously_prized' | 'non_prized' | 'forfeited_late' | 'inactive';
  baseInstalment: number;
  dividendEarned: number;
  nextDueDividendCredit: number;
  deferredDividend: number;
  forfeitedDividend: number;
  premiumAdded: number;
  winnerInterestAdded: number;
  netPayableNextPeriod: number;
  goldGramsCredited: number;
};

export type ChitFormulaLine = {
  label: string;
  amount: number;
  sign: '+' | '-' | '=' | 'info';
};

export type ChitPeriodCalculationBreakdown = {
  engineType: ChitEngineType;
  engineCategory: ChitEngineCategory;
  periodNumber: number;
  totalPeriods: number;
  chitValue: number;
  baseInstalment: number;
  prizeAmount: number;
  bidDiscount: number;
  reserveFloorAmount: number | null;
  foremanCompensationMode: ChitForemanCompensationMode;
  commissionBasis: ChitCommissionBasis;
  commissionPct: number;
  flatFeeAmount: number;
  commission: number;
  gstPct: number;
  gstAmount: number;
  distributableDividend: number;
  dividendPolicy: string;
  dividendDistribution: string;
  dividendEligibleTickets: number;
  dividendPerTicket: number;
  roundingIncome: number;
  totalDividendDistributed: number;
  forfeitedDividendTotal: number;
  payoutAssetType: ChitPayoutAssetType;
  hybridPhase?: 'reserved' | 'auction';
  multiDivisionWinners?: Array<{
    memberId: string;
    memberName: string;
    ticketNo: string | null;
    winType: string;
    prizeAmount: number;
    bidDiscount: number;
    commission: number;
    gstAmount: number;
  }>;
  basePlusPremiumDetails?: ReturnType<typeof calculateBasePlusPremiumCycle>;
  goldDetails?: {
    goldRatePerGram: number;
    gramsPerFullTicket: number;
    bonusMonths: number;
    bonusPct: number;
  };
  commodityDetails?: {
    itemsSummary: string;
    merchantBonusAmount: number;
    merchantBonusPct: number;
  };
  ascaDetails?: {
    monthlyLoanInterestPct: number;
    adminExpensePerCycle: number;
  };
  formulaLines: ChitFormulaLine[];
  memberBreakdowns: ChitPeriodMemberBreakdown[];
};

export function calculateChitPeriodEngine(input: {
  engineType: ChitEngineType;
  config: ChitEngineConfig;
  chitValue: number;
  monthlyContrib: number;
  totalMembers: number;
  periodNumber: number;
  commissionPct: number;
  commissionBasis?: ChitCommissionBasis;
  gstPct?: number | null;
  dividendPolicy?: string;
  dividendDistribution?: string;
  dividendRounding?: number;
  winnerInterestType?: ChitWinnerInterestType | string;
  winnerInterestValue?: number | null;
  winnerInterestPeriods?: number | null;
  winnerMemberIds: string[];
  prizeAmount?: number | null;
  fixedDiscountPct?: number | null;
  multiDivisionWinners?: ChitMultiDivisionWinnerInput[];
  goldRatePerGram?: number | null;
  members: ChitMemberEngineInput[];
}): ChitPeriodCalculationBreakdown {
  const {
    engineType,
    config,
    chitValue,
    monthlyContrib,
    totalMembers,
    periodNumber,
    winnerMemberIds,
    members,
  } = input;
  const category = CHIT_ENGINE_CATALOG[engineType].category;
  const commissionBasis: ChitCommissionBasis = input.commissionBasis ?? 'BID_DISCOUNT';
  const gstPct = Number(input.gstPct ?? 0);
  const dividendRounding = input.dividendRounding ?? 0;
  const foremanMode = config.foremanCompensation.mode;
  // Prefer explicit input.commissionPct (STABLE / group column) over default config value (F5)
  const commissionPct =
    typeof input.commissionPct === 'number' && Number.isFinite(input.commissionPct)
      ? input.commissionPct
      : config.foremanCompensation.commissionPct;
  const flatFeeAmount = config.foremanCompensation.flatFeeAmount ?? 0;
  const reservedForemanCycles = config.foremanCompensation.reservedForemanCycles ?? [];

  // Resolve effective dividend policy & distribution mode
  let dividendPolicy = input.dividendPolicy ?? 'ALL_MEMBERS';
  if (config.dividendDistributionMode === 'NON_PRIZED_ONLY') dividendPolicy = 'NON_PRIZED_ONLY';
  else if (config.dividendDistributionMode === 'NON_WINNERS_ONLY') dividendPolicy = 'NON_WINNERS_ONLY';
  else if (config.dividendDistributionMode === 'NONE') dividendPolicy = 'NONE';

  let dividendDistribution = input.dividendDistribution ?? 'ADJUST_NEXT_DUE';
  if (config.dividendDistributionMode === 'DEFERRED_BONUS_POOL') dividendDistribution = 'DEFERRED_BONUS_POOL';
  else if (config.dividendDistributionMode === 'NONE') dividendDistribution = 'NONE';

  // Determine base instalment for current & next cycle
  const baseInstalment =
    engineType === 'BASE_PLUS_PREMIUM' && config.differentialInstalment.baseInstalment > 0
      ? config.differentialInstalment.baseInstalment
      : monthlyContrib;

  const customRow =
    engineType === 'CUSTOM_MANUAL_SCHEDULE'
      ? config.customSchedule?.find((r) => r.period === periodNumber)
      : undefined;
  const nextCustomRow =
    engineType === 'CUSTOM_MANUAL_SCHEDULE'
      ? config.customSchedule?.find((r) => r.period === periodNumber + 1)
      : undefined;
  const varNextRow =
    engineType === 'FIXED_PAYOUT_VARIABLE_PAY'
      ? config.variableInstalments?.find((r) => r.period === periodNumber + 1) ??
        config.variableInstalments?.find((r) => r.period === periodNumber)
      : undefined;

  let reserveFloorAmount: number | null = null;
  if (engineType === 'AUCTION_RESERVE_PRICE') {
    const floor = calculateReserveFloor({
      chitValue,
      totalPeriods: totalMembers,
      periodNumber,
      reservePriceStepPct: config.discountRules.reservePriceStepPct,
      maxDiscountPct: config.discountRules.uncapped ? null : config.discountRules.maxDiscountPct,
    });
    reserveFloorAmount = floor.reserveFloorAmount;
  }

  let hybridPhase: 'reserved' | 'auction' | undefined;
  if (engineType === 'HYBRID_SPLIT_PHASE') {
    const reservedCount = config.hybridSplitPhase?.reservedCyclesCount ?? 0;
    hybridPhase = periodNumber <= reservedCount ? 'reserved' : 'auction';
  }

  // Resolve prize & discount based on engine type
  let prizeAmount = input.prizeAmount ?? chitValue;
  if (input.prizeAmount == null) {
    if (engineType === 'FIXED_CHART_ESCALATING') {
      const row = config.escalatingPayouts?.find((r) => r.period === periodNumber);
      prizeAmount = row ? row.payoutAmount : chitValue;
    } else if (engineType === 'CUSTOM_MANUAL_SCHEDULE' && customRow) {
      prizeAmount = customRow.payoutAmount;
    } else if (engineType === 'HYBRID_SPLIT_PHASE' && hybridPhase === 'reserved') {
      const pct = config.hybridSplitPhase?.reservedDiscountPct ?? 0;
      prizeAmount = roundMoney(chitValue * (1 - pct / 100));
    } else if (engineType === 'FIXED_DIVIDEND') {
      const row = config.fixedDividends?.find((r) => r.period === periodNumber);
      const targetDiv = row ? row.dividendPerTicket : 0;
      const approxEst = targetDiv * totalMembers;
      prizeAmount = Math.max(1, roundMoney(chitValue - approxEst));
    } else if (input.fixedDiscountPct && input.fixedDiscountPct > 0) {
      prizeAmount = Math.max(1, roundMoney(chitValue * (1 - input.fixedDiscountPct / 100)));
    }
  }
  // Allow bonus maturity/commodity/escalating schedule payouts above chitValue (F7)
  const allowsAboveChitValue = [
    'FIXED_CHART_ESCALATING',
    'CUSTOM_MANUAL_SCHEDULE',
    'GOLD_VALUE_ACCUMULATION',
    'GOLD_WEIGHT_ACCUMULATION',
    'FESTIVAL_COMMODITY',
  ].includes(engineType);
  prizeAmount = roundMoney(Math.max(1, allowsAboveChitValue ? prizeAmount : Math.min(chitValue, prizeAmount)));
  let bidDiscount = roundMoney(Math.max(0, chitValue - prizeAmount));

  // Eligible ticket units according to dividend policy
  const activeMembers = members.filter((m) => m.isActive !== false);
  const allTicketUnits = activeMembers.reduce((sum, m) => sum + Number(m.ticketShare), 0) || totalMembers;
  const isMemberEligibleForDividend = (m: ChitMemberEngineInput): boolean => {
    if (dividendPolicy === 'NONE' || dividendDistribution === 'NONE') return false;
    if (m.isActive === false) return false;
    const isWinner = winnerMemberIds.includes(m.memberId);
    if (dividendPolicy === 'NON_WINNERS_ONLY' && isWinner) return false;
    if (dividendPolicy === 'NON_PRIZED_ONLY' && (isWinner || m.hasWonBeforePeriod)) return false;
    return true;
  };
  const rawEligibleTickets = activeMembers
    .filter(isMemberEligibleForDividend)
    .reduce((sum, m) => sum + Number(m.ticketShare), 0);
  // Only fall back when no member rows exist (synthetic calculator preview); real zero-eligible groups stay 0 (F9).
  const dividendEligibleTickets = roundMoney(
    members.length > 0
      ? rawEligibleTickets
      : dividendPolicy === 'ALL_MEMBERS'
        ? totalMembers
        : dividendPolicy === 'NON_WINNERS_ONLY'
          ? Math.max(0, totalMembers - 1)
          : 0,
    4,
  );

  // Commission, distributable dividend, dividendPerTicket, roundingIncome
  let commission = 0;
  let gstAmount = 0;
  let distributableDividend = 0;
  let dividendPerTicket = 0;
  let roundingIncome = 0;
  let multiDivisionDetails: ChitPeriodCalculationBreakdown['multiDivisionWinners'];

  if (engineType === 'AUCTION_MULTI_DIVISION' && input.multiDivisionWinners?.length) {
    const perWinnerComm = calculateForemanCompensation({
      chitValue,
      bidDiscount: 0,
      periodNumber,
      mode: foremanMode,
      commissionBasis: 'CHIT_VALUE',
      commissionPct,
      flatFeeAmount,
      reservedForemanCycles,
      gstPct,
    }).commission;
    const lotteryCount = input.multiDivisionWinners.filter((w) => w.winType === 'lottery').length;
    const auctionDiscounts = input.multiDivisionWinners
      .filter((w) => w.winType !== 'lottery')
      .map((w) => w.bidDiscount);
    const md = calculateMultiDivisionCycle({
      chitValue,
      commissionPerTicket: perWinnerComm,
      gstPct,
      lotteryWinnersCount: lotteryCount,
      auctionDiscounts,
      eligibleTicketUnits: dividendEligibleTickets,
      dividendRounding,
    });
    commission = md.totalCommission;
    gstAmount = md.gstAmount;
    const noDividend = dividendPolicy === 'NONE' || dividendDistribution === 'NONE' || dividendEligibleTickets <= 0;
    distributableDividend = noDividend ? 0 : md.distributableDividend;
    dividendPerTicket = noDividend ? 0 : md.dividendPerTicket;
    roundingIncome = noDividend ? 0 : md.roundingIncome;
    bidDiscount = md.totalDiscountPool;
    prizeAmount = roundMoney(
      input.multiDivisionWinners.reduce((sum, w) => sum + w.prizeAmount, 0) / input.multiDivisionWinners.length,
    );
    multiDivisionDetails = input.multiDivisionWinners.map((w) => {
      const m = members.find((mem) => mem.memberId === w.memberId);
      const comm = perWinnerComm;
      return {
        memberId: w.memberId,
        memberName: m?.memberName ?? 'Member',
        ticketNo: m?.ticketNo ?? null,
        winType: w.winType,
        prizeAmount: roundMoney(w.prizeAmount),
        bidDiscount: roundMoney(w.bidDiscount),
        commission: comm,
        gstAmount: roundMoney((comm * gstPct) / 100),
      };
    });
  } else if (
    engineType === 'AUCTION_STANDARD' &&
    foremanMode === 'PERCENTAGE_COMMISSION' &&
    (dividendPolicy === 'ALL_MEMBERS' || dividendPolicy === 'NON_WINNERS_ONLY') &&
    Math.abs(allTicketUnits - totalMembers) < 0.001
  ) {
    // CHIT-1 exact delegation for standard auctions
    const std = calculateChitAuction({
      chitValue,
      prizeAmount,
      commissionPct,
      totalMembers,
      dividendPolicy: dividendPolicy as 'ALL_MEMBERS' | 'NON_WINNERS_ONLY',
      commissionBasis,
      gstPct,
      dividendRounding,
    });
    commission = std.commission;
    gstAmount = std.gstAmount;
    distributableDividend = dividendDistribution === 'NONE' ? 0 : std.distributableDividend;
    dividendPerTicket = dividendDistribution === 'NONE' ? 0 : std.dividend;
    roundingIncome = dividendDistribution === 'NONE' ? 0 : std.roundingIncome;
  } else {
    const fc = calculateForemanCompensation({
      chitValue,
      bidDiscount,
      periodNumber,
      mode: foremanMode,
      commissionBasis,
      commissionPct,
      flatFeeAmount,
      reservedForemanCycles,
      gstPct,
    });
    commission = customRow ? roundMoney(customRow.commission) : fc.commission;
    gstAmount = roundMoney((commission * gstPct) / 100);

    if (dividendEligibleTickets <= 0 || dividendPolicy === 'NONE' || dividendDistribution === 'NONE') {
      distributableDividend = 0;
      dividendPerTicket = 0;
      roundingIncome = 0;
    } else if (engineType === 'FIXED_DIVIDEND') {
      const fixedRow = config.fixedDividends?.find((r) => r.period === periodNumber);
      const rawDiv = fixedRow ? fixedRow.dividendPerTicket : roundMoney(Math.max(0, bidDiscount - commission) / dividendEligibleTickets);
      dividendPerTicket = roundDividendDown(rawDiv, dividendRounding);
      distributableDividend = roundMoney(dividendPerTicket * dividendEligibleTickets);
      roundingIncome = 0;
    } else if (engineType === 'CUSTOM_MANUAL_SCHEDULE' && customRow?.dividendPerTicket != null) {
      dividendPerTicket = roundDividendDown(customRow.dividendPerTicket, dividendRounding);
      distributableDividend = roundMoney(dividendPerTicket * dividendEligibleTickets);
      roundingIncome = 0;
    } else if (
      ['GOLD_VALUE_ACCUMULATION', 'GOLD_WEIGHT_ACCUMULATION', 'FESTIVAL_COMMODITY', 'ASCA_SHG_REVOLVING'].includes(engineType)
    ) {
      distributableDividend = 0;
      dividendPerTicket = 0;
      roundingIncome = 0;
    } else {
      distributableDividend = roundMoney(Math.max(0, bidDiscount - commission));
      const rawDiv = dividendEligibleTickets > 0 ? distributableDividend / dividendEligibleTickets : 0;
      dividendPerTicket = roundDividendDown(rawDiv, dividendRounding);
      roundingIncome = roundMoney(Math.max(0, distributableDividend - dividendPerTicket * dividendEligibleTickets));
    }
  }

  // Engine-specific metadata blocks
  let basePlusPremiumDetails: ChitPeriodCalculationBreakdown['basePlusPremiumDetails'];
  if (engineType === 'BASE_PLUS_PREMIUM') {
    const prizedUnits = activeMembers
      .filter((m) => m.hasWonBeforePeriod)
      .reduce((s, m) => s + Number(m.ticketShare), 0);
    basePlusPremiumDetails = calculateBasePlusPremiumCycle({
      baseInstalment,
      prizedPremiumAmount: config.differentialInstalment.prizedPremiumAmount,
      totalTicketUnits: allTicketUnits,
      alreadyPrizedTicketUnits: prizedUnits,
      payoutAmount: prizeAmount,
      commission,
    });
  }

  const effectiveGoldRate = Number(input.goldRatePerGram ?? config.goldScheme?.defaultGoldRatePerGram ?? 0);
  const goldDetails =
    engineType === 'GOLD_VALUE_ACCUMULATION' || engineType === 'GOLD_WEIGHT_ACCUMULATION'
      ? {
          goldRatePerGram: effectiveGoldRate,
          gramsPerFullTicket:
            engineType === 'GOLD_WEIGHT_ACCUMULATION' && effectiveGoldRate > 0
              ? calculateGoldWeightCredit({ paymentAmount: baseInstalment, goldRatePerGram: effectiveGoldRate })
              : 0,
          bonusMonths: config.goldScheme?.bonusMonths ?? 0,
          bonusPct: config.goldScheme?.bonusPct ?? 0,
        }
      : undefined;

  const commodityDetails =
    engineType === 'FESTIVAL_COMMODITY' && config.commodityScheme
      ? {
          itemsSummary: config.commodityScheme.itemsSummary,
          merchantBonusAmount: config.commodityScheme.merchantBonusAmount,
          merchantBonusPct: config.commodityScheme.merchantBonusPct,
        }
      : undefined;

  const ascaDetails =
    engineType === 'ASCA_SHG_REVOLVING' && config.ascaPool
      ? {
          monthlyLoanInterestPct: config.ascaPool.monthlyLoanInterestPct,
          adminExpensePerCycle: config.ascaPool.adminExpensePerCycle,
        }
      : undefined;

  // Winner interest per period (if winner wins this cycle & has remaining cycles)
  const wType = (input.winnerInterestType ?? 'NONE') as ChitWinnerInterestType;
  const wVal = Number(input.winnerInterestValue ?? 0);
  const wPeriods = Math.max(0, Math.trunc(Number(input.winnerInterestPeriods ?? 0)));
  const winnerInterestAmount =
    periodNumber < totalMembers && wPeriods > 0 && wVal > 0
      ? wType === 'FIXED'
        ? roundMoney(wVal)
        : wType === 'PERCENT'
          ? roundMoney((chitValue * wVal) / 100)
          : 0
      : 0;

  // Per-member dividend & next-due breakdown
  let totalDividendDistributed = 0;
  let forfeitedDividendTotal = 0;
  const memberBreakdowns: ChitPeriodMemberBreakdown[] = members.map((m) => {
    const share = Number(m.ticketShare);
    const isWinner = winnerMemberIds.includes(m.memberId);
    const isPrizedAfterThisCycle = isWinner || m.hasWonBeforePeriod;
    const eligible = isMemberEligibleForDividend(m);
    const rawDividend = eligible ? roundMoney(dividendPerTicket * share) : 0;
    const isLateForfeited = Boolean(config.defaultRules.forfeitDividendOnLate && m.isLateThisPeriod && rawDividend > 0);

    const dividendEarned = isLateForfeited ? 0 : rawDividend;
    const forfeitedDividend = isLateForfeited ? rawDividend : 0;
    const nextDueDividendCredit = dividendDistribution === 'ADJUST_NEXT_DUE' ? dividendEarned : 0;
    const deferredDividend =
      dividendDistribution === 'DEFERRED_BONUS_POOL' || dividendDistribution === 'ACCUMULATE'
        ? dividendEarned
        : 0;

    totalDividendDistributed = roundMoney(totalDividendDistributed + dividendEarned);
    forfeitedDividendTotal = roundMoney(forfeitedDividendTotal + forfeitedDividend);

    let nextBaseFull = baseInstalment;
    if (engineType === 'CUSTOM_MANUAL_SCHEDULE' && nextCustomRow) {
      nextBaseFull = isPrizedAfterThisCycle ? nextCustomRow.instalmentPrized : nextCustomRow.instalmentNonPrized;
    } else if (engineType === 'FIXED_PAYOUT_VARIABLE_PAY' && varNextRow) {
      nextBaseFull = isPrizedAfterThisCycle ? varNextRow.prizedDue : varNextRow.nonPrizedDue;
    }

    const premiumAdded =
      engineType === 'BASE_PLUS_PREMIUM' && isPrizedAfterThisCycle
        ? roundMoney(config.differentialInstalment.prizedPremiumAmount * share)
        : 0;
    const winnerInterestAdded = isWinner ? winnerInterestAmount : 0;
    const memberBaseInstalment = roundMoney(nextBaseFull * share);
    const netPayableNextPeriod =
      periodNumber >= totalMembers
        ? 0
        : roundMoney(
            Math.max(0, memberBaseInstalment - nextDueDividendCredit + premiumAdded + winnerInterestAdded),
          );

    const goldGramsCredited =
      engineType === 'GOLD_WEIGHT_ACCUMULATION' && effectiveGoldRate > 0
        ? calculateGoldWeightCredit({ paymentAmount: roundMoney(baseInstalment * share), goldRatePerGram: effectiveGoldRate })
        : 0;

    const roleThisPeriod: ChitPeriodMemberBreakdown['roleThisPeriod'] =
      m.isActive === false
        ? 'inactive'
        : isWinner
          ? 'winner'
          : isLateForfeited
            ? 'forfeited_late'
            : m.hasWonBeforePeriod
              ? 'previously_prized'
              : 'non_prized';

    return {
      memberId: m.memberId,
      memberName: m.memberName,
      ticketNo: m.ticketNo,
      fractionNo: m.fractionNo ?? null,
      ticketShare: share,
      roleThisPeriod,
      baseInstalment: memberBaseInstalment,
      dividendEarned,
      nextDueDividendCredit,
      deferredDividend,
      forfeitedDividend,
      premiumAdded,
      winnerInterestAdded,
      netPayableNextPeriod,
      goldGramsCredited,
    };
  });

  const formulaLines: ChitFormulaLine[] = [
    { label: 'Chit value', amount: chitValue, sign: 'info' },
    ...(reserveFloorAmount != null
      ? [{ label: 'Reserve floor discount (R_t)', amount: reserveFloorAmount, sign: 'info' as const }]
      : []),
    { label: 'Prize payout', amount: prizeAmount, sign: '-' },
    { label: 'Bid discount', amount: bidDiscount, sign: '=' },
    { label: `Foreman commission (${foremanMode})`, amount: commission, sign: '-' },
    ...(gstAmount > 0 ? [{ label: `GST (${gstPct}%)`, amount: gstAmount, sign: 'info' as const }] : []),
    { label: 'Distributable dividend pool', amount: distributableDividend, sign: '=' },
    { label: 'Dividend per full ticket', amount: dividendPerTicket, sign: '=' },
    ...(roundingIncome > 0 ? [{ label: 'Rounding income (foreman)', amount: roundingIncome, sign: 'info' as const }] : []),
    ...(forfeitedDividendTotal > 0
      ? [{ label: 'Forfeited late-payer dividend', amount: forfeitedDividendTotal, sign: 'info' as const }]
      : []),
  ];

  return {
    engineType,
    engineCategory: category,
    periodNumber,
    totalPeriods: totalMembers,
    chitValue: roundMoney(chitValue),
    baseInstalment: roundMoney(baseInstalment),
    prizeAmount: roundMoney(prizeAmount),
    bidDiscount: roundMoney(bidDiscount),
    reserveFloorAmount,
    foremanCompensationMode: foremanMode,
    commissionBasis,
    commissionPct,
    flatFeeAmount,
    commission,
    gstPct,
    gstAmount,
    distributableDividend,
    dividendPolicy,
    dividendDistribution,
    dividendEligibleTickets,
    dividendPerTicket,
    roundingIncome,
    totalDividendDistributed,
    forfeitedDividendTotal,
    payoutAssetType: config.payoutAssetType,
    hybridPhase,
    multiDivisionWinners: multiDivisionDetails,
    basePlusPremiumDetails,
    goldDetails,
    commodityDetails,
    ascaDetails,
    formulaLines,
    memberBreakdowns,
  };
}

/**
 * Single authoritative net-due & outstanding balance calculator for a ChitSubscription row.
 * Fixes double-subtraction when dividendDistribution === 'ADJUST_NEXT_DUE' (since
 * finalizeAuctionInTx already decremented `dueAmount` when crediting the next due).
 */
export function computeSubscriptionBalances(
  sub: {
    dueAmount: number | string | { toString(): string };
    baseDueAmount?: number | string | { toString(): string } | null;
    dividendAmount?: number | string | { toString(): string } | null;
    deferredDividendAmount?: number | string | { toString(): string } | null;
    premiumAmount?: number | string | { toString(): string } | null;
    interestAmount?: number | string | { toString(): string } | null;
    penaltyAmount?: number | string | { toString(): string } | null;
    paidAmount?: number | string | { toString(): string } | null;
    dividendForfeited?: boolean | null;
  },
  dividendDistribution: string | null | undefined,
) {
  const dueAmount = Number(sub.dueAmount || 0);
  const dividendAmount = Number(sub.dividendAmount || 0);
  const deferredDividendAmount = Number(sub.deferredDividendAmount || 0);
  const premiumAmount = Number(sub.premiumAmount || 0);
  const interestAmount = Number(sub.interestAmount || 0);
  const penaltyAmount = Number(sub.penaltyAmount || 0);
  const paidAmount = Number(sub.paidAmount || 0);

  const isAdjustedInDue = (dividendDistribution ?? 'ADJUST_NEXT_DUE') === 'ADJUST_NEXT_DUE';
  const baseDueAmount =
    sub.baseDueAmount != null
      ? Number(sub.baseDueAmount)
      : isAdjustedInDue
        ? roundMoney(dueAmount + dividendAmount - interestAmount - premiumAmount)
        : roundMoney(dueAmount - interestAmount - premiumAmount);

  const netDue = roundMoney(Math.max(0, dueAmount + penaltyAmount));
  const outstanding = roundMoney(Math.max(0, netDue - paidAmount));

  return {
    baseDueAmount,
    dividendAmount,
    deferredDividendAmount,
    premiumAmount,
    interestAmount,
    penaltyAmount,
    netDue,
    paidAmount,
    outstanding,
    dividendForfeited: Boolean(sub.dividendForfeited),
  };
}
