/**
 * Interest-Only (Check/Gold Base) loan servicing — pure, no Prisma.
 *
 * The model: the customer receives the full principal, pays one month's interest on
 * a fixed day each month, and repays the principal as a lump sum whenever they close.
 * So the instalment schedule carries INTEREST ONLY and the principal sits outside it
 * in Loan.outstandingPrincipal — which is why the usual
 * `principal − totalCollected` outstanding rule does not apply here.
 *
 * Interest math is shared with gold pledges (lib/gold/pledgeInterest.ts): both are
 * monthly-rate interest-only products.
 */

import { getInstalmentOutstanding } from './repayments';

type MoneyLike = number | string | { toNumber(): number };

function toNumber(value: MoneyLike | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber();
}

/** One month's interest on `principal` at a monthly percentage rate. */
export function monthlyInterestFor(principal: number, monthlyRatePercent: number): number {
  return Math.round(Math.max(principal, 0) * (Math.max(monthlyRatePercent, 0) / 100));
}

/** A monthly rate quoted as an annual one — 2.5%/month → 30% APR. */
export function toAprPercent(monthlyRatePercent: number): number {
  return monthlyRatePercent * 12;
}

export type InterestOnlyLoanSnapshot = {
  id: string;
  loanCode: string;
  status: string;
  principal: MoneyLike;
  interestRate?: MoneyLike | null;
  outstandingPrincipal?: MoneyLike | null;
  instalments: Array<{
    status: string;
    dueAmount: MoneyLike;
    receivedAmount: MoneyLike;
  }>;
};

export type InterestOnlySummary = {
  loanId: string;
  loanCode: string;
  status: string;
  originalPrincipal: number;
  outstandingPrincipal: number;
  monthlyRatePercent: number;
  aprPercent: number;
  monthlyInterest: number;
  interestCollected: number;
  /** Interest already billed but not yet received (missed + partial dues). */
  interestDueNow: number;
  paidInstalments: number;
  upcomingInstalments: number;
  /** What the customer must hand over to close today. */
  totalDueToClose: number;
};

export function summarizeInterestOnlyLoan(loan: InterestOnlyLoanSnapshot): InterestOnlySummary {
  const originalPrincipal = toNumber(loan.principal);
  // Null outstanding means the loan predates servicing (or was never part-paid),
  // so the full principal is still owed.
  const outstandingPrincipal = Math.max(
    0,
    loan.outstandingPrincipal == null ? originalPrincipal : toNumber(loan.outstandingPrincipal),
  );
  const monthlyRatePercent = toNumber(loan.interestRate);

  const interestCollected = loan.instalments.reduce(
    (sum, i) => sum + toNumber(i.receivedAmount),
    0,
  );
  // Only dues that have already come around count towards a closure — an upcoming
  // month's interest hasn't been earned yet and must not be charged on exit.
  const interestDueNow = loan.instalments
    .filter((i) => i.status === 'missed' || i.status === 'partial')
    .reduce(
      (sum, i) =>
        sum +
        getInstalmentOutstanding({
          dueAmount: toNumber(i.dueAmount),
          receivedAmount: toNumber(i.receivedAmount),
        }),
      0,
    );

  return {
    loanId: loan.id,
    loanCode: loan.loanCode,
    status: loan.status,
    originalPrincipal,
    outstandingPrincipal,
    monthlyRatePercent,
    aprPercent: toAprPercent(monthlyRatePercent),
    monthlyInterest: monthlyInterestFor(outstandingPrincipal, monthlyRatePercent),
    interestCollected,
    interestDueNow,
    paidInstalments: loan.instalments.filter((i) => i.status === 'paid').length,
    upcomingInstalments: loan.instalments.filter((i) => i.status === 'upcoming').length,
    totalDueToClose: outstandingPrincipal + interestDueNow,
  };
}
