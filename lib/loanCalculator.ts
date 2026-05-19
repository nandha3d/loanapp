import { calculateInstalmentDates } from './utils';

export type InterestType =
  | 'upfront_fixed'
  | 'upfront_percentage'
  | 'emi_flat'
  | 'emi_floating';

export type LoanCalculationInput = {
  principal: number;
  interestType?: InterestType | string;
  interestRate?: number;
  tenure: number;
  frequency?: string;
  startDate?: Date | string;
  dueDay?: number | null;
};

export type LoanCalculationResult = {
  principal: number;
  disbursedAmount: number;
  totalPayable: number;
  perInstalment: number;
  deduction: number;
  schedule: Array<{
    instalmentNo: number;
    dueDate: Date;
    dueAmount: number;
  }>;
};

function assertFiniteAmount(value: number, message: string) {
  if (!Number.isFinite(value)) {
    throw new Error(message);
  }
}

export function distributeInstalmentAmounts(totalPayable: number, tenure: number): number[] {
  const base = Math.floor(totalPayable / tenure);
  const amounts = Array.from({ length: tenure }, () => base);
  const remainder = Math.round(totalPayable - base * tenure);
  if (amounts.length > 0) {
    amounts[amounts.length - 1] += remainder;
  }
  return amounts;
}

export function calculateLoanPreview(input: LoanCalculationInput): LoanCalculationResult {
  const principal = Number(input.principal);
  const rate = Number(input.interestRate ?? 0);
  const tenure = Number(input.tenure);
  const interestType = input.interestType || 'upfront_fixed';
  const frequency = input.frequency || 'daily';
  const startDate = input.startDate ? new Date(input.startDate) : new Date();

  assertFiniteAmount(principal, 'Principal must be a valid number.');
  assertFiniteAmount(rate, 'Deduction or interest rate must be a valid number.');
  if (!Number.isInteger(tenure)) {
    throw new Error('Tenure must be a positive whole number.');
  }
  if (principal <= 0) {
    throw new Error('Principal must be greater than zero.');
  }
  if (rate < 0) {
    throw new Error('Deduction or interest rate cannot be negative.');
  }
  if (tenure <= 0) {
    throw new Error('Tenure must be a positive whole number.');
  }
  if (Number.isNaN(startDate.getTime())) {
    throw new Error('Invalid start date.');
  }

  let disbursedAmount = principal;
  let totalPayable = principal;
  let deduction = 0;

  switch (interestType) {
    case 'upfront_fixed':
      deduction = rate;
      disbursedAmount = principal - deduction;
      totalPayable = principal;
      break;
    case 'upfront_percentage':
      deduction = Math.round(principal * (rate / 100));
      disbursedAmount = principal - deduction;
      totalPayable = principal;
      break;
    case 'emi_flat': {
      const interestAmount = principal * (rate / 100);
      disbursedAmount = principal;
      totalPayable = principal + interestAmount;
      break;
    }
    case 'emi_floating': {
      let periodsPerYear = 12;
      if (frequency === 'daily') periodsPerYear = 365;
      else if (frequency === 'weekly') periodsPerYear = 52;
      else if (frequency === 'biweekly') periodsPerYear = 26;

      const periodicRate = (rate / 100) / periodsPerYear;
      disbursedAmount = principal;
      if (periodicRate === 0) {
        totalPayable = principal;
      } else {
        const emi = principal * periodicRate * Math.pow(1 + periodicRate, tenure)
          / (Math.pow(1 + periodicRate, tenure) - 1);
        totalPayable = Math.round(emi) * tenure;
      }
      break;
    }
    default:
      disbursedAmount = principal;
      totalPayable = principal;
  }

  const amounts = distributeInstalmentAmounts(totalPayable, tenure);
  const perInstalment = amounts[0] ?? 0;
  const dates = calculateInstalmentDates(startDate, frequency, tenure, input.dueDay);

  return {
    principal,
    disbursedAmount,
    totalPayable,
    perInstalment,
    deduction,
    schedule: dates.map((dueDate, index) => ({
      instalmentNo: index + 1,
      dueDate,
      dueAmount: amounts[index],
    })),
  };
}
