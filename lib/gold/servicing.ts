import { pledgeInterestDue, redemptionAmount, type PartialMonthRule } from '@/lib/gold/pledgeInterest';

/**
 * Pledge servicing summary — pure, reuses the 3a interest math. Computes what a
 * pledge owes right now so the API/UI never recompute money logic ad-hoc.
 */

export type ServicingInput = {
  outstandingPrincipal: number;
  monthlyRatePercent: number;
  interestPaidUpto: Date;
  now: Date;
  rule?: PartialMonthRule;
  penalty?: number;
};

export type ServicingSummary = {
  outstandingPrincipal: number;
  monthlyInterest: number;
  months: number;
  extraDays: number;
  monthsDue: number;
  interestDue: number;
  redemptionAmount: number;
};

export function computeServicing(input: ServicingInput): ServicingSummary {
  const r = pledgeInterestDue(
    input.outstandingPrincipal,
    input.monthlyRatePercent,
    input.interestPaidUpto,
    input.now,
    input.rule ?? 'full',
  );
  return {
    outstandingPrincipal: Math.max(input.outstandingPrincipal || 0, 0),
    monthlyInterest: r.monthlyInterest,
    months: r.months,
    extraDays: r.extraDays,
    monthsDue: r.monthsCharged,
    interestDue: r.interestDue,
    redemptionAmount: redemptionAmount(input.outstandingPrincipal, r.interestDue, input.penalty ?? 0),
  };
}

/** How many months an interest payment of `amount` covers. */
export function monthsCoveredByPayment(amount: number, monthlyInterest: number): number {
  if (!(monthlyInterest > 0)) return 0;
  return Math.max(amount || 0, 0) / monthlyInterest;
}

/** Advance a date by a (possibly fractional) number of months (~30d/month). */
export function advanceByMonths(from: Date, months: number): Date {
  const whole = Math.floor(months);
  const fracDays = Math.round((months - whole) * 30);
  const d = new Date(from);
  d.setMonth(d.getMonth() + whole);
  d.setDate(d.getDate() + fracDays);
  return d;
}
