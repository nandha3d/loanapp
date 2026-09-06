export type ChitDividendPolicy = 'ALL_MEMBERS' | 'NON_WINNERS_ONLY';
export type ChitDividendDistribution = 'ADJUST_NEXT_DUE' | 'CASH_PAYOUT' | 'ACCUMULATE';
export type ChitCommissionBasis = 'BID_DISCOUNT' | 'CHIT_VALUE';
export type ChitPaymentMode = 'ADD_PAYMENT' | 'SET_TOTAL_PAID';
export type ChitAuctionType = 'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation';
export type ChitTieBreakRule = 'EARLIEST_BID' | 'LOTTERY_AMONG_TIED';
export type ChitWinnerInterestType = 'NONE' | 'FIXED' | 'PERCENT';

export type ChitAuctionCalculationInput = {
  chitValue: number;
  prizeAmount: number;
  commissionPct: number;
  totalMembers: number;
  dividendPolicy?: ChitDividendPolicy;
  commissionBasis?: ChitCommissionBasis;
  gstPct?: number | null;
  roundTo?: number;
  dividendRounding?: number;
};

export type ChitAuctionCalculationResult = {
  chitValue: number;
  prizeAmount: number;
  bidDiscount: number;
  commission: number;
  gstAmount: number;
  distributableDividend: number;
  dividend: number;
  dividendEligibleMembers: number;
  roundingIncome: number;
};

export type ChitPaymentCalculationInput = {
  currentPaidAmount: number;
  incomingAmount: number;
  dueAmount: number;
  mode: ChitPaymentMode;
};

export type ChitPaymentCalculationResult = {
  previousPaidAmount: number;
  newPaidAmount: number;
  receivedDelta: number;
  status: 'upcoming' | 'partial' | 'paid' | 'missed';
};

export type ChitScope = {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  role: string;
  userId?: string | null;
};
