import type { ChitAuctionType, ChitCommissionBasis, ChitDividendDistribution, ChitDividendPolicy, ChitTieBreakRule, ChitWinnerInterestType } from './types';

const AUCTION_TYPES: ChitAuctionType[] = ['open_manual', 'open_live', 'sealed', 'lottery', 'fixed_rotation'];
const COMMISSION_BASIS: ChitCommissionBasis[] = ['BID_DISCOUNT', 'CHIT_VALUE'];
const DIVIDEND_POLICIES: ChitDividendPolicy[] = ['ALL_MEMBERS', 'NON_WINNERS_ONLY'];
const DIVIDEND_DISTRIBUTIONS: ChitDividendDistribution[] = ['ADJUST_NEXT_DUE', 'CASH_PAYOUT', 'ACCUMULATE'];
const TIE_BREAK_RULES: ChitTieBreakRule[] = ['EARLIEST_BID', 'LOTTERY_AMONG_TIED'];
const WINNER_INTEREST_TYPES: ChitWinnerInterestType[] = ['NONE', 'FIXED', 'PERCENT'];

export function assertValidPrizeAmount(params: {
  chitValue: number;
  prizeAmount: number;
  maxDiscountPct?: number | null;
  minDiscountPct?: number | null;
  commissionPct?: number | null;
}) {
  const { chitValue, prizeAmount, maxDiscountPct, minDiscountPct, commissionPct } = params;
  if (prizeAmount <= 0) throw new Error('Prize amount must be greater than zero');
  if (prizeAmount > chitValue) throw new Error('Prize amount cannot exceed chit value');

  const discount = chitValue - prizeAmount;
  const discountPct = chitValue > 0 ? (discount / chitValue) * 100 : 0;
  const minPct = minDiscountPct ?? commissionPct ?? null;
  if (minPct != null && discountPct < minPct) {
    throw new Error(`Bid discount must be at least ${minPct}%`);
  }
  if (maxDiscountPct != null && discountPct > maxDiscountPct) {
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
