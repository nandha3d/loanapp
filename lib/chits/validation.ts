import type {
  ChitAuctionType,
  ChitCommissionBasis,
  ChitDividendDistribution,
  ChitDividendPolicy,
  ChitTieBreakRule,
  ChitWinnerInterestType,
} from './types';
import {
  BIDDING_MODES,
  CHIT_ENGINE_TYPES,
  CHIT_SECURITY_TYPES,
  COLLECTION_FREQUENCIES,
  FOREMAN_COMPENSATION_MODES,
  LATE_FEE_TYPES,
  PAYOUT_ASSET_TYPES,
  REGULATORY_TIERS,
  SCALE_TIERS,
  isChitEngineType,
  type ChitEngineConfig,
  type ChitEngineType,
} from './engineTypes';

const AUCTION_TYPES: ChitAuctionType[] = ['open_manual', 'open_live', 'sealed', 'lottery', 'fixed_rotation'];
const COMMISSION_BASIS: ChitCommissionBasis[] = ['BID_DISCOUNT', 'CHIT_VALUE'];
const DIVIDEND_POLICIES: ChitDividendPolicy[] = ['ALL_MEMBERS', 'NON_WINNERS_ONLY', 'NON_PRIZED_ONLY', 'NONE'];
const DIVIDEND_DISTRIBUTIONS: ChitDividendDistribution[] = [
  'ADJUST_NEXT_DUE',
  'CASH_PAYOUT',
  'ACCUMULATE',
  'DEFERRED_BONUS_POOL',
  'NONE',
];
const TIE_BREAK_RULES: ChitTieBreakRule[] = ['EARLIEST_BID', 'LOTTERY_AMONG_TIED', 'MANUAL_FOREMAN_PICK'];
const WINNER_INTEREST_TYPES: ChitWinnerInterestType[] = ['NONE', 'FIXED', 'PERCENT'];

// Single source of truth for "what's the minimum bid discount %, if any" —
// co-located with assertValidPrizeAmount since every caller that computes a
// minimum-next-bid figure (the hard validator here, the customer live-state
// builder, the staff live-room poll) must agree on the same number or staff
// and customers see different "starting bid" numbers for the same auction.
export function effectiveMinDiscountPct(group: {
  minDiscountPct?: number | null;
  bidStartAtCommission?: boolean | null;
  commissionPct?: number | null;
  reserveFloorPct?: number | null;
}): number | null {
  let base: number | null = null;
  if (group.minDiscountPct != null) {
    base = group.minDiscountPct; // explicit always wins
  } else if (group.bidStartAtCommission !== false && group.commissionPct != null) {
    base = group.commissionPct;
  }
  if (group.reserveFloorPct != null && Number.isFinite(group.reserveFloorPct)) {
    return base != null ? Math.max(base, group.reserveFloorPct) : group.reserveFloorPct;
  }
  return base;
}

export function startingDiscountAmount(
  chitValue: number,
  group: Parameters<typeof effectiveMinDiscountPct>[0],
): number {
  const pct = effectiveMinDiscountPct(group);
  return pct != null ? Math.round(((chitValue * pct) / 100) * 100) / 100 : 0;
}

export function assertValidPrizeAmount(params: {
  chitValue: number;
  prizeAmount: number;
  maxDiscountPct?: number | null;
  minDiscountPct?: number | null;
  commissionPct?: number | null;
  bidStartAtCommission?: boolean | null;
  reserveFloorPct?: number | null;
  uncapped?: boolean;
}) {
  const { chitValue, prizeAmount, maxDiscountPct, uncapped } = params;
  if (prizeAmount <= 0) throw new Error('Prize amount must be greater than zero');
  if (prizeAmount > chitValue) throw new Error('Prize amount cannot exceed chit value');

  const discount = chitValue - prizeAmount;
  const discountPct = chitValue > 0 ? (discount / chitValue) * 100 : 0;
  const minPct = effectiveMinDiscountPct(params);
  if (minPct != null && discountPct + 1e-9 < minPct) {
    throw new Error(`Bid discount must be at least ${minPct}%`);
  }
  if (!uncapped && maxDiscountPct != null && discountPct - 1e-9 > maxDiscountPct) {
    throw new Error(`Bid discount exceeds allowed maximum of ${maxDiscountPct}%`);
  }
}

export function assertValidCommissionPct(params: {
  commissionPct: number;
  foremanCommissionCapPct?: number | null;
}) {
  const { commissionPct, foremanCommissionCapPct } = params;
  if (commissionPct < 0) throw new Error('Commission percentage cannot be negative');
  if (foremanCommissionCapPct != null && commissionPct > foremanCommissionCapPct) {
    throw new Error(`Commission exceeds allowed cap of ${foremanCommissionCapPct}%`);
  }
}

export function validateChitConfig(input: {
  auctionType?: string | null;
  commissionBasis?: string | null;
  dividendPolicy?: string | null;
  dividendDistribution?: string | null;
  tieBreakRule?: string | null;
  minDiscountPct?: number | null;
  maxDiscountPct?: number | null;
  fixedDiscountPct?: number | null;
  auctionTime?: string | null;
  winnerInterestType?: string | null;
  winnerInterestValue?: number | null;
  winnerInterestPeriods?: number | null;
}) {
  if (input.auctionType && !AUCTION_TYPES.includes(input.auctionType as ChitAuctionType)) {
    throw new Error('Invalid auction type');
  }
  if (input.commissionBasis && !COMMISSION_BASIS.includes(input.commissionBasis as ChitCommissionBasis)) {
    throw new Error('Invalid commission basis');
  }
  if (input.dividendPolicy && !DIVIDEND_POLICIES.includes(input.dividendPolicy as ChitDividendPolicy)) {
    throw new Error('Invalid dividend policy');
  }
  if (input.dividendDistribution && !DIVIDEND_DISTRIBUTIONS.includes(input.dividendDistribution as ChitDividendDistribution)) {
    throw new Error('Invalid dividend distribution');
  }
  if (input.tieBreakRule && !TIE_BREAK_RULES.includes(input.tieBreakRule as ChitTieBreakRule)) {
    throw new Error('Invalid tie break rule');
  }
  if (input.minDiscountPct != null && input.maxDiscountPct != null && input.minDiscountPct > input.maxDiscountPct) {
    throw new Error('Minimum discount cannot exceed maximum discount');
  }
  if (input.fixedDiscountPct != null && input.fixedDiscountPct < 0) {
    throw new Error('Fixed discount cannot be negative');
  }
  if (input.fixedDiscountPct != null && input.maxDiscountPct != null && input.fixedDiscountPct > input.maxDiscountPct) {
    throw new Error('Fixed discount cannot exceed maximum discount');
  }
  if (input.auctionTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.auctionTime)) {
    throw new Error('Auction time must be HH:mm');
  }
  const winnerInterestType = input.winnerInterestType ?? 'NONE';
  if (!WINNER_INTEREST_TYPES.includes(winnerInterestType as ChitWinnerInterestType)) {
    throw new Error('Invalid winner interest type');
  }
  if (winnerInterestType === 'NONE') return;
  if (input.winnerInterestValue == null || input.winnerInterestValue <= 0) {
    throw new Error('Winner interest value must be greater than zero');
  }
  if (winnerInterestType === 'PERCENT' && input.winnerInterestValue > 100) {
    throw new Error('Winner interest percent cannot exceed 100');
  }
  if (input.winnerInterestPeriods == null || input.winnerInterestPeriods <= 0) {
    throw new Error('Winner interest periods must be greater than zero');
  }
  if (!Number.isInteger(input.winnerInterestPeriods)) {
    throw new Error('Winner interest periods must be a whole number');
  }
}

export function validateChitEngineConfig(
  engineType: string,
  config: ChitEngineConfig,
  context: { totalMembers?: number; requireScheduleRows?: boolean } = {},
) {
  if (!isChitEngineType(engineType)) {
    throw new Error(`Invalid chit engine type: ${engineType} (expected one of ${CHIT_ENGINE_TYPES.join(', ')})`);
  }
  if (!(REGULATORY_TIERS as readonly string[]).includes(config.regulatoryTier)) {
    throw new Error('Invalid regulatory tier');
  }
  if (!(SCALE_TIERS as readonly string[]).includes(config.scaleTier)) {
    throw new Error('Invalid scale tier');
  }
  if (!(COLLECTION_FREQUENCIES as readonly string[]).includes(config.collectionFrequency)) {
    throw new Error('Invalid collection frequency');
  }
  if (!(PAYOUT_ASSET_TYPES as readonly string[]).includes(config.payoutAssetType)) {
    throw new Error('Invalid payout asset type');
  }
  if (!(BIDDING_MODES as readonly string[]).includes(config.biddingMode)) {
    throw new Error('Invalid bidding mode');
  }
  if (!(FOREMAN_COMPENSATION_MODES as readonly string[]).includes(config.foremanCompensation.mode)) {
    throw new Error('Invalid foreman compensation mode');
  }
  if (!(LATE_FEE_TYPES as readonly string[]).includes(config.defaultRules.lateFeeType)) {
    throw new Error('Invalid late fee type');
  }
  for (const t of config.securityRequirements.acceptedTypes) {
    if (!(CHIT_SECURITY_TYPES as readonly string[]).includes(t)) {
      throw new Error(`Invalid security collateral type: ${t}`);
    }
  }

  if (config.foremanCompensation.commissionPct < 0) {
    throw new Error('Foreman commission percentage cannot be negative');
  }
  if (config.foremanCompensation.flatFeeAmount < 0) {
    throw new Error('Foreman flat fee cannot be negative');
  }
  if (config.discountRules.minDiscountPct < 0) {
    throw new Error('Minimum discount percentage cannot be negative');
  }
  if (
    !config.discountRules.uncapped &&
    config.discountRules.maxDiscountPct != null &&
    config.discountRules.minDiscountPct > config.discountRules.maxDiscountPct
  ) {
    throw new Error('Minimum discount cannot exceed maximum discount');
  }
  if (config.discountRules.reservePriceStepPct < 0) {
    throw new Error('Reserve price step percentage cannot be negative');
  }
  if (config.discountRules.bidIncrementMultiple < 0) {
    throw new Error('Bid increment multiple cannot be negative');
  }
  if (config.defaultRules.lateFeeValue < 0) {
    throw new Error('Late fee value cannot be negative');
  }
  if (config.defaultRules.substitutionCutoffPct < 0 || config.defaultRules.substitutionCutoffPct > 100) {
    throw new Error('Substitution cutoff percentage must be between 0 and 100');
  }

  const typedEngine: ChitEngineType = engineType;
  if (typedEngine === 'AUCTION_RESERVE_PRICE' && !(config.discountRules.reservePriceStepPct > 0)) {
    throw new Error('Reserve-price auction requires reserve price step % greater than zero');
  }

  if (typedEngine === 'AUCTION_MULTI_DIVISION') {
    const lot = config.multiDivision.lotteryWinnersPerCycle;
    const auc = config.multiDivision.auctionWinnersPerCycle;
    if (lot < 0 || auc < 1) {
      throw new Error('Multi-division chit requires at least 1 auction winner and non-negative lottery winners');
    }
    if (context.totalMembers && lot + auc > context.totalMembers) {
      throw new Error('Multi-division winners per cycle cannot exceed total members');
    }
  }

  if (typedEngine === 'BASE_PLUS_PREMIUM') {
    if (config.differentialInstalment.prizedPremiumAmount < 0) {
      throw new Error('Prized premium amount cannot be negative');
    }
    if (config.differentialInstalment.enabled && config.differentialInstalment.baseInstalment < 0) {
      throw new Error('Base instalment cannot be negative');
    }
  }

  if (typedEngine === 'FIXED_CHART_ESCALATING' && config.escalatingPayouts?.length) {
    for (const row of config.escalatingPayouts) {
      if (!(row.payoutAmount > 0)) {
        throw new Error(`Escalating chart period ${row.period} payout must be greater than zero`);
      }
    }
  }

  if (typedEngine === 'FIXED_DIVIDEND' && config.fixedDividends?.length) {
    for (const row of config.fixedDividends) {
      if (row.dividendPerTicket < 0) {
        throw new Error(`Fixed dividend period ${row.period} cannot be negative`);
      }
    }
  }

  if (typedEngine === 'FIXED_PAYOUT_VARIABLE_PAY' && config.variableInstalments?.length) {
    for (const row of config.variableInstalments) {
      if (row.nonPrizedDue < 0 || row.prizedDue < 0) {
        throw new Error(`Variable instalment period ${row.period} cannot be negative`);
      }
    }
  }

  if (typedEngine === 'CUSTOM_MANUAL_SCHEDULE') {
    if (context.requireScheduleRows && (!config.customSchedule || config.customSchedule.length === 0)) {
      throw new Error('Custom manual schedule requires at least one cycle row');
    }
    if (config.customSchedule?.length) {
      for (const row of config.customSchedule) {
        if (row.instalmentNonPrized < 0 || row.instalmentPrized < 0 || row.payoutAmount < 0 || row.commission < 0) {
          throw new Error(`Custom schedule period ${row.period} contains negative amounts`);
        }
      }
    }
  }

  if (typedEngine === 'HYBRID_SPLIT_PHASE') {
    const reservedCount = config.hybridSplitPhase?.reservedCyclesCount ?? 0;
    const reservedDiscount = config.hybridSplitPhase?.reservedDiscountPct ?? 0;
    if (reservedCount < 0 || reservedDiscount < 0) {
      throw new Error('Hybrid split phase counts and discount cannot be negative');
    }
    if (context.totalMembers && reservedCount >= context.totalMembers) {
      throw new Error('Hybrid reserved cycles count must be less than total members');
    }
  }

  if (typedEngine === 'ASCA_SHG_REVOLVING' && config.ascaPool) {
    if (config.ascaPool.monthlyLoanInterestPct < 0 || config.ascaPool.maxLoanMultiplier < 0 || config.ascaPool.adminExpensePerCycle < 0) {
      throw new Error('ASCA / SHG pool settings cannot be negative');
    }
  }
}

export function validateChitGroupActivation(input: {
  chitType?: string | null;
  registrationNo?: string | null;
  registrationDate?: Date | string | null;
  registrarOffice?: string | null;
  bylawNo?: string | null;
  commencementCertificate?: string | null;
  approvedBankName?: string | null;
  foremanName?: string | null;
  commissionPct: number;
  foremanCommissionCapPct?: number | null;
  maxDiscountPct?: number | null;
  totalMembers: number;
  actualMembers: number;
  distinctTicketCount?: number;
  missingTicketCount?: number;
  duplicateTicketCount?: number;
  pendingAgreementCount?: number;
  hasForemanTicket?: boolean;
  foremanTicketCount?: number;
}) {
  const missing: string[] = [];
  const registered = input.chitType === 'registered';
  if (registered) {
    if (!input.registrationNo) missing.push('Registration number');
    if (!input.registrationDate) missing.push('Registration date');
    if (!input.registrarOffice) missing.push('Registrar office');
    if (!input.bylawNo) missing.push('By-law number');
    if (!input.commencementCertificate) missing.push('Commencement certificate');
    if (!input.approvedBankName) missing.push('Approved bank name');
    if (!input.foremanName) missing.push('Foreman name');
  }
  if (!(input.actualMembers > 0)) missing.push('At least one member');
  if (input.actualMembers < input.totalMembers) missing.push('All member slots must be added');
  if (input.missingTicketCount) missing.push('Every member must have a ticket number');
  if (input.duplicateTicketCount) missing.push('Ticket numbers must be unique or share-balanced fractions');
  if (input.distinctTicketCount != null && input.distinctTicketCount !== input.totalMembers) {
    missing.push('Distinct ticket count must match total members');
  }
  if (input.pendingAgreementCount) missing.push('All required agreements must be signed or verified');
  if (input.hasForemanTicket && input.foremanTicketCount !== 1) {
    missing.push('Exactly one foreman ticket is required');
  }
  if (input.foremanCommissionCapPct != null && input.commissionPct > input.foremanCommissionCapPct) {
    missing.push('Commission percentage exceeds cap');
  }
  if (input.maxDiscountPct != null && input.maxDiscountPct < 0) {
    missing.push('Maximum discount must be non-negative');
  }
  if (missing.length) {
    throw new Error(`Cannot activate chit group. Missing/invalid: ${missing.join(', ')}`);
  }
}
