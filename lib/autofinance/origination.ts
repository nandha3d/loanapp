import {
  calculateHpDisbursement,
  calculateHpQuote,
  validatePayoutSplit,
  type HpScheduleRow,
  type InterestMethod,
} from './hp';

export type HpOriginationInput = {
  vehicleValue: number;
  downPayment?: number | null;
  interestRate?: number | null;
  interestMethod?: InterestMethod | null;
  tenureMonths: number;
  roundOffEmi?: boolean;
  startDate: Date | string;
  firstDueDate?: Date | string | null;
  dueDay?: number | null;
  handLoanAmount?: number | null;
  insuranceCharge?: number | null;
  documentCharge?: number | null;
  brokerCommission?: number | null;
  payoutMode1?: string | null;
  payoutAmount1?: number | null;
  payoutMode2?: string | null;
  payoutAmount2?: number | null;
};

export type HpOriginationScheduleRow = HpScheduleRow & { dueDate: Date };

export type HpOriginationTerms = {
  principal: number;
  deduction: number;
  deductionType: 'emi_flat' | 'emi_floating';
  disbursedAmount: number;
  totalInterest: number;
  totalPayable: number;
  perInstalment: number;
  grossPayout: number;
  recoveredCharges: number;
  netPayout: number;
  payoutLegs: Array<{ mode: string; amount: number }>;
  cashPayout: number;
  nonCashPayout: number;
  schedule: HpOriginationScheduleRow[];
};

const PAYOUT_MODES = new Set([
  'cash',
  'bank',
  'bank_transfer',
  'upi',
  'online',
  'neft',
  'rtgs',
  'imps',
  'cheque',
  'dd',
]);

function asNonNegative(value: number | null | undefined, label: string): number {
  const resolved = Number(value ?? 0);
  if (!Number.isFinite(resolved)) throw new Error(`${label} must be a valid number.`);
  if (resolved < 0) throw new Error(`${label} cannot be negative.`);
  return resolved;
}

function dateOnly(value: Date | string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid.`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthlyDueDates(input: HpOriginationInput): Date[] {
  const issueDate = dateOnly(input.startDate, 'Issue date');
  let first: Date;

  if (input.firstDueDate) {
    first = dateOnly(input.firstDueDate, 'First due date');
    if (first.getTime() <= issueDate.getTime()) {
      throw new Error('First due date must be after the issue date.');
    }
  } else {
    const requestedDay = Number(input.dueDay ?? issueDate.getUTCDate());
    if (!Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 31) {
      throw new Error('Due day must be a whole number from 1 to 31.');
    }
    const year = issueDate.getUTCFullYear();
    const month = issueDate.getUTCMonth() + 1;
    const day = Math.min(requestedDay, daysInUtcMonth(year, month));
    first = new Date(Date.UTC(year, month, day));
  }

  const dueDay = first.getUTCDate();
  return Array.from({ length: input.tenureMonths }, (_, index) => {
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth() + index;
    return new Date(Date.UTC(year, month, Math.min(dueDay, daysInUtcMonth(year, month))));
  });
}

function validatePayoutLeg(mode: string | null | undefined, amount: number | null | undefined, leg: number) {
  const resolvedAmount = asNonNegative(amount, `Payout amount ${leg}`);
  const normalizedMode = mode?.trim().toLowerCase() ?? '';
  const hasMode = Boolean(normalizedMode);
  if (resolvedAmount > 0 && !hasMode) throw new Error(`Payout mode ${leg} is required.`);
  if (resolvedAmount > 0 && !PAYOUT_MODES.has(normalizedMode)) {
    throw new Error(`Payout mode ${leg} is not supported.`);
  }
  return resolvedAmount;
}

/**
 * Produces the only HP terms that may be persisted. Values claimed by a client
 * (principal, EMI, total payable or payout) are intentionally not accepted.
 */
export function buildHpOriginationTerms(input: HpOriginationInput): HpOriginationTerms {
  const handLoanAmount = asNonNegative(input.handLoanAmount, 'Hand-loan amount');
  const insuranceCharge = asNonNegative(input.insuranceCharge, 'Insurance charge');
  const documentCharge = asNonNegative(input.documentCharge, 'Document charge');
  const brokerCommission = asNonNegative(input.brokerCommission, 'Broker commission');

  const quote = calculateHpQuote({
    vehicleValue: input.vehicleValue,
    downPayment: input.downPayment ?? 0,
    additionalFinancedAmount: handLoanAmount,
    interestRate: input.interestRate ?? 0,
    interestMethod: input.interestMethod ?? 'flat',
    tenureMonths: input.tenureMonths,
    roundOffEmi: input.roundOffEmi,
  });
  const payout = calculateHpDisbursement({
    principal: quote.principal,
    insuranceCharge,
    documentCharge,
    brokerCommission,
  });
  if (payout.netPayout <= 0) {
    throw new Error('Recovered charges must be less than the gross payout.');
  }

  const amount1 = validatePayoutLeg(input.payoutMode1, input.payoutAmount1, 1);
  const amount2 = validatePayoutLeg(input.payoutMode2, input.payoutAmount2, 2);
  const split = validatePayoutSplit(payout.netPayout, amount1, amount2);
  if (!split.valid) throw new Error(split.message);
  const payoutLegs = [
    amount1 > 0 ? { mode: input.payoutMode1!.trim().toLowerCase(), amount: amount1 } : null,
    amount2 > 0 ? { mode: input.payoutMode2!.trim().toLowerCase(), amount: amount2 } : null,
  ].filter((leg): leg is { mode: string; amount: number } => leg !== null);
  if (payoutLegs.length === 0) payoutLegs.push({ mode: 'cash', amount: payout.netPayout });
  const cashPayout = payoutLegs
    .filter((leg) => leg.mode === 'cash')
    .reduce((sum, leg) => sum + leg.amount, 0);

  const dates = monthlyDueDates(input);
  return {
    principal: quote.principal,
    deduction: quote.totalInterest,
    deductionType: input.interestMethod === 'diminishing' ? 'emi_floating' : 'emi_flat',
    disbursedAmount: payout.netPayout,
    totalInterest: quote.totalInterest,
    totalPayable: quote.totalPayable,
    perInstalment: quote.emi,
    grossPayout: payout.grossPayout,
    recoveredCharges: payout.recoveredCharges,
    netPayout: payout.netPayout,
    payoutLegs,
    cashPayout,
    nonCashPayout: payout.netPayout - cashPayout,
    schedule: quote.schedule.map((row, index) => ({ ...row, dueDate: dates[index]! })),
  };
}
