/**
 * Hire-Purchase (HP) quoting for the Auto Finance module.
 *
 * Kept free of Prisma and React so the origination wizard, the EMI calculator
 * widget and the mobile API can all share one source of truth — and so it can
 * be unit-tested without a database.
 */

export type InterestMethod = 'flat' | 'diminishing';

export type HpQuoteInput = {
  /** On-road / agreed value of the vehicle. */
  vehicleValue: number;
  /** Customer's own contribution. */
  downPayment: number;
  /** Additional cash/insurance/RTO advance financed under the same contract. */
  additionalFinancedAmount?: number;
  /** Annual interest rate in percent. */
  interestRate: number;
  /** 'flat' charges interest on the full principal for the whole tenure. */
  interestMethod: InterestMethod;
  /** Number of monthly instalments. */
  tenureMonths: number;
  /** Round every instalment to a whole rupee instead of trailing a remainder. */
  roundOffEmi?: boolean;
};

export type HpScheduleRow = {
  instalmentNo: number;
  /** Portion of this instalment that reduces the principal. */
  principalComponent: number;
  /** Portion of this instalment that is finance charge. */
  interestComponent: number;
  dueAmount: number;
  /** Principal still outstanding after this instalment is paid. */
  balance: number;
};

export type HpQuote = {
  /** Amount financed (vehicle balance plus any additional contractual advance). */
  principal: number;
  totalInterest: number;
  totalPayable: number;
  /** The headline EMI shown to the customer. */
  emi: number;
  schedule: HpScheduleRow[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Distributes a rounding remainder onto the final instalment so the schedule
 * always sums exactly to `totalPayable`.
 */
function settleRemainder(rows: HpScheduleRow[], totalPayable: number): void {
  if (rows.length === 0) return;
  const summed = rows.reduce((sum, row) => sum + row.dueAmount, 0);
  const drift = round2(totalPayable - summed);
  if (drift === 0) return;
  const last = rows[rows.length - 1];
  last.dueAmount = round2(last.dueAmount + drift);
  last.principalComponent = round2(last.principalComponent + drift);
}

export function calculateHpQuote(input: HpQuoteInput): HpQuote {
  const vehicleValue = Number(input.vehicleValue);
  const downPayment = Number(input.downPayment ?? 0);
  const additionalFinancedAmount = Number(input.additionalFinancedAmount ?? 0);
  const rate = Number(input.interestRate ?? 0);
  const tenure = Number(input.tenureMonths);
  const method: InterestMethod = input.interestMethod === 'diminishing' ? 'diminishing' : 'flat';

  if (!Number.isFinite(vehicleValue) || vehicleValue <= 0) {
    throw new Error('Vehicle value must be greater than zero.');
  }
  if (!Number.isFinite(downPayment) || downPayment < 0) {
    throw new Error('Down payment cannot be negative.');
  }
  if (downPayment >= vehicleValue) {
    throw new Error('Down payment must be less than the vehicle value.');
  }
  if (!Number.isFinite(additionalFinancedAmount) || additionalFinancedAmount < 0) {
    throw new Error('Additional financed amount cannot be negative.');
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('Interest rate cannot be negative.');
  }
  if (!Number.isInteger(tenure) || tenure <= 0) {
    throw new Error('Tenure must be a positive whole number of months.');
  }

  const principal = round2(vehicleValue - downPayment + additionalFinancedAmount);
  const schedule: HpScheduleRow[] = [];

  let emi: number;
  let totalPayable: number;
  let totalInterest: number;

  if (method === 'flat') {
    // Flat: interest accrues on the full principal for the whole tenure.
    totalInterest = round2(principal * (rate / 100) * (tenure / 12));
    totalPayable = round2(principal + totalInterest);
    emi = input.roundOffEmi
      ? Math.round(totalPayable / tenure)
      : round2(totalPayable / tenure);

    // Rounding the EMI changes what the customer actually repays.
    if (input.roundOffEmi) {
      totalPayable = round2(emi * tenure);
      totalInterest = round2(totalPayable - principal);
    }

    const principalPerMonth = round2(principal / tenure);
    const interestPerMonth = round2(totalInterest / tenure);
    let balance = principal;
    for (let i = 1; i <= tenure; i++) {
      balance = round2(Math.max(0, balance - principalPerMonth));
      schedule.push({
        instalmentNo: i,
        principalComponent: principalPerMonth,
        interestComponent: interestPerMonth,
        dueAmount: emi,
        balance,
      });
    }
  } else {
    // Diminishing: interest is charged on the reducing balance each month.
    const monthlyRate = rate / 100 / 12;
    if (monthlyRate === 0) {
      emi = input.roundOffEmi ? Math.round(principal / tenure) : round2(principal / tenure);
    } else {
      const factor = Math.pow(1 + monthlyRate, tenure);
      const raw = (principal * monthlyRate * factor) / (factor - 1);
      emi = input.roundOffEmi ? Math.round(raw) : round2(raw);
    }

    let balance = principal;
    for (let i = 1; i <= tenure; i++) {
      const interestComponent = round2(balance * monthlyRate);
      // The final instalment clears whatever principal is left.
      const principalComponent = i === tenure
        ? round2(balance)
        : round2(Math.min(balance, emi - interestComponent));
      const dueAmount = i === tenure
        ? round2(principalComponent + interestComponent)
        : emi;
      balance = round2(Math.max(0, balance - principalComponent));
      schedule.push({ instalmentNo: i, principalComponent, interestComponent, dueAmount, balance });
    }

    totalPayable = round2(schedule.reduce((sum, row) => sum + row.dueAmount, 0));
    totalInterest = round2(totalPayable - principal);
  }

  settleRemainder(schedule, totalPayable);

  return { principal, totalInterest, totalPayable, emi, schedule };
}

/**
 * Total cash the office must hand out at disbursement: the financed amount
 * plus any hand-loan style advances, less the charges recovered up front.
 */
export function calculateHpDisbursement(input: {
  principal: number;
  handLoanAmount?: number;
  insuranceCharge?: number;
  documentCharge?: number;
  brokerCommission?: number;
}): { grossPayout: number; recoveredCharges: number; netPayout: number } {
  const principal = Number(input.principal) || 0;
  const handLoan = Number(input.handLoanAmount) || 0;
  const recoveredCharges = round2(
    (Number(input.insuranceCharge) || 0)
    + (Number(input.documentCharge) || 0)
    + (Number(input.brokerCommission) || 0),
  );
  const grossPayout = round2(principal + handLoan);
  return {
    grossPayout,
    recoveredCharges,
    netPayout: round2(grossPayout - recoveredCharges),
  };
}

/**
 * Validates the two-mode payment splitter on the origination wizard: the split
 * must add up to the payout, or be left empty entirely.
 */
export function validatePayoutSplit(
  payout: number,
  amount1: number | null | undefined,
  amount2: number | null | undefined,
): { valid: boolean; message?: string } {
  const a1 = Number(amount1) || 0;
  const a2 = Number(amount2) || 0;
  if (a1 === 0 && a2 === 0) return { valid: true };
  const total = round2(a1 + a2);
  if (Math.abs(total - round2(payout)) > 0.01) {
    return {
      valid: false,
      message: `Payment split (${total}) does not match the payout amount (${round2(payout)}).`,
    };
  }
  return { valid: true };
}
