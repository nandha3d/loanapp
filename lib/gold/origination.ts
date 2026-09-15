export type GoldRepaymentModel = 'bullet' | 'amortizing';

export type GoldOriginationInput = {
  assessedValue: number;
  requestedPrincipal: number;
  totalPayableAtMaturity: number;
  repaymentModel: GoldRepaymentModel;
  requestedLtvPercent?: number | null;
  borrowerExistingConsumptionExposure?: number;
};

export type GoldOriginationValidation = {
  maximumLtvPercent: number;
  appliedLtvPercent: number;
  borrowerConsumptionExposure: number;
  exposureForLtv: number;
  eligibleAmount: number;
};

function money(value: number, label: string): number {
  const resolved = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return resolved;
}

/** RBI 2025 consumption-loan tiers, effective no later than 1 April 2026. */
export function maximumConsumptionLtvPercent(totalConsumptionLoanAmount: number): number {
  const amount = money(totalConsumptionLoanAmount, 'Consumption loan amount');
  if (amount <= 250_000) return 85;
  if (amount <= 500_000) return 80;
  return 75;
}

/**
 * Enforces the sanction-time gold/silver LTV. For bullet products, both the
 * tier and LTV numerator use total repayable at maturity, not principal alone.
 */
export function validateGoldOrigination(input: GoldOriginationInput): GoldOriginationValidation {
  const assessedValue = money(input.assessedValue, 'Assessed collateral value');
  const principal = money(input.requestedPrincipal, 'Requested principal');
  const totalPayable = money(input.totalPayableAtMaturity, 'Total payable at maturity');
  const existingExposure = Math.max(0, Number(input.borrowerExistingConsumptionExposure ?? 0));
  if (!Number.isFinite(existingExposure)) throw new Error('Existing consumption exposure is invalid.');

  const exposureForLtv = input.repaymentModel === 'bullet' ? totalPayable : principal;
  const borrowerConsumptionExposure = Math.round((existingExposure + exposureForLtv) * 100) / 100;
  const maximumLtvPercent = maximumConsumptionLtvPercent(borrowerConsumptionExposure);
  const requestedLtv = input.requestedLtvPercent == null
    ? maximumLtvPercent
    : Number(input.requestedLtvPercent);
  if (!Number.isFinite(requestedLtv) || requestedLtv <= 0) {
    throw new Error('Eligible LTV percent must be greater than zero.');
  }
  const appliedLtvPercent = Math.min(requestedLtv, maximumLtvPercent);
  const eligibleAmount = Math.floor((assessedValue * appliedLtvPercent) / 100 * 100) / 100;

  if (exposureForLtv > eligibleAmount) {
    throw new Error(
      `Loan exposure ${exposureForLtv.toFixed(2)} exceeds the eligible collateral amount ${eligibleAmount.toFixed(2)}.`,
    );
  }

  return {
    maximumLtvPercent,
    appliedLtvPercent,
    borrowerConsumptionExposure,
    exposureForLtv,
    eligibleAmount,
  };
}
