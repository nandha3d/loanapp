import type {
  ChitAuctionCalculationInput,
  ChitAuctionCalculationResult,
  ChitPaymentCalculationInput,
  ChitPaymentCalculationResult,
} from './types';

export function roundMoney(value: number, roundTo = 2) {
  const factor = Math.pow(10, roundTo);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundDividendDown(value: number, increment: number, roundTo: number) {
  if (!increment || increment <= 0) return roundMoney(value, roundTo);
  return Math.floor(value / increment) * increment;
}

export function calculateChitAuction(input: ChitAuctionCalculationInput): ChitAuctionCalculationResult {
  const dividendPolicy = input.dividendPolicy ?? 'ALL_MEMBERS';
  const commissionBasis = input.commissionBasis ?? 'BID_DISCOUNT';
  const roundTo = input.roundTo ?? 2;
  const dividendRounding = input.dividendRounding ?? 0;

  if (!(input.chitValue > 0)) throw new Error('Chit value must be greater than zero');
  if (!(input.prizeAmount > 0)) throw new Error('Prize amount must be greater than zero');
  if (input.prizeAmount > input.chitValue) throw new Error('Prize amount cannot exceed chit value');
  if (!(input.totalMembers > 0)) throw new Error('Total members must be greater than zero');
  if (input.commissionPct < 0) throw new Error('Commission percentage cannot be negative');
  if (input.gstPct != null && input.gstPct < 0) throw new Error('GST percentage cannot be negative');

  const bidDiscount = roundMoney(input.chitValue - input.prizeAmount, roundTo);
  const commissionBase = commissionBasis === 'CHIT_VALUE' ? input.chitValue : bidDiscount;
  const commission = roundMoney((commissionBase * input.commissionPct) / 100, roundTo);
  const gstAmount = roundMoney((commission * (input.gstPct ?? 0)) / 100, roundTo);
  const distributableDividend = roundMoney(Math.max(0, bidDiscount - commission), roundTo);
  const dividendEligibleMembers = dividendPolicy === 'NON_WINNERS_ONLY'
    ? Math.max(1, input.totalMembers - 1)
    : input.totalMembers;
  const rawDividend = distributableDividend / dividendEligibleMembers;
  const dividend = roundMoney(roundDividendDown(rawDividend, dividendRounding, roundTo), roundTo);
  const roundingIncome = roundMoney(distributableDividend - dividend * dividendEligibleMembers, roundTo);

  return {
    chitValue: roundMoney(input.chitValue, roundTo),
    prizeAmount: roundMoney(input.prizeAmount, roundTo),
    bidDiscount,
    commission,
    gstAmount,
    distributableDividend,
    dividend,
    dividendEligibleMembers,
    roundingIncome,
  };
}

export function calculateFixedDiscountPrize(input: {
  chitValue: number;
  fixedDiscountPct?: number | null;
  roundTo?: number;
}) {
  if (!(input.chitValue > 0)) throw new Error('Chit value must be greater than zero');
  const fixedDiscountPct = input.fixedDiscountPct ?? 0;
  if (fixedDiscountPct < 0) throw new Error('Fixed discount cannot be negative');
  const roundTo = input.roundTo ?? 2;
  const bidDiscount = roundMoney((input.chitValue * fixedDiscountPct) / 100, roundTo);
  return {
    prizeAmount: roundMoney(input.chitValue - bidDiscount, roundTo),
    bidDiscount,
  };
}

export function calculateChitPayment(input: ChitPaymentCalculationInput): ChitPaymentCalculationResult {
  if (input.currentPaidAmount < 0) throw new Error('Current paid amount cannot be negative');
  if (input.incomingAmount < 0) throw new Error('Incoming amount cannot be negative');
  if (input.dueAmount < 0) throw new Error('Due amount cannot be negative');

  const previousPaidAmount = roundMoney(input.currentPaidAmount);
  const newPaidAmount = input.mode === 'ADD_PAYMENT'
    ? roundMoney(previousPaidAmount + input.incomingAmount)
    : roundMoney(input.incomingAmount);
  const receivedDelta = roundMoney(Math.max(0, newPaidAmount - previousPaidAmount));
  const status = newPaidAmount >= input.dueAmount ? 'paid' : newPaidAmount > 0 ? 'partial' : 'upcoming';

  return { previousPaidAmount, newPaidAmount, receivedDelta, status };
}
