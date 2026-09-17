/**
 * Pledge interest math (gold/silver) — pure + tested. Reuses the existing loan,
 * adding interest-only pledge servicing semantics on top (no new engine).
 *
 * Competitor behaviour (N-GOLD LOAN): monthly interest %, and a PARTIAL month is
 * billed as a FULL month ("1 month interest for 23 days"). The rounding rule is
 * configurable (full | prorated) so admins can change it in settings.
 */

export type PartialMonthRule = 'full' | 'prorated';

export type InterestPeriod = {
  months: number;       // whole months elapsed
  extraDays: number;    // leftover days after whole months
  monthsCharged: number; // billable months after applying the rule
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole months + leftover days between two dates (calendar-month aware). */
export function elapsedMonthsDays(from: Date, to: Date): { months: number; extraDays: number } {
  if (to.getTime() <= from.getTime()) return { months: 0, extraDays: 0 };
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Anchor the month boundary on `from`'s day-of-month.
  const anchor = new Date(from);
  anchor.setMonth(from.getMonth() + months);
  if (anchor.getTime() > to.getTime()) {
    months -= 1;
    anchor.setMonth(anchor.getMonth() - 1);
  }
  const extraDays = Math.floor((to.getTime() - anchor.getTime()) / DAY_MS);
  return { months: Math.max(months, 0), extraDays: Math.max(extraDays, 0) };
}

/** Billable months for the period under the partial-month rule. */
export function billableMonths(from: Date, to: Date, rule: PartialMonthRule = 'full'): InterestPeriod {
  const { months, extraDays } = elapsedMonthsDays(from, to);
  let monthsCharged: number;
  if (rule === 'prorated') {
    monthsCharged = months + extraDays / 30;
  } else {
    // Full-month minimum: any leftover day → +1 month. A brand-new pledge
    // (0 months, 0 days) still owes its first month.
    monthsCharged = months + (extraDays > 0 || months === 0 ? 1 : 0);
  }
  return { months, extraDays, monthsCharged };
}

export type PledgeInterestResult = {
  months: number;
  extraDays: number;
  monthsCharged: number;
  monthlyInterest: number;
  interestDue: number;
};

/** Interest due on a pledge from `from`→`to` at `ratePercentPerMonth`. */
export function pledgeInterestDue(
  principal: number,
  ratePercentPerMonth: number,
  from: Date,
  to: Date,
  rule: PartialMonthRule = 'full',
): PledgeInterestResult {
  const p = Math.max(principal || 0, 0);
  const rate = Math.max(ratePercentPerMonth || 0, 0);
  const monthlyInterest = Math.round((p * rate) / 100);
  const period = billableMonths(from, to, rule);
  const interestDue = Math.round(monthlyInterest * period.monthsCharged);
  return {
    months: period.months,
    extraDays: period.extraDays,
    monthsCharged: period.monthsCharged,
    monthlyInterest,
    interestDue,
  };
}

/** Apply a part-payment to the principal (never below 0). */
export function applyPartPayment(outstandingPrincipal: number, payment: number): number {
  const next = Math.max(outstandingPrincipal || 0, 0) - Math.max(payment || 0, 0);
  return next > 0 ? next : 0;
}

/** Final redemption amount = outstanding principal + interest due (+ optional penalty). */
export function redemptionAmount(
  outstandingPrincipal: number,
  interestDue: number,
  penalty = 0,
): number {
  return Math.max(outstandingPrincipal || 0, 0) + Math.max(interestDue || 0, 0) + Math.max(penalty || 0, 0);
}
