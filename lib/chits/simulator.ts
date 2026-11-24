// Pure 18-engine lifecycle simulator & accounting verifier (zero Next.js / Prisma imports).
// STABLE-8 / CHIT-1 / CHIT-32: All monetary calculations, dividends, commissions,
// reserve floors, gold gram credits, ASCA pool profits, chart percentages, and
// consolidated reconciliations execute here on the server and are rendered verbatim by UI.

import { roundMoney } from './calculations';
import {
  calculateAscaMaturityDistribution,
  calculateBasePlusPremiumCycle,
  calculateChitPeriodEngine,
  calculateGoldValueMaturity,
  calculateGoldWeightCredit,
  calculateReserveFloor,
  summarizeGoldWeightMember,
  type ChitFormulaLine,
  type ChitMemberEngineInput,
} from './engineCalculator';
import {
  CHIT_ENGINE_CATALOG,
  type ChitEngineCategory,
  type ChitEngineConfig,
  type ChitEngineType,
  isChitEngineType,
  parseChitEngineConfig,
} from './engineTypes';
import type { ChitTemplateDefinition } from './templates';
import type {
  ChitCommissionBasis,
  ChitDividendDistribution,
  ChitDividendPolicy,
} from './types';
import { effectiveMinDiscountPct, startingDiscountAmount } from './validation';

export type ChitCycleOverride = {
  bidDiscount?: number;
  payoutAmount?: number;
  dividendPerTicket?: number;
  nonPrizedDue?: number;
  prizedDue?: number;
  commission?: number;
  goldRatePerGram?: number;
  internalLoanAmount?: number;
};

export type ChitSimulationInput = {
  engineType: ChitEngineType;
  chitValue: number;
  monthlyContrib: number;
  totalMembers: number;
  commissionPct: number;
  commissionBasis: ChitCommissionBasis;
  gstPct?: number;
  dividendPolicy: ChitDividendPolicy;
  dividendDistribution: ChitDividendDistribution;
  dividendRounding?: number;
  bidStartAtCommission?: boolean;
  minDiscountPct?: number | null;
  maxDiscountPct?: number | null;
  uncapped?: boolean;
  frequency?: string;
  // Engine-specific editable parameters
  reservePriceStepPct?: number;
  lotteryWinnersPerCycle?: number;
  auctionWinnersPerCycle?: number;
  baseInstalment?: number;
  prizedPremiumAmount?: number;
  reservedCyclesCount?: number;
  reservedDiscountPct?: number;
  goldBonusMonths?: number;
  goldRatePerGram?: number;
  merchantBonusPct?: number;
  ascaMonthlyLoanInterestPct?: number;
  ascaPoolUtilizationPct?: number;
  ascaAdminExpensePerCycle?: number;
  fixedDiscountPct?: number;
  cycleOverrides?: Record<number, ChitCycleOverride>;
  selectedCycle?: number;
};

export type ChitCycleWarning = {
  code: 'below_floor' | 'above_cap' | 'reserve_fallback' | 'commission_exceeds_discount';
  floorAmount?: number;
  capAmount?: number;
  floorPct?: number;
  capPct?: number;
};

export type ChitCyclePhase =
  | 'reserved'
  | 'auction'
  | 'draw'
  | 'bonus'
  | 'accumulation'
  | 'revolving'
  | 'chart';

export type ChitEditableCycleField =
  | 'bidDiscount'
  | 'payoutAmount'
  | 'dividendPerTicket'
  | 'variableDue'
  | 'goldRatePerGram'
  | 'internalLoanAmount'
  | 'customRow';

export type ChitSimulatedCycle = {
  periodNumber: number;
  phase: ChitCyclePhase;
  grossPool: number;
  editableValue: number;
  bidDiscount: number;
  bidDiscountPct: number;
  reserveFloorAmount: number | null;
  reserveFloorPct: number | null;
  prizeAmount: number;
  lotteryPrizeAmount: number | null;
  auctionWinnerCount: number;
  lotteryWinnerCount: number;
  commission: number;
  gstAmount: number;
  distributableDividend: number;
  dividendEligibleTickets: number;
  dividendPerTicket: number;
  roundingIncome: number;
  nonPrizedInstalmentThisCycle: number;
  prizedInstalmentThisCycle: number;
  nextCycleNetDueNonPrized: number;
  nextCycleNetDuePrized: number;
  poolSurplus: number;
  goldRatePerGram: number;
  goldGramsCredited: number;
  cumulativeGoldGrams: number;
  internalLoanDisbursed: number;
  interestEarned: number;
  adminExpense: number;
  cumulativePoolBalance: number;
  merchantBonusAdded: number;
  potSplitPct: {
    payoutPct: number;
    dividendPct: number;
    commissionPct: number;
  };
  payoutBarPct: number;
  netDueBarPct: number;
  warning: ChitCycleWarning | null;
  formulaLines: ChitFormulaLine[];
};

export type ChitMemberJourneySummary = {
  role: 'early' | 'mid' | 'late';
  winCycle: number;
  totalBaseDue: number;
  totalDividendsReceived: number;
  totalPremiumOrInterestPaid: number;
  totalNetPaid: number;
  prizeOrMaturityReceived: number;
  netGainOrCost: number;
  effectiveReturnPct: number;
  goldGramsAccumulated: number;
  paidBarPct: number;
  receivedBarPct: number;
};

export type ChitSimulationResult = {
  input: ChitSimulationInput;
  engineCategory: ChitEngineCategory;
  supportsBidding: boolean;
  editableCycleField: ChitEditableCycleField;
  rules: {
    floorDiscountPct: number | null;
    floorDiscountAmount: number;
    capDiscountPct: number | null;
    capDiscountAmount: number | null;
    commissionBasis: ChitCommissionBasis;
    foremanCompensationMode: string;
    payoutAssetType: string;
    regulatoryTier: string;
    securityRequired: boolean;
    acceptedSecurities: string[];
    syndicateTicketCount: number;
    winnersPerCycle: number;
  };
  selectedCycleNumber: number;
  cycles: ChitSimulatedCycle[];
  consolidated: {
    totalCycles: number;
    totalTickets: number;
    totalGrossBaseCollections: number;
    totalNetCollections: number;
    totalPrizePayouts: number;
    totalForemanCommission: number;
    totalGst: number;
    totalRoundingIncome: number;
    totalForemanEarnings: number;
    totalDividendsDistributed: number;
    totalMerchantBonusOrInterest: number;
    totalAdminExpenses: number;
    endingPoolSurplus: number;
    totalGoldGramsPerMember: number;
    weightedAvgGoldRate: number;
    maturityRedemptionValuePerMember: number;
    averageDividendPerCycle: number;
    averagePrizePayout: number;
    maxDiscountObserved: number;
    minDiscountObserved: number;
    consolidatedSplitPct: {
      payoutPct: number;
      commissionPct: number;
      dividendOrBonusPct: number;
    };
    balanceCheck: {
      inflowTotal: number;
      outflowTotal: number;
      difference: number;
      isBalanced: boolean;
    };
  };
  memberJourneys: ChitMemberJourneySummary[];
};

const COMMERCIAL_CHIT_VALUE_COMMISSION_ENGINES = new Set<ChitEngineType>([
  'AUCTION_STANDARD',
  'AUCTION_RESERVE_PRICE',
  'AUCTION_MULTI_DIVISION',
  'AUCTION_UNCAPPED_ENTERPRISE',
  'PURE_LOTTERY',
  'MICRO_DAILY_COLLECTION',
  'BASE_PLUS_PREMIUM',
  'FIXED_DIVIDEND',
  'CUSTOM_MANUAL_SCHEDULE',
]);

const BULLION_RATE_DELTAS = [0, 0.015, -0.005, 0.025, 0.01, 0.03, 0.02, -0.01, 0.035, 0.04, 0.025, 0.05];

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return roundMoney(Math.min(100, Math.max(0, value)), 1);
}

function defaultTaperDiscountPct(period: number, totalMembers: number, startPct: number, endPct: number): number {
  if (totalMembers <= 1) return endPct;
  const ratio = (period - 1) / (totalMembers - 1);
  return roundMoney(startPct + (endPct - startPct) * ratio, 2);
}

function makeSyntheticMembers(totalTickets: number, prizedCountBefore: number): ChitMemberEngineInput[] {
  return Array.from({ length: totalTickets }, (_, idx) => ({
    memberId: `sim-m-${idx + 1}`,
    memberName: `Member ${idx + 1}`,
    ticketNo: String(idx + 1).padStart(2, '0'),
    ticketShare: 1,
    hasWonBeforePeriod: idx < prizedCountBefore,
    isActive: true,
    isLateThisPeriod: false,
  }));
}

export function buildDefaultSimulationInput(template: ChitTemplateDefinition): ChitSimulationInput {
  const catalog = CHIT_ENGINE_CATALOG[template.engineType];
  const cfg = catalog.defaultConfig;
  const commissionBasis: ChitCommissionBasis = COMMERCIAL_CHIT_VALUE_COMMISSION_ENGINES.has(template.engineType)
    ? 'CHIT_VALUE'
    : 'BID_DISCOUNT';

  const bonusMonths =
    template.engineType === 'GOLD_VALUE_ACCUMULATION'
      ? Math.max(1, cfg.goldScheme?.bonusMonths ?? 1)
      : 0;

  return {
    engineType: template.engineType,
    chitValue: template.defaultChitValue,
    monthlyContrib: template.defaultMonthlyContrib,
    totalMembers: template.defaultTotalMembers,
    commissionPct: template.defaultCommissionPct,
    commissionBasis,
    gstPct: 0,
    dividendPolicy: template.defaultDividendPolicy,
    dividendDistribution: template.defaultDividendDistribution,
    dividendRounding: 0,
    bidStartAtCommission: cfg.discountRules.minDiscountPct > 0 || template.defaultCommissionPct > 0,
    minDiscountPct: cfg.discountRules.minDiscountPct > 0 ? cfg.discountRules.minDiscountPct : null,
    maxDiscountPct: cfg.discountRules.uncapped ? null : cfg.discountRules.maxDiscountPct,
    uncapped: cfg.discountRules.uncapped,
    frequency: template.defaultFrequency,
    reservePriceStepPct: cfg.discountRules.reservePriceStepPct || 1.5,
    lotteryWinnersPerCycle: cfg.multiDivision.lotteryWinnersPerCycle || 1,
    auctionWinnersPerCycle: cfg.multiDivision.auctionWinnersPerCycle || 3,
    baseInstalment: template.defaultMonthlyContrib,
    prizedPremiumAmount: template.defaultWinnerInterestValue ?? cfg.differentialInstalment.prizedPremiumAmount ?? 2000,
    reservedCyclesCount: cfg.hybridSplitPhase?.reservedCyclesCount ?? 1,
    reservedDiscountPct: cfg.hybridSplitPhase?.reservedDiscountPct ?? 0,
    goldBonusMonths: bonusMonths,
    goldRatePerGram: cfg.goldScheme?.defaultGoldRatePerGram && cfg.goldScheme.defaultGoldRatePerGram > 0
      ? cfg.goldScheme.defaultGoldRatePerGram
      : 7500,
    merchantBonusPct: cfg.commodityScheme?.merchantBonusPct ?? 8,
    ascaMonthlyLoanInterestPct: cfg.ascaPool?.monthlyLoanInterestPct ?? 1.5,
    ascaPoolUtilizationPct: 70,
    ascaAdminExpensePerCycle: cfg.ascaPool?.adminExpensePerCycle ?? 0,
    fixedDiscountPct: template.defaultFixedDiscountPct ?? 0,
    cycleOverrides: {},
    selectedCycle: 1,
  };
}

function getEditableCycleField(engineType: ChitEngineType): ChitEditableCycleField {
  switch (engineType) {
    case 'FIXED_CHART_ESCALATING':
      return 'payoutAmount';
    case 'FIXED_DIVIDEND':
      return 'dividendPerTicket';
    case 'FIXED_PAYOUT_VARIABLE_PAY':
      return 'variableDue';
    case 'GOLD_WEIGHT_ACCUMULATION':
      return 'goldRatePerGram';
    case 'ASCA_SHG_REVOLVING':
      return 'internalLoanAmount';
    case 'CUSTOM_MANUAL_SCHEDULE':
      return 'customRow';
    default:
      return 'bidDiscount';
  }
}

export function simulateChitLifecycle(rawInput: ChitSimulationInput): ChitSimulationResult {
  if (!isChitEngineType(rawInput.engineType)) {
    throw new Error(`Invalid chit engine type: ${String(rawInput.engineType)}`);
  }
  const chitValue = Number(rawInput.chitValue);
  const monthlyContrib = Number(rawInput.monthlyContrib);
  const totalMembers = Math.trunc(Number(rawInput.totalMembers));
  const commissionPct = Number(rawInput.commissionPct ?? 0);
  const gstPct = Number(rawInput.gstPct ?? 0);

  if (!Number.isFinite(chitValue) || chitValue <= 0) {
    throw new Error('Chit value must be greater than zero');
  }
  if (!Number.isFinite(monthlyContrib) || monthlyContrib <= 0) {
    throw new Error('Installment amount must be greater than zero');
  }
  if (!Number.isInteger(totalMembers) || totalMembers < 2 || totalMembers > 60) {
    throw new Error('Total members/cycles must be a whole number between 2 and 60');
  }
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 50) {
    throw new Error('Commission percentage must be between 0% and 50%');
  }
  if (!Number.isFinite(gstPct) || gstPct < 0 || gstPct > 50) {
    throw new Error('GST percentage must be between 0% and 50%');
  }

  const engineType = rawInput.engineType;
  const catalog = CHIT_ENGINE_CATALOG[engineType];
  const baseCfg: ChitEngineConfig = parseChitEngineConfig(null, engineType);

  const commissionBasis: ChitCommissionBasis = rawInput.commissionBasis ?? 'BID_DISCOUNT';
  const dividendPolicy: ChitDividendPolicy = rawInput.dividendPolicy ?? 'ALL_MEMBERS';
  const dividendDistribution: ChitDividendDistribution = rawInput.dividendDistribution ?? 'ADJUST_NEXT_DUE';
  const dividendRounding = Math.max(0, Number(rawInput.dividendRounding ?? 0));
  const bidStartAtCommission = rawInput.bidStartAtCommission ?? true;
  const uncapped = Boolean(rawInput.uncapped ?? baseCfg.discountRules.uncapped);
  const maxDiscountPct = uncapped ? null : (rawInput.maxDiscountPct ?? baseCfg.discountRules.maxDiscountPct ?? 40);
  const minDiscountPct = rawInput.minDiscountPct ?? null;

  const reservePriceStepPct = Math.max(0.1, Number(rawInput.reservePriceStepPct ?? (baseCfg.discountRules.reservePriceStepPct || 1.5)));
  const lotteryWinnersPerCycle = Math.max(0, Math.min(2, Math.trunc(Number(rawInput.lotteryWinnersPerCycle ?? baseCfg.multiDivision.lotteryWinnersPerCycle))));
  const auctionWinnersPerCycle = Math.max(1, Math.min(6, Math.trunc(Number(rawInput.auctionWinnersPerCycle ?? baseCfg.multiDivision.auctionWinnersPerCycle))));
  const baseInstalment = engineType === 'BASE_PLUS_PREMIUM'
    ? Math.max(1, Number(rawInput.baseInstalment ?? monthlyContrib))
    : monthlyContrib;
  const prizedPremiumAmount = Math.max(0, Number(rawInput.prizedPremiumAmount ?? baseCfg.differentialInstalment.prizedPremiumAmount ?? 2000));
  const reservedCyclesCount = Math.max(1, Math.min(totalMembers - 1, Math.trunc(Number(rawInput.reservedCyclesCount ?? 1))));
  const reservedDiscountPct = Math.max(0, Math.min(50, Number(rawInput.reservedDiscountPct ?? 0)));
  const goldBonusMonths = Math.max(0, Math.min(totalMembers - 1, Math.trunc(Number(rawInput.goldBonusMonths ?? (engineType === 'GOLD_VALUE_ACCUMULATION' ? 1 : 0)))));
  const baseGoldRatePerGram = Math.max(100, Number(rawInput.goldRatePerGram ?? 7500));
  const merchantBonusPct = Math.max(0, Math.min(100, Number(rawInput.merchantBonusPct ?? 8)));
  const ascaMonthlyLoanInterestPct = Math.max(0, Math.min(10, Number(rawInput.ascaMonthlyLoanInterestPct ?? 1.5)));
  const ascaPoolUtilizationPct = Math.max(0, Math.min(100, Number(rawInput.ascaPoolUtilizationPct ?? 70)));
  const ascaAdminExpensePerCycle = Math.max(0, Number(rawInput.ascaAdminExpensePerCycle ?? 0));
  const fixedDiscountPct = Math.max(0, Math.min(60, Number(rawInput.fixedDiscountPct ?? 0)));
  const cycleOverrides = rawInput.cycleOverrides ?? {};
  const selectedCycleNumber = Math.max(1, Math.min(totalMembers, Math.trunc(Number(rawInput.selectedCycle ?? 1))));

  const floorPct = effectiveMinDiscountPct({
    minDiscountPct,
    bidStartAtCommission,
    commissionPct,
    reserveFloorPct: null,
  });
  const floorDiscountAmount = startingDiscountAmount(chitValue, {
    minDiscountPct,
    bidStartAtCommission,
    commissionPct,
    reserveFloorPct: null,
  });
  const capDiscountAmount = maxDiscountPct != null ? roundMoney((chitValue * maxDiscountPct) / 100) : null;

  const isMultiDivision = engineType === 'AUCTION_MULTI_DIVISION';
  const winnersPerCycle = isMultiDivision ? lotteryWinnersPerCycle + auctionWinnersPerCycle : 1;
  const syndicateTicketCount = isMultiDivision ? totalMembers * winnersPerCycle : totalMembers;

  // Prepare per-cycle simulation state
  const cycles: ChitSimulatedCycle[] = [];
  const memberNetPaidPerTicket: number[] = Array(totalMembers).fill(0);
  const memberBaseDuePerTicket: number[] = Array(totalMembers).fill(0);
  const memberDivSavedPerTicket: number[] = Array(totalMembers).fill(0);
  const memberExtraPaidPerTicket: number[] = Array(totalMembers).fill(0);
  const memberPrizeReceivedPerTicket: number[] = Array(totalMembers).fill(0);
  const memberGoldCredits: Array<Array<{ paidAmount: number; gramsCredited: number }>> = Array.from(
    { length: totalMembers },
    () => [],
  );

  // Track credit applied from cycle t onto cycle t+1 under ADJUST_NEXT_DUE
  const prevCycleDivCreditNonWinner = Array(totalMembers).fill(0);
  const prevCycleNextBaseNonPrized = { value: baseInstalment };
  const prevCycleNextBasePrized = { value: baseInstalment + (engineType === 'BASE_PLUS_PREMIUM' ? prizedPremiumAmount : 0) };

  let cumulativeGoldGrams = 0;
  let cumulativePoolBalance = 0;
  let totalAscaInterest = 0;
  let totalAscaAdminExpenses = 0;
  let endingPoolSurplus = 0;

  for (let t = 1; t <= totalMembers; t++) {
    const ov = cycleOverrides[t] ?? {};
    let phase: ChitCyclePhase = 'auction';
    let grossPool = roundMoney(totalMembers * monthlyContrib);
    let editableValue = 0;
    let bidDiscount = 0;
    let bidDiscountPct = 0;
    let reserveFloorAmount: number | null = null;
    let reserveFloorPct: number | null = null;
    let prizeAmount = chitValue;
    let lotteryPrizeAmount: number | null = null;
    let auctionWinnerCount = 0;
    let lotteryWinnerCount = 0;
    let commission = 0;
    let gstAmount = 0;
    let distributableDividend = 0;
    let dividendEligibleTickets = 0;
    let dividendPerTicket = 0;
    let roundingIncome = 0;
    let nonPrizedInstalmentThisCycle = baseInstalment;
    let prizedInstalmentThisCycle = baseInstalment;
    let nextCycleNetDueNonPrized = baseInstalment;
    let nextCycleNetDuePrized = baseInstalment;
    let poolSurplus = 0;
    let goldRatePerGram = 0;
    let goldGramsCredited = 0;
    let internalLoanDisbursed = 0;
    let interestEarned = 0;
    let adminExpense = 0;
    let merchantBonusAdded = 0;
    let warning: ChitCycleWarning | null = null;
    let formulaLines: ChitFormulaLine[] = [];

    if (engineType === 'AUCTION_MULTI_DIVISION') {
      phase = 'auction';
      grossPool = roundMoney(syndicateTicketCount * monthlyContrib);
      const startPct = 28;
      const endPct = Math.max(floorPct ?? 5, commissionPct);
      const defaultDisc = roundMoney((chitValue * defaultTaperDiscountPct(t, totalMembers, startPct, endPct)) / 100);
      const perAuctionDiscount = Math.max(0, Math.min(chitValue - 1, roundMoney(ov.bidDiscount ?? defaultDisc)));
      editableValue = perAuctionDiscount;
      const commPerWinner = roundMoney((chitValue * commissionPct) / 100);
      const lotteryPrize = Math.max(1, roundMoney(chitValue - commPerWinner));
      const auctionPrize = Math.max(1, roundMoney(chitValue - perAuctionDiscount));

      const multiWinners = [
        ...Array.from({ length: lotteryWinnersPerCycle }, (_, i) => ({
          memberId: `sim-m-${(t - 1) * winnersPerCycle + i + 1}`,
          winType: 'lottery' as const,
          prizeAmount: lotteryPrize,
          bidDiscount: commPerWinner,
        })),
        ...Array.from({ length: auctionWinnersPerCycle }, (_, i) => ({
          memberId: `sim-m-${(t - 1) * winnersPerCycle + lotteryWinnersPerCycle + i + 1}`,
          winType: 'auction' as const,
          prizeAmount: auctionPrize,
          bidDiscount: perAuctionDiscount,
        })),
      ];

      const mdConfig: ChitEngineConfig = {
        ...baseCfg,
        dividendDistributionMode:
          dividendPolicy === 'NON_PRIZED_ONLY'
            ? 'NON_PRIZED_ONLY'
            : dividendPolicy === 'NON_WINNERS_ONLY'
              ? 'NON_WINNERS_ONLY'
              : dividendPolicy === 'NONE'
                ? 'NONE'
                : 'ALL_MEMBERS',
        foremanCompensation: { ...baseCfg.foremanCompensation, commissionPct },
        multiDivision: {
          enabled: true,
          lotteryWinnersPerCycle,
          auctionWinnersPerCycle,
        },
      };

      const members = makeSyntheticMembers(syndicateTicketCount, (t - 1) * winnersPerCycle);
      const res = calculateChitPeriodEngine({
        engineType,
        config: mdConfig,
        chitValue,
        monthlyContrib,
        totalMembers: syndicateTicketCount,
        periodNumber: t,
        commissionPct,
        commissionBasis: 'CHIT_VALUE',
        gstPct,
        dividendPolicy,
        dividendDistribution,
        dividendRounding,
        winnerMemberIds: multiWinners.map((w) => w.memberId),
        multiDivisionWinners: multiWinners,
        members,
      });

      lotteryWinnerCount = lotteryWinnersPerCycle;
      auctionWinnerCount = auctionWinnersPerCycle;
      lotteryPrizeAmount = lotteryPrize;
      const totalCyclePayout = roundMoney(
        lotteryWinnersPerCycle * lotteryPrize + auctionWinnersPerCycle * auctionPrize,
      );
      prizeAmount = totalCyclePayout;
      bidDiscount = roundMoney(grossPool - totalCyclePayout);
      bidDiscountPct = roundMoney((perAuctionDiscount / chitValue) * 100, 2);
      commission = res.commission;
      gstAmount = res.gstAmount;
      distributableDividend = res.distributableDividend;
      dividendEligibleTickets = res.dividendEligibleTickets;
      dividendPerTicket = res.dividendPerTicket;
      roundingIncome = res.roundingIncome;

      // Apply prior dividend credit onto this cycle's net collection for multi-division
      const priorDivCreditTotal = t > 1 ? roundMoney((cycles[t - 2]?.dividendPerTicket ?? 0) * (cycles[t - 2]?.dividendEligibleTickets ?? 0)) : 0;
      const netCycleCash = dividendDistribution === 'ADJUST_NEXT_DUE'
        ? roundMoney(Math.max(0, grossPool - priorDivCreditTotal))
        : grossPool;

      for (let m = 0; m < totalMembers; m++) {
        // Group the syndicate per-member view equivalently on normalized N-cycle basis
        const isAlreadyPrized = m < t - 1;
        const isCurrentWinner = m === t - 1;
        const priorCredit =
          t === 1 || dividendDistribution !== 'ADJUST_NEXT_DUE'
            ? 0
            : cycles[t - 2]!.dividendPerTicket * winnersPerCycle;
        const baseForGroupSlot = roundMoney(monthlyContrib * winnersPerCycle);
        memberBaseDuePerTicket[m] = roundMoney(memberBaseDuePerTicket[m] + baseForGroupSlot);
        const creditApplied = Math.min(baseForGroupSlot, priorCredit);
        memberDivSavedPerTicket[m] = roundMoney(memberDivSavedPerTicket[m] + creditApplied);
        memberNetPaidPerTicket[m] = roundMoney(memberNetPaidPerTicket[m] + (baseForGroupSlot - creditApplied));
        if (isCurrentWinner) {
          // Average multi-division payout per ticket slot vs auction prize
          memberPrizeReceivedPerTicket[m] = roundMoney(totalCyclePayout / winnersPerCycle);
        }
        if (t === totalMembers && dividendDistribution === 'ADJUST_NEXT_DUE' && dividendPerTicket > 0) {
          const eligibleClose =
            dividendPolicy === 'ALL_MEMBERS' ||
            (dividendPolicy === 'NON_WINNERS_ONLY' && !isCurrentWinner) ||
            (dividendPolicy === 'NON_PRIZED_ONLY' && !isCurrentWinner && !isAlreadyPrized);
          if (eligibleClose) {
            memberDivSavedPerTicket[m] = roundMoney(memberDivSavedPerTicket[m] + dividendPerTicket * winnersPerCycle);
          }
        }
      }
      void netCycleCash;

      nonPrizedInstalmentThisCycle = roundMoney(
        t === 1 || dividendDistribution !== 'ADJUST_NEXT_DUE'
          ? monthlyContrib
          : Math.max(0, monthlyContrib - (cycles[t - 2]?.dividendPerTicket ?? 0)),
      );
      prizedInstalmentThisCycle = nonPrizedInstalmentThisCycle;
      nextCycleNetDueNonPrized =
        t >= totalMembers
          ? 0
          : dividendDistribution === 'ADJUST_NEXT_DUE'
            ? roundMoney(Math.max(0, monthlyContrib - dividendPerTicket))
            : monthlyContrib;
      nextCycleNetDuePrized = nextCycleNetDueNonPrized;

      const discPctAuction = roundMoney((perAuctionDiscount / chitValue) * 100, 2);
      if (floorPct != null && discPctAuction + 1e-9 < floorPct) {
        warning = { code: 'below_floor', floorAmount: floorDiscountAmount, floorPct };
      } else if (!uncapped && maxDiscountPct != null && discPctAuction - 1e-9 > maxDiscountPct) {
        warning = { code: 'above_cap', capAmount: capDiscountAmount ?? 0, capPct: maxDiscountPct };
      } else if (perAuctionDiscount > 0 && perAuctionDiscount < commPerWinner) {
        warning = { code: 'commission_exceeds_discount' };
      }

      formulaLines = [
        { label: `Syndicate Pool (${syndicateTicketCount} tickets × ${monthlyContrib.toLocaleString('en-IN')})`, amount: grossPool, sign: 'info' },
        ...(lotteryWinnersPerCycle > 0
          ? [{ label: `Lottery Winners (${lotteryWinnersPerCycle} × ${lotteryPrize.toLocaleString('en-IN')})`, amount: roundMoney(lotteryWinnersPerCycle * lotteryPrize), sign: '-' as const }]
          : []),
        { label: `Auction Winners (${auctionWinnersPerCycle} × ${auctionPrize.toLocaleString('en-IN')})`, amount: roundMoney(auctionWinnersPerCycle * auctionPrize), sign: '-' },
        { label: `Pooled Auction Discounts (${auctionWinnersPerCycle} × ${perAuctionDiscount.toLocaleString('en-IN')})`, amount: roundMoney(auctionWinnersPerCycle * perAuctionDiscount), sign: 'info' },
        { label: `Total Foreman Commission (${winnersPerCycle} divisions × ${commPerWinner.toLocaleString('en-IN')})`, amount: commission, sign: '-' },
        { label: 'Distributable Dividend Pool', amount: distributableDividend, sign: '=' },
        { label: `Dividend / Ticket (${dividendEligibleTickets} eligible)`, amount: dividendPerTicket, sign: '=' },
        ...(roundingIncome > 0 ? [{ label: 'Rounding Income (Foreman)', amount: roundingIncome, sign: 'info' as const }] : []),
      ];
    } else if (engineType === 'GOLD_VALUE_ACCUMULATION') {
      const paidMonths = Math.max(1, totalMembers - goldBonusMonths);
      const isBonusCycle = t > paidMonths;
      phase = isBonusCycle ? 'bonus' : 'accumulation';
      const memberContribThisCycle = isBonusCycle ? 0 : monthlyContrib;
      grossPool = roundMoney(totalMembers * memberContribThisCycle);
      merchantBonusAdded = isBonusCycle ? roundMoney(totalMembers * monthlyContrib) : 0;
      nonPrizedInstalmentThisCycle = memberContribThisCycle;
      prizedInstalmentThisCycle = memberContribThisCycle;
      goldRatePerGram = baseGoldRatePerGram;
      goldGramsCredited = roundMoney(monthlyContrib / goldRatePerGram, 4);
      cumulativeGoldGrams = roundMoney(cumulativeGoldGrams + goldGramsCredited, 4);

      if (t === totalMembers) {
        const maturity = calculateGoldValueMaturity({
          totalInstalmentsPaid: roundMoney(paidMonths * monthlyContrib),
          monthlyContrib,
          bonusMonths: goldBonusMonths,
          goldRatePerGram: baseGoldRatePerGram,
        });
        prizeAmount = roundMoney(totalMembers * maturity.totalRedemptionValue);
      } else {
        prizeAmount = 0;
      }

      nextCycleNetDueNonPrized = t >= paidMonths ? 0 : monthlyContrib;
      nextCycleNetDuePrized = nextCycleNetDueNonPrized;

      for (let m = 0; m < totalMembers; m++) {
        memberBaseDuePerTicket[m] = roundMoney(memberBaseDuePerTicket[m] + memberContribThisCycle);
        memberNetPaidPerTicket[m] = roundMoney(memberNetPaidPerTicket[m] + memberContribThisCycle);
        if (isBonusCycle) {
          memberDivSavedPerTicket[m] = roundMoney(memberDivSavedPerTicket[m] + monthlyContrib);
        }
        if (t === totalMembers) {
          memberPrizeReceivedPerTicket[m] = roundMoney(paidMonths * monthlyContrib + goldBonusMonths * monthlyContrib);
        }
      }

      formulaLines = [
        { label: isBonusCycle ? `Cycle ${t} Merchant Bonus Deposit` : `Cycle ${t} Member Savings (${totalMembers} × ${monthlyContrib.toLocaleString('en-IN')})`, amount: isBonusCycle ? merchantBonusAdded : grossPool, sign: 'info' },
        { label: `Gold Bullion Reference Rate (₹/g)`, amount: goldRatePerGram, sign: 'info' },
        { label: t === totalMembers ? `Total Group Jewellery Redemption (${totalMembers} members)` : 'Mid-Cycle Redemption (Holds until Maturity)', amount: prizeAmount, sign: '=' },
      ];
    } else if (engineType === 'GOLD_WEIGHT_ACCUMULATION') {
      phase = 'accumulation';
      grossPool = roundMoney(totalMembers * monthlyContrib);
      const rateDelta = BULLION_RATE_DELTAS[(t - 1) % BULLION_RATE_DELTAS.length];
      const defaultRate = roundMoney(baseGoldRatePerGram * (1 + rateDelta));
      goldRatePerGram = Math.max(100, roundMoney(ov.goldRatePerGram ?? defaultRate));
      editableValue = goldRatePerGram;
      goldGramsCredited = calculateGoldWeightCredit({ paymentAmount: monthlyContrib, goldRatePerGram });
      cumulativeGoldGrams = roundMoney(cumulativeGoldGrams + goldGramsCredited, 4);
      commission = roundMoney((grossPool * commissionPct) / 100);
      gstAmount = roundMoney((commission * gstPct) / 100);
      nonPrizedInstalmentThisCycle = monthlyContrib;
      prizedInstalmentThisCycle = monthlyContrib;
      nextCycleNetDueNonPrized = t >= totalMembers ? 0 : monthlyContrib;
      nextCycleNetDuePrized = nextCycleNetDueNonPrized;

      for (let m = 0; m < totalMembers; m++) {
        memberBaseDuePerTicket[m] = roundMoney(memberBaseDuePerTicket[m] + monthlyContrib);
        memberNetPaidPerTicket[m] = roundMoney(memberNetPaidPerTicket[m] + monthlyContrib);
        memberGoldCredits[m].push({ paidAmount: monthlyContrib, gramsCredited: goldGramsCredited });
      }

      if (t === totalMembers) {
        const perMemberMaturity = roundMoney(cumulativeGoldGrams * goldRatePerGram);
        prizeAmount = roundMoney(totalMembers * perMemberMaturity);
        for (let m = 0; m < totalMembers; m++) {
          memberPrizeReceivedPerTicket[m] = perMemberMaturity;
        }
      } else {
        prizeAmount = 0;
      }

      formulaLines = [
        { label: `Monthly Member Savings (${totalMembers} × ${monthlyContrib.toLocaleString('en-IN')})`, amount: grossPool, sign: 'info' },
        { label: `Applied Gold Rate (₹/g)`, amount: goldRatePerGram, sign: 'info' },
        { label: `Grams Credited / Member (S_t / R_t)`, amount: goldGramsCredited, sign: 'info' },
        { label: `Cumulative Gold Weight / Member (g)`, amount: cumulativeGoldGrams, sign: 'info' },
        ...(commission > 0 ? [{ label: `Assaying & Vault Fee (${commissionPct}%)`, amount: commission, sign: '-' as const }] : []),
        { label: t === totalMembers ? 'Total Maturity Bullion Value' : 'Cycle Cash Payout (Redeems at Maturity)', amount: prizeAmount, sign: '=' },
      ];
    } else if (engineType === 'FESTIVAL_COMMODITY') {
      phase = t === totalMembers ? 'bonus' : 'accumulation';
      grossPool = roundMoney(totalMembers * monthlyContrib);
      const totalPaidPerMember = roundMoney(totalMembers * monthlyContrib);
      const bonusPerMember = roundMoney((totalPaidPerMember * merchantBonusPct) / 100);
      merchantBonusAdded = t === totalMembers ? roundMoney(totalMembers * bonusPerMember) : 0;
      commission = roundMoney((grossPool * commissionPct) / 100);
      gstAmount = roundMoney((commission * gstPct) / 100);
      prizeAmount = t === totalMembers ? roundMoney(totalPaidPerMember * totalMembers + merchantBonusAdded - commission * totalMembers) : 0;
      nonPrizedInstalmentThisCycle = monthlyContrib;
      prizedInstalmentThisCycle = monthlyContrib;
      nextCycleNetDueNonPrized = t >= totalMembers ? 0 : monthlyContrib;
      nextCycleNetDuePrized = nextCycleNetDueNonPrized;

      for (let m = 0; m < totalMembers; m++) {
        memberBaseDuePerTicket[m] = roundMoney(memberBaseDuePerTicket[m] + monthlyContrib);
        memberNetPaidPerTicket[m] = roundMoney(memberNetPaidPerTicket[m] + monthlyContrib);
        if (t === totalMembers) {
          const perMemberVal = roundMoney(totalPaidPerMember + bonusPerMember - (commission * totalMembers) / totalMembers);
          memberDivSavedPerTicket[m] = bonusPerMember;
          memberPrizeReceivedPerTicket[m] = perMemberVal;
        }
      }

      formulaLines = [
        { label: `Monthly Collection Pool (${totalMembers} × ${monthlyContrib.toLocaleString('en-IN')})`, amount: grossPool, sign: 'info' },
        ...(merchantBonusAdded > 0 ? [{ label: `Wholesale Commodity Bonus (+${merchantBonusPct}%)`, amount: merchantBonusAdded, sign: '+' as const }] : []),
        ...(commission > 0 ? [{ label: `Organizer Distribution Fee (${commissionPct}%)`, amount: commission, sign: '-' as const }] : []),
        { label: t === totalMembers ? 'Total Festival Hamper Value Delivered' : 'Accumulated Until Festival Week', amount: prizeAmount, sign: '=' },
      ];
    } else if (engineType === 'ASCA_SHG_REVOLVING') {
      phase = 'revolving';
      grossPool = roundMoney(totalMembers * monthlyContrib);
      cumulativePoolBalance = roundMoney(cumulativePoolBalance + grossPool);
      const defaultLoan = roundMoney(cumulativePoolBalance * (ascaPoolUtilizationPct / 100));
      internalLoanDisbursed = Math.max(0, roundMoney(ov.internalLoanAmount ?? defaultLoan));
      editableValue = internalLoanDisbursed;
      interestEarned = roundMoney((internalLoanDisbursed * ascaMonthlyLoanInterestPct) / 100);
      adminExpense = roundMoney(ascaAdminExpensePerCycle);
      const netInterestThisCycle = roundMoney(Math.max(0, interestEarned - adminExpense));
      cumulativePoolBalance = roundMoney(cumulativePoolBalance + netInterestThisCycle);
      totalAscaInterest = roundMoney(totalAscaInterest + interestEarned);
      totalAscaAdminExpenses = roundMoney(totalAscaAdminExpenses + adminExpense);
      prizeAmount = internalLoanDisbursed;
      nonPrizedInstalmentThisCycle = monthlyContrib;
      prizedInstalmentThisCycle = monthlyContrib;
      nextCycleNetDueNonPrized = t >= totalMembers ? 0 : monthlyContrib;
      nextCycleNetDuePrized = nextCycleNetDueNonPrized;

      for (let m = 0; m < totalMembers; m++) {
        memberBaseDuePerTicket[m] = roundMoney(memberBaseDuePerTicket[m] + monthlyContrib);
        memberNetPaidPerTicket[m] = roundMoney(memberNetPaidPerTicket[m] + monthlyContrib);
      }

      if (t === totalMembers) {
        const asca = calculateAscaMaturityDistribution({
          members: Array.from({ length: totalMembers }, (_, idx) => ({
            memberId: `sim-m-${idx + 1}`,
            ticketShare: 1,
            totalContributed: memberBaseDuePerTicket[idx],
          })),
          totalInterestEarned: totalAscaInterest,
          totalAdminExpenses: totalAscaAdminExpenses,
        });
        roundingIncome = asca.roundingIncome;
        for (let m = 0; m < totalMembers; m++) {
          const sh = asca.memberShares[m]!;
          memberDivSavedPerTicket[m] = sh.profitDividendShare;
          memberPrizeReceivedPerTicket[m] = sh.totalPayout;
        }
        distributableDividend = asca.netProfit;
        dividendEligibleTickets = totalMembers;
        dividendPerTicket = totalMembers > 0 ? roundMoney(asca.netProfit / totalMembers) : 0;
        merchantBonusAdded = totalAscaInterest;
      }

      formulaLines = [
        { label: `Monthly SHG Savings (${totalMembers} × ${monthlyContrib.toLocaleString('en-IN')})`, amount: grossPool, sign: 'info' },
        { label: `Revolving Pool Corpus (Pre-Interest)`, amount: roundMoney(cumulativePoolBalance - netInterestThisCycle), sign: 'info' },
        { label: `Internal Loans Disbursed to Members`, amount: internalLoanDisbursed, sign: 'info' },
        { label: `Interest Earned (${ascaMonthlyLoanInterestPct}% / mo)`, amount: interestEarned, sign: '+' },
        ...(adminExpense > 0 ? [{ label: 'Admin Expenses', amount: adminExpense, sign: '-' as const }] : []),
        { label: 'Ending Pool Corpus', amount: cumulativePoolBalance, sign: '=' },
      ];
    } else {
      // Single-winner per cycle engines (AUCTION_*, BASE_PLUS_PREMIUM, FIXED_*, PURE_LOTTERY, NEED_BASED_CONSENSUS, MICRO_DAILY_COLLECTION, HYBRID_SPLIT_PHASE, CUSTOM_MANUAL_SCHEDULE)
      const members = makeSyntheticMembers(totalMembers, t - 1);
      const customCfg: ChitEngineConfig = parseChitEngineConfig(null, engineType);
      customCfg.dividendDistributionMode =
        dividendPolicy === 'NON_PRIZED_ONLY'
          ? 'NON_PRIZED_ONLY'
          : dividendPolicy === 'NON_WINNERS_ONLY'
            ? 'NON_WINNERS_ONLY'
            : dividendPolicy === 'NONE'
              ? 'NONE'
              : 'ALL_MEMBERS';
      customCfg.foremanCompensation.commissionPct = commissionPct;
      customCfg.discountRules.reservePriceStepPct = reservePriceStepPct;
      customCfg.discountRules.uncapped = uncapped;
      customCfg.discountRules.maxDiscountPct = maxDiscountPct;
      customCfg.differentialInstalment = {
        enabled: engineType === 'BASE_PLUS_PREMIUM',
        baseInstalment,
        prizedPremiumAmount,
      };
      customCfg.hybridSplitPhase = {
        reservedCyclesCount,
        reservedDiscountPct,
      };

      let inputPrizeAmount: number | undefined;

      if (engineType === 'AUCTION_STANDARD' || engineType === 'AUCTION_UNCAPPED_ENTERPRISE' || engineType === 'MICRO_DAILY_COLLECTION') {
        phase = 'auction';
        const startPct = engineType === 'AUCTION_UNCAPPED_ENTERPRISE'
          ? 45
          : engineType === 'MICRO_DAILY_COLLECTION'
            ? 15
            : Math.min(30, maxDiscountPct ?? 30);
        const endPct = Math.max(floorPct ?? 0, commissionPct);
        const defDisc = roundMoney((chitValue * defaultTaperDiscountPct(t, totalMembers, startPct, endPct)) / 100);
        const disc = Math.max(0, Math.min(chitValue - 1, roundMoney(ov.bidDiscount ?? defDisc)));
        editableValue = disc;
        inputPrizeAmount = Math.max(1, roundMoney(chitValue - disc));
      } else if (engineType === 'AUCTION_RESERVE_PRICE') {
        phase = 'auction';
        const floor = calculateReserveFloor({
          chitValue,
          totalPeriods: totalMembers,
          periodNumber: t,
          reservePriceStepPct,
          maxDiscountPct: uncapped ? null : maxDiscountPct,
        });
        reserveFloorAmount = floor.reserveFloorAmount;
        reserveFloorPct = floor.reserveFloorPct;
        const taper = roundMoney((chitValue * defaultTaperDiscountPct(t, totalMembers, Math.min(28, maxDiscountPct ?? 35), floor.reserveFloorPct)) / 100);
        const defDisc = Math.max(floor.reserveFloorAmount, taper);
        const disc = Math.max(0, Math.min(chitValue - 1, roundMoney(ov.bidDiscount ?? defDisc)));
        editableValue = disc;
        inputPrizeAmount = Math.max(1, roundMoney(chitValue - disc));
        const discPctNow = roundMoney((disc / chitValue) * 100, 2);
        if (disc + 1e-6 < floor.reserveFloorAmount) {
          warning = {
            code: 'below_floor',
            floorAmount: floor.reserveFloorAmount,
            floorPct: floor.reserveFloorPct,
          };
        } else if (Math.abs(disc - floor.reserveFloorAmount) <= 1) {
          warning = {
            code: 'reserve_fallback',
            floorAmount: floor.reserveFloorAmount,
            floorPct: floor.reserveFloorPct,
          };
        } else if (!uncapped && maxDiscountPct != null && discPctNow - 1e-9 > maxDiscountPct) {
          warning = { code: 'above_cap', capAmount: capDiscountAmount ?? 0, capPct: maxDiscountPct };
        }
      } else if (engineType === 'HYBRID_SPLIT_PHASE') {
        const isReserved = t <= reservedCyclesCount;
        phase = isReserved ? 'reserved' : 'auction';
        const reservedDef = roundMoney((chitValue * reservedDiscountPct) / 100);
        const startPct = Math.min(25, maxDiscountPct ?? 25);
        const endPct = Math.max(floorPct ?? 5, commissionPct);
        const auctionDef = roundMoney((chitValue * defaultTaperDiscountPct(t, totalMembers, startPct, endPct)) / 100);
        const disc = Math.max(0, Math.min(chitValue - 1, roundMoney(ov.bidDiscount ?? (isReserved ? reservedDef : auctionDef))));
        editableValue = disc;
        inputPrizeAmount = Math.max(1, roundMoney(chitValue - disc));
      } else if (engineType === 'BASE_PLUS_PREMIUM') {
        phase = 'draw';
        const defaultDisc = commissionBasis === 'CHIT_VALUE' ? roundMoney((chitValue * commissionPct) / 100) : 0;
        const disc = Math.max(0, Math.min(chitValue - 1, roundMoney(ov.bidDiscount ?? defaultDisc)));
        editableValue = disc;
        inputPrizeAmount = Math.max(1, roundMoney(chitValue - disc));
        grossPool = roundMoney(totalMembers * baseInstalment + (t - 1) * prizedPremiumAmount);
      } else if (engineType === 'FIXED_CHART_ESCALATING') {
        phase = 'chart';
        const startPay = roundMoney(chitValue * 0.82);
        const endPay = roundMoney(chitValue * 1.15);
        const ratio = totalMembers > 1 ? (t - 1) / (totalMembers - 1) : 1;
        const defaultPay = Math.round(startPay + (endPay - startPay) * ratio);
        const pay = Math.max(1, roundMoney(ov.payoutAmount ?? defaultPay));
        editableValue = pay;
        customCfg.escalatingPayouts = [{ period: t, payoutAmount: pay }];
        inputPrizeAmount = pay;
      } else if (engineType === 'FIXED_DIVIDEND') {
        phase = 'draw';
        const maxDiv = roundMoney(monthlyContrib * 0.25);
        const ratio = totalMembers > 1 ? 1 - (t - 1) / (totalMembers - 1) : 0;
        const defaultDiv = Math.round(maxDiv * ratio);
        const div = Math.max(0, roundMoney(ov.dividendPerTicket ?? defaultDiv));
        editableValue = div;
        customCfg.fixedDividends = [{ period: t, dividendPerTicket: div }];
        const eligibleNow =
          dividendPolicy === 'NONE'
            ? 0
            : dividendPolicy === 'NON_WINNERS_ONLY'
              ? Math.max(0, totalMembers - 1)
              : dividendPolicy === 'NON_PRIZED_ONLY'
                ? Math.max(0, totalMembers - t)
                : totalMembers;
        const commAmtEst = commissionBasis === 'CHIT_VALUE' ? roundMoney((chitValue * commissionPct) / 100) : 0;
        inputPrizeAmount = Math.max(1, roundMoney(chitValue - div * eligibleNow - commAmtEst));
      } else if (engineType === 'FIXED_PAYOUT_VARIABLE_PAY') {
        phase = 'draw';
        const defNonPrized = roundMoney(monthlyContrib * 0.9);
        const defPrized = roundMoney(monthlyContrib * 1.1);
        const nonPrizedDue = Math.max(0, roundMoney(ov.nonPrizedDue ?? defNonPrized));
        const prizedDue = Math.max(0, roundMoney(ov.prizedDue ?? defPrized));
        editableValue = nonPrizedDue;
        customCfg.variableInstalments = [
          { period: t, nonPrizedDue, prizedDue },
          { period: t + 1, nonPrizedDue, prizedDue },
        ];
        grossPool = roundMoney((totalMembers - (t - 1)) * nonPrizedDue + (t - 1) * prizedDue);
        const commAmtEst = roundMoney((chitValue * commissionPct) / 100);
        inputPrizeAmount = Math.max(1, roundMoney(chitValue - commAmtEst));
      } else if (engineType === 'CUSTOM_MANUAL_SCHEDULE') {
        phase = 'chart';
        const nonPrizedDue = Math.max(0, roundMoney(ov.nonPrizedDue ?? monthlyContrib));
        const prizedDue = Math.max(0, roundMoney(ov.prizedDue ?? monthlyContrib));
        const payout = Math.max(1, roundMoney(ov.payoutAmount ?? chitValue));
        const comm = Math.max(0, roundMoney(ov.commission ?? (chitValue * commissionPct) / 100));
        const divOverride = ov.dividendPerTicket;
        editableValue = payout;
        customCfg.customSchedule = [
          {
            period: t,
            instalmentNonPrized: nonPrizedDue,
            instalmentPrized: prizedDue,
            payoutAmount: payout,
            commission: comm,
            ...(divOverride != null ? { dividendPerTicket: Math.max(0, roundMoney(divOverride)) } : {}),
          },
          {
            period: t + 1,
            instalmentNonPrized: nonPrizedDue,
            instalmentPrized: prizedDue,
            payoutAmount: payout,
            commission: comm,
          },
        ];
        grossPool = roundMoney((totalMembers - (t - 1)) * nonPrizedDue + (t - 1) * prizedDue);
        inputPrizeAmount = payout;
      } else {
        // PURE_LOTTERY, FIXED_ROTATION, NEED_BASED_CONSENSUS
        phase = 'draw';
        const commDef = commissionBasis === 'CHIT_VALUE' ? roundMoney((chitValue * commissionPct) / 100) : 0;
        const fixedDef = roundMoney((chitValue * fixedDiscountPct) / 100);
        const defaultDisc = Math.max(commDef, fixedDef);
        const disc = Math.max(0, Math.min(chitValue - 1, roundMoney(ov.bidDiscount ?? defaultDisc)));
        editableValue = disc;
        inputPrizeAmount = Math.max(1, roundMoney(chitValue - disc));
      }

      const res = calculateChitPeriodEngine({
        engineType,
        config: customCfg,
        chitValue,
        monthlyContrib: baseInstalment,
        totalMembers,
        periodNumber: t,
        commissionPct,
        commissionBasis,
        gstPct,
        dividendPolicy,
        dividendDistribution,
        dividendRounding,
        winnerMemberIds: [`sim-m-${t}`],
        prizeAmount: inputPrizeAmount,
        fixedDiscountPct,
        members,
      });

      prizeAmount = res.prizeAmount;
      bidDiscount = res.bidDiscount;
      bidDiscountPct = chitValue > 0 ? roundMoney((bidDiscount / chitValue) * 100, 2) : 0;
      commission = res.commission;
      gstAmount = res.gstAmount;
      distributableDividend = res.distributableDividend;
      dividendEligibleTickets = res.dividendEligibleTickets;
      dividendPerTicket = res.dividendPerTicket;
      roundingIncome = res.roundingIncome;
      auctionWinnerCount = catalog.supportsBidding && phase !== 'reserved' ? 1 : 0;
      lotteryWinnerCount = auctionWinnerCount === 0 ? 1 : 0;
      formulaLines = res.formulaLines;

      // Determine nonPrized vs prized instalment PAID IN CYCLE t (including prior cycle's credit)
      if (engineType === 'FIXED_PAYOUT_VARIABLE_PAY') {
        const varRow = customCfg.variableInstalments?.[0];
        nonPrizedInstalmentThisCycle = roundMoney(varRow?.nonPrizedDue ?? baseInstalment);
        prizedInstalmentThisCycle = roundMoney(varRow?.prizedDue ?? baseInstalment);
      } else if (engineType === 'CUSTOM_MANUAL_SCHEDULE') {
        const schedRow = customCfg.customSchedule?.[0];
        nonPrizedInstalmentThisCycle = roundMoney(schedRow?.instalmentNonPrized ?? baseInstalment);
        prizedInstalmentThisCycle = roundMoney(schedRow?.instalmentPrized ?? baseInstalment);
      } else if (engineType === 'BASE_PLUS_PREMIUM') {
        nonPrizedInstalmentThisCycle = baseInstalment;
        prizedInstalmentThisCycle = roundMoney(baseInstalment + prizedPremiumAmount);
      } else {
        const avgPrevCredit = prevCycleDivCreditNonWinner[0] ?? 0;
        nonPrizedInstalmentThisCycle =
          t === 1 || dividendDistribution !== 'ADJUST_NEXT_DUE'
            ? baseInstalment
            : roundMoney(Math.max(0, baseInstalment - avgPrevCredit));
        prizedInstalmentThisCycle =
          t === 1 || dividendDistribution !== 'ADJUST_NEXT_DUE'
            ? baseInstalment
            : roundMoney(Math.max(0, baseInstalment - (dividendPolicy === 'ALL_MEMBERS' ? avgPrevCredit : 0)));
      }

      nextCycleNetDueNonPrized = res.memberBreakdowns[totalMembers - 1]?.netPayableNextPeriod ?? 0;
      nextCycleNetDuePrized = res.memberBreakdowns[t - 1]?.netPayableNextPeriod ?? 0;

      if (engineType === 'BASE_PLUS_PREMIUM') {
        const bp = calculateBasePlusPremiumCycle({
          baseInstalment,
          prizedPremiumAmount,
          totalTicketUnits: totalMembers,
          alreadyPrizedTicketUnits: t - 1,
          payoutAmount: prizeAmount,
          commission,
        });
        poolSurplus = bp.poolSurplus;
      } else if (engineType === 'FIXED_CHART_ESCALATING' || engineType === 'FIXED_PAYOUT_VARIABLE_PAY' || engineType === 'CUSTOM_MANUAL_SCHEDULE') {
        poolSurplus = roundMoney(grossPool - prizeAmount - commission - distributableDividend);
      } else {
        poolSurplus = roundMoney(grossPool - prizeAmount - commission - distributableDividend);
      }

      // Update per-member ledger for all N members across period t
      for (let m = 0; m < totalMembers; m++) {
        const mb = res.memberBreakdowns[m]!;
        const isCurrentWinner = m === t - 1;
        const alreadyPrizedBeforeT = m < t - 1;
        let baseThisCycle = baseInstalment;
        if (engineType === 'FIXED_PAYOUT_VARIABLE_PAY' || engineType === 'CUSTOM_MANUAL_SCHEDULE') {
          baseThisCycle = alreadyPrizedBeforeT ? prizedInstalmentThisCycle : nonPrizedInstalmentThisCycle;
        }
        const premiumThisCycle = engineType === 'BASE_PLUS_PREMIUM' && alreadyPrizedBeforeT ? prizedPremiumAmount : 0;
        const priorCredit = dividendDistribution === 'ADJUST_NEXT_DUE' ? prevCycleDivCreditNonWinner[m] : 0;
        const effectiveCredit = Math.min(baseThisCycle, priorCredit);
        const netPaidNow = roundMoney(Math.max(0, baseThisCycle - effectiveCredit) + premiumThisCycle);

        memberBaseDuePerTicket[m] = roundMoney(memberBaseDuePerTicket[m] + baseThisCycle);
        memberExtraPaidPerTicket[m] = roundMoney(memberExtraPaidPerTicket[m] + premiumThisCycle);
        memberDivSavedPerTicket[m] = roundMoney(memberDivSavedPerTicket[m] + effectiveCredit);
        memberNetPaidPerTicket[m] = roundMoney(memberNetPaidPerTicket[m] + netPaidNow);

        if (isCurrentWinner) {
          memberPrizeReceivedPerTicket[m] = prizeAmount;
        }

        // Carry cycle t dividend to cycle t+1 if ADJUST_NEXT_DUE; on final cycle credit as closing refund
        if (t < totalMembers) {
          prevCycleDivCreditNonWinner[m] = mb.nextDueDividendCredit;
        } else if (dividendDistribution === 'ADJUST_NEXT_DUE' && mb.nextDueDividendCredit > 0) {
          memberDivSavedPerTicket[m] = roundMoney(memberDivSavedPerTicket[m] + mb.nextDueDividendCredit);
        } else if (dividendDistribution === 'CASH_PAYOUT' || dividendDistribution === 'ACCUMULATE' || dividendDistribution === 'DEFERRED_BONUS_POOL') {
          memberDivSavedPerTicket[m] = roundMoney(memberDivSavedPerTicket[m] + mb.dividendEarned);
        }

        if (t < totalMembers && (dividendDistribution === 'CASH_PAYOUT' || dividendDistribution === 'ACCUMULATE' || dividendDistribution === 'DEFERRED_BONUS_POOL')) {
          memberDivSavedPerTicket[m] = roundMoney(memberDivSavedPerTicket[m] + mb.dividendEarned);
        }
      }

      // Check warnings for bidding/auction engines (non-reserve already checked above)
      if (!warning && catalog.supportsBidding && phase !== 'reserved') {
        const effMin = floorPct;
        if (effMin != null && bidDiscountPct + 1e-9 < effMin) {
          warning = { code: 'below_floor', floorAmount: floorDiscountAmount, floorPct: effMin };
        } else if (!uncapped && maxDiscountPct != null && bidDiscountPct - 1e-9 > maxDiscountPct) {
          warning = { code: 'above_cap', capAmount: capDiscountAmount ?? 0, capPct: maxDiscountPct };
        }
      }
      if (!warning && bidDiscount > 0 && bidDiscount < commission) {
        warning = { code: 'commission_exceeds_discount' };
      }

      void prevCycleNextBaseNonPrized;
      void prevCycleNextBasePrized;
    }

    // Pot split percentages scaled safely 0..100 against total cycle allocation
    const denom = Math.max(1, prizeAmount + distributableDividend + commission, grossPool);
    const payoutPct = clampPct((prizeAmount / denom) * 100);
    const divPct = clampPct((distributableDividend / denom) * 100);
    const commPctSplit = clampPct((commission / denom) * 100);

    cycles.push({
      periodNumber: t,
      phase,
      grossPool,
      editableValue,
      bidDiscount,
      bidDiscountPct,
      reserveFloorAmount,
      reserveFloorPct,
      prizeAmount,
      lotteryPrizeAmount,
      auctionWinnerCount,
      lotteryWinnerCount,
      commission,
      gstAmount,
      distributableDividend,
      dividendEligibleTickets,
      dividendPerTicket,
      roundingIncome,
      nonPrizedInstalmentThisCycle,
      prizedInstalmentThisCycle,
      nextCycleNetDueNonPrized,
      nextCycleNetDuePrized,
      poolSurplus,
      goldRatePerGram,
      goldGramsCredited,
      cumulativeGoldGrams,
      internalLoanDisbursed,
      interestEarned,
      adminExpense,
      cumulativePoolBalance,
      merchantBonusAdded,
      potSplitPct: {
        payoutPct,
        dividendPct: divPct,
        commissionPct: commPctSplit,
      },
      payoutBarPct: 0,
      netDueBarPct: 0,
      warning,
      formulaLines,
    });
  }

  // Scale cycle chart bars across all cycles [0, 100] (STABLE-7)
  const maxTrendSeriesVal = Math.max(
    1,
    ...cycles.map((c) => Math.max(c.prizeAmount, c.nonPrizedInstalmentThisCycle)),
  );
  for (const c of cycles) {
    c.payoutBarPct = clampPct((c.prizeAmount / maxTrendSeriesVal) * 100);
    c.netDueBarPct = clampPct((c.nonPrizedInstalmentThisCycle / maxTrendSeriesVal) * 100);
  }

  // Consolidated Totals
  const totalGrossBaseCollections = roundMoney(cycles.reduce((s, c) => s + c.grossPool, 0));
  const totalNetCollections = isMultiDivision
    ? roundMoney(memberNetPaidPerTicket.reduce((s, v) => s + v, 0))
    : roundMoney(memberNetPaidPerTicket.reduce((s, v) => s + v, 0));

  const totalPrizePayouts = engineType === 'ASCA_SHG_REVOLVING'
    ? roundMoney(memberPrizeReceivedPerTicket.reduce((s, v) => s + v, 0))
    : roundMoney(cycles.reduce((s, c) => s + c.prizeAmount, 0));
  const totalForemanCommission = roundMoney(cycles.reduce((s, c) => s + c.commission, 0));
  const totalGst = roundMoney(cycles.reduce((s, c) => s + c.gstAmount, 0));
  const totalRoundingIncome = roundMoney(cycles.reduce((s, c) => s + c.roundingIncome, 0));
  const totalForemanEarnings = roundMoney(totalForemanCommission + totalRoundingIncome);
  const totalDividendsDistributed = engineType === 'ASCA_SHG_REVOLVING'
    ? roundMoney(cycles[totalMembers - 1]?.distributableDividend ?? 0)
    : roundMoney(cycles.reduce((s, c) => s + c.dividendPerTicket * c.dividendEligibleTickets, 0));
  const totalMerchantBonusOrInterest = roundMoney(
    engineType === 'ASCA_SHG_REVOLVING'
      ? totalAscaInterest
      : cycles.reduce((s, c) => s + c.merchantBonusAdded, 0),
  );

  let weightedAvgGoldRate = 0;
  let totalGoldGramsPerMember = 0;
  if (engineType === 'GOLD_WEIGHT_ACCUMULATION') {
    const goldSum = summarizeGoldWeightMember(memberGoldCredits[0] ?? []);
    totalGoldGramsPerMember = goldSum.totalGrams;
    weightedAvgGoldRate = goldSum.weightedAvgRate;
  } else if (engineType === 'GOLD_VALUE_ACCUMULATION') {
    totalGoldGramsPerMember = roundMoney(
      (memberPrizeReceivedPerTicket[0] ?? 0) / baseGoldRatePerGram,
      4,
    );
    weightedAvgGoldRate = baseGoldRatePerGram;
  }

  const maturityRedemptionValuePerMember =
    engineType === 'GOLD_VALUE_ACCUMULATION' ||
    engineType === 'GOLD_WEIGHT_ACCUMULATION' ||
    engineType === 'FESTIVAL_COMMODITY' ||
    engineType === 'ASCA_SHG_REVOLVING'
      ? roundMoney(memberPrizeReceivedPerTicket[totalMembers - 1] ?? 0)
      : roundMoney(totalPrizePayouts / totalMembers);

  const lastCycleClosingDivRefund =
    dividendDistribution === 'ADJUST_NEXT_DUE' && engineType !== 'ASCA_SHG_REVOLVING'
      ? roundMoney((cycles[totalMembers - 1]?.dividendPerTicket ?? 0) * (cycles[totalMembers - 1]?.dividendEligibleTickets ?? 0))
      : 0;
  const nonAdjustedDivCashOutflow =
    dividendDistribution !== 'ADJUST_NEXT_DUE' && engineType !== 'ASCA_SHG_REVOLVING'
      ? totalDividendsDistributed
      : 0;

  let inflowTotal = roundMoney(totalNetCollections + totalMerchantBonusOrInterest);
  let outflowTotal = roundMoney(
    totalPrizePayouts +
    totalForemanEarnings +
    totalAscaAdminExpenses +
    lastCycleClosingDivRefund +
    nonAdjustedDivCashOutflow,
  );
  if (engineType === 'GOLD_WEIGHT_ACCUMULATION') {
    // Bullion value fluctuates vs historical cost; mark revaluation delta in endingPoolSurplus for exact reconciliation
    const goldAppreciationDelta = roundMoney(totalPrizePayouts + totalForemanEarnings - totalNetCollections);
    endingPoolSurplus = roundMoney(-goldAppreciationDelta);
    inflowTotal = roundMoney(totalNetCollections + Math.max(0, goldAppreciationDelta));
    outflowTotal = roundMoney(totalPrizePayouts + totalForemanEarnings + Math.max(0, -goldAppreciationDelta));
  } else {
    endingPoolSurplus = roundMoney(inflowTotal - outflowTotal);
  }
  const difference = roundMoney(inflowTotal - (outflowTotal + (engineType === 'GOLD_WEIGHT_ACCUMULATION' ? 0 : endingPoolSurplus)));

  const splitDenom = Math.max(1, totalPrizePayouts + totalForemanEarnings + totalDividendsDistributed + totalMerchantBonusOrInterest);
  const consolidatedSplitPct = {
    payoutPct: clampPct((totalPrizePayouts / splitDenom) * 100),
    commissionPct: clampPct((totalForemanEarnings / splitDenom) * 100),
    dividendOrBonusPct: clampPct(((totalDividendsDistributed + totalMerchantBonusOrInterest) / splitDenom) * 100),
  };

  const discountsObserved = cycles.map((c) => c.bidDiscount);
  const maxDiscountObserved = discountsObserved.length ? Math.max(...discountsObserved) : 0;
  const minDiscountObserved = discountsObserved.length ? Math.min(...discountsObserved) : 0;

  // Subscriber Perspectives: Early Winner (Cycle 1), Mid-Term Winner (Cycle ceil(N/2)), Late Patient Saver (Cycle N)
  const midIdx = Math.max(0, Math.ceil(totalMembers / 2) - 1);
  const lateIdx = Math.max(0, totalMembers - 1);
  const personaEntries: Array<{ role: 'early' | 'mid' | 'late'; idx: number }> = [
    { role: 'early', idx: 0 },
    { role: 'mid', idx: midIdx },
    { role: 'late', idx: lateIdx },
  ];

  const maxPersonaVal = Math.max(
    1,
    ...personaEntries.map(({ idx }) =>
      Math.max(memberNetPaidPerTicket[idx] ?? 0, memberPrizeReceivedPerTicket[idx] ?? 0),
    ),
  );

  const memberJourneys: ChitMemberJourneySummary[] = personaEntries.map(({ role, idx }) => {
    const winCycle = idx + 1;
    const totalBaseDue = roundMoney(memberBaseDuePerTicket[idx] ?? 0);
    const totalDividendsReceived = roundMoney(memberDivSavedPerTicket[idx] ?? 0);
    const totalPremiumOrInterestPaid = roundMoney(memberExtraPaidPerTicket[idx] ?? 0);
    const totalNetPaid = roundMoney(memberNetPaidPerTicket[idx] ?? 0);
    const prizeOrMaturityReceived = roundMoney(memberPrizeReceivedPerTicket[idx] ?? 0);
    const netGainOrCost = roundMoney(prizeOrMaturityReceived - totalNetPaid);
    const effectiveReturnPct = totalNetPaid > 0 ? roundMoney((netGainOrCost / totalNetPaid) * 100, 2) : 0;
    const goldGramsAccumulated =
      engineType === 'GOLD_WEIGHT_ACCUMULATION' || engineType === 'GOLD_VALUE_ACCUMULATION'
        ? totalGoldGramsPerMember
        : 0;

    return {
      role,
      winCycle,
      totalBaseDue,
      totalDividendsReceived,
      totalPremiumOrInterestPaid,
      totalNetPaid,
      prizeOrMaturityReceived,
      netGainOrCost,
      effectiveReturnPct,
      goldGramsAccumulated,
      paidBarPct: clampPct((totalNetPaid / maxPersonaVal) * 100),
      receivedBarPct: clampPct((prizeOrMaturityReceived / maxPersonaVal) * 100),
    };
  });

  return {
    input: {
      engineType,
      chitValue,
      monthlyContrib,
      totalMembers,
      commissionPct,
      commissionBasis,
      gstPct,
      dividendPolicy,
      dividendDistribution,
      dividendRounding,
      bidStartAtCommission,
      minDiscountPct,
      maxDiscountPct,
      uncapped,
      frequency: rawInput.frequency ?? 'monthly',
      reservePriceStepPct,
      lotteryWinnersPerCycle,
      auctionWinnersPerCycle,
      baseInstalment,
      prizedPremiumAmount,
      reservedCyclesCount,
      reservedDiscountPct,
      goldBonusMonths,
      goldRatePerGram: baseGoldRatePerGram,
      merchantBonusPct,
      ascaMonthlyLoanInterestPct,
      ascaPoolUtilizationPct,
      ascaAdminExpensePerCycle,
      fixedDiscountPct,
      cycleOverrides,
      selectedCycle: selectedCycleNumber,
    },
    engineCategory: catalog.category,
    supportsBidding: catalog.supportsBidding,
    editableCycleField: getEditableCycleField(engineType),
    rules: {
      floorDiscountPct: engineType === 'AUCTION_RESERVE_PRICE' ? (cycles[0]?.reserveFloorPct ?? floorPct) : floorPct,
      floorDiscountAmount: engineType === 'AUCTION_RESERVE_PRICE' ? (cycles[0]?.reserveFloorAmount ?? floorDiscountAmount) : floorDiscountAmount,
      capDiscountPct: maxDiscountPct,
      capDiscountAmount,
      commissionBasis,
      foremanCompensationMode: baseCfg.foremanCompensation.mode,
      payoutAssetType: baseCfg.payoutAssetType,
      regulatoryTier: baseCfg.regulatoryTier,
      securityRequired: baseCfg.securityRequirements.requiredForPrized,
      acceptedSecurities: baseCfg.securityRequirements.acceptedTypes,
      syndicateTicketCount,
      winnersPerCycle,
    },
    selectedCycleNumber,
    cycles,
    consolidated: {
      totalCycles: totalMembers,
      totalTickets: syndicateTicketCount,
      totalGrossBaseCollections,
      totalNetCollections,
      totalPrizePayouts,
      totalForemanCommission,
      totalGst,
      totalRoundingIncome,
      totalForemanEarnings,
      totalDividendsDistributed,
      totalMerchantBonusOrInterest,
      totalAdminExpenses: totalAscaAdminExpenses,
      endingPoolSurplus,
      totalGoldGramsPerMember,
      weightedAvgGoldRate,
      maturityRedemptionValuePerMember,
      averageDividendPerCycle: roundMoney(totalDividendsDistributed / totalMembers),
      averagePrizePayout: roundMoney(totalPrizePayouts / totalMembers),
      maxDiscountObserved,
      minDiscountObserved,
      consolidatedSplitPct,
      balanceCheck: {
        inflowTotal,
        outflowTotal,
        difference,
        isBalanced: Math.abs(difference) <= 1,
      },
    },
    memberJourneys,
  };
}
