import { calculateEndDate, calculateInstalmentDates } from './utils';

export type InterestType =
  | 'upfront_fixed'
  | 'upfront_percentage'
  | 'emi_flat'
  | 'emi_floating'
  | 'interest_only';

/**
 * How the principal comes back, independent of what is charged for it.
 *
 * `scheduled` is every loan that existed before this type did: n instalments at a
 * cadence. `bullet` is a single payment on a named date — a term measured in DAYS
 * rather than in instalments, which is the shape a short advance ("a lakh for a
 * fortnight") actually has and which `frequency x tenure` cannot express.
 */
export type TermType = 'scheduled' | 'bullet';

/** Months per year — the APR conversion factor for a monthly quoted rate. */
export const MONTHS_PER_YEAR = 12;

/** Days per year — the annualisation factor for a term quoted in days. */
export const DAYS_PER_YEAR = 365;

/**
 * Charge models a bullet term admits.
 *
 * `emi_floating` is an annuity over n periods and degenerates at n=1; `interest_only`
 * bills a MONTHLY rate and has no meaning over a term of days. Both are rejected
 * rather than silently producing a number nobody can explain to a borrower.
 */
export const BULLET_INTEREST_TYPES: readonly string[] = [
  'upfront_fixed',
  'upfront_percentage',
  'emi_flat',
];

export function isBulletTerm(termType: TermType | string | null | undefined): boolean {
  return termType === 'bullet';
}

export type LoanCalculationInput = {
  principal: number;
  interestType?: InterestType | string;
  interestRate?: number;
  tenure: number;
  frequency?: string;
  startDate?: Date | string;
  dueDay?: number | null;
  /** Defaults to 'scheduled' — the shape every existing loan has. */
  termType?: TermType | string | null;
  /** `bullet` only: days from the start date to the single due date. */
  termDays?: number | null;
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
  /** interest_only: one month's interest — the amount of every scheduled due. */
  monthlyInterest?: number;
  /** interest_only: the monthly rate annualised (2.5%/month → 30% APR). */
  aprPercent?: number;
  /** interest_only: the bullet principal settled at closure, outside the schedule. */
  principalDueAtClosure?: number;
  /** bullet: the single due date, i.e. start + termDays. */
  maturityDate?: Date;
  /**
   * bullet: what the charge costs the borrower, annualised on the cash they
   * actually received. A fee taken at the door is funded by the borrower out of a
   * smaller advance, so the same rupees cost more than the same fee added at the
   * end — a difference the quoted percentage hides over a short term.
   */
  effectiveAnnualPercent?: number;
};

/**
 * Interest-Only (Check/Gold Base): monthly dues are interest only and the principal
 * is a bullet repaid at closure. Callers branch on this in several places — schedule
 * shape, loan auto-close and outstanding-principal math all differ — so the check
 * lives here rather than being restated as a string literal.
 */
export function isInterestOnly(interestType: InterestType | string | null | undefined): boolean {
  return interestType === 'interest_only';
}

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
  // Interest-Only quotes a rate per MONTH, so a non-monthly schedule has no
  // defined due amount. Reject rather than silently bill a monthly figure daily.
  if (isInterestOnly(interestType) && frequency !== 'monthly') {
    throw new Error('Interest-Only loans must use a monthly frequency.');
  }

  const termType = input.termType || 'scheduled';
  const termDays = Number(input.termDays ?? 0);
  if (isBulletTerm(termType)) {
    if (!Number.isInteger(termDays) || termDays <= 0) {
      throw new Error('A bullet loan needs a whole number of days to maturity.');
    }
    if (tenure !== 1) {
      throw new Error('A bullet loan is settled in one payment, so its tenure must be 1.');
    }
    if (!BULLET_INTEREST_TYPES.includes(String(interestType))) {
      throw new Error(
        `A bullet loan cannot use ${interestType}. Use ${BULLET_INTEREST_TYPES.join(', ')}.`,
      );
    }
  }

  let disbursedAmount = principal;
  let totalPayable = principal;
  let deduction = 0;
  let monthlyInterest = 0;

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
    case 'interest_only': {
      // `rate` is a MONTHLY percentage of the principal. The principal itself is a
      // bullet settled at closure and is NOT part of the schedule, so nothing is
      // netted off at disbursal — the customer receives the full principal.
      monthlyInterest = Math.round(principal * (rate / 100));
      deduction = 0;
      disbursedAmount = principal;
      totalPayable = principal + monthlyInterest * tenure;
      break;
    }
    default:
      disbursedAmount = principal;
      totalPayable = principal;
  }

  // Interest-Only bills the same interest every month, so the schedule is flat and
  // sums to the INTEREST only. Every other model spreads `totalPayable` across the
  // rows (last one absorbing the rounding remainder), so for those
  // sum(schedule) === totalPayable — an invariant Interest-Only deliberately breaks
  // because the principal is collected outside the schedule at closure.
  const amounts = isInterestOnly(interestType)
    ? Array.from({ length: tenure }, () => monthlyInterest)
    : distributeInstalmentAmounts(totalPayable, tenure);
  const perInstalment = amounts[0] ?? 0;
  // A bullet term has one row on a date measured in days, so it borrows
  // calculateEndDate's day arithmetic rather than the cadence generator — which
  // counts instalments and has no notion of "in 15 days".
  const dates = isBulletTerm(termType)
    ? [calculateEndDate(startDate, 'daily', termDays)]
    : calculateInstalmentDates(startDate, frequency, tenure, input.dueDay);

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
    ...(isInterestOnly(interestType)
      ? {
          monthlyInterest,
          aprPercent: rate * MONTHS_PER_YEAR,
          principalDueAtClosure: principal,
        }
      : {}),
    ...(isBulletTerm(termType)
      ? {
          maturityDate: dates[0],
          effectiveAnnualPercent:
            disbursedAmount > 0
              ? Math.round(
                  ((totalPayable - disbursedAmount) / disbursedAmount)
                    * (DAYS_PER_YEAR / termDays)
                    * 100
                    * 100,
                ) / 100
              : 0,
        }
      : {}),
  };
}
