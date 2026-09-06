import { expect, test } from '@playwright/test';
import {
  pledgeInterestDue,
  billableMonths,
  elapsedMonthsDays,
  applyPartPayment,
  redemptionAmount,
} from '../../../lib/gold/pledgeInterest';
import {
  computeServicing,
  monthsCoveredByPayment,
  advanceByMonths,
} from '../../../lib/gold/servicing';

/**
 * Pledge interest, servicing and part payment.
 *
 * The billing convention this mirrors is the trade one: interest is quoted per
 * MONTH, and under the default rule a partial month is billed as a full month —
 * "one month's interest for 23 days". The rule is configurable, so the prorated
 * cases assert the other half of that setting rather than assuming one answer.
 *
 * Reference pledge: ₹200000 outstanding at 2% a month → ₹4000 a month.
 */

const PRINCIPAL = 200_000;
const RATE = 2;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// ── Full-month rule ─────────────────────────────────────────────────────────
test('[GL-160] A partial month is billed as a full month', () => {
  const r = pledgeInterestDue(PRINCIPAL, RATE, d('2026-01-01'), d('2026-01-24'), 'full');
  expect(r.months).toBe(0);
  expect(r.extraDays).toBe(23);
  expect(r.monthsCharged, 'one month for 23 days').toBe(1);
  expect(r.interestDue).toBe(4_000);
});

test('[GL-161] A brand-new pledge still owes its first month', () => {
  const r = pledgeInterestDue(PRINCIPAL, RATE, d('2026-01-01'), d('2026-01-01'), 'full');
  expect(r.months).toBe(0);
  expect(r.extraDays).toBe(0);
  expect(r.monthsCharged, 'the first month is earned the day the metal is taken in').toBe(1);
  expect(r.interestDue).toBe(4_000);
});

test('[GL-162] Exact whole months are not rounded up', () => {
  const r = pledgeInterestDue(PRINCIPAL, RATE, d('2026-01-01'), d('2026-03-01'), 'full');
  expect(r.months).toBe(2);
  expect(r.extraDays).toBe(0);
  expect(r.monthsCharged, 'nobody pays a third month for a two-month pledge').toBe(2);
  expect(r.interestDue).toBe(8_000);
});

test('[GL-163] Whole months plus a day bills the extra month', () => {
  const r = pledgeInterestDue(PRINCIPAL, RATE, d('2026-01-01'), d('2026-03-02'), 'full');
  expect(r.months).toBe(2);
  expect(r.extraDays).toBe(1);
  expect(r.monthsCharged).toBe(3);
  expect(r.interestDue).toBe(12_000);
});

test('[GL-164] The month boundary is anchored on the pledge day, not the calendar', () => {
  const short = elapsedMonthsDays(d('2026-01-15'), d('2026-02-14'));
  expect(short, 'one day short of a month is not a month').toEqual({ months: 0, extraDays: 30 });

  const exact = elapsedMonthsDays(d('2026-01-15'), d('2026-02-15'));
  expect(exact, 'a pledge taken mid-month runs mid-month to mid-month').toEqual({ months: 1, extraDays: 0 });
});

test('[GL-165] A month-end pledge does not gain or lose a month in February', () => {
  const toFebEnd = elapsedMonthsDays(d('2026-01-31'), d('2026-02-28'));
  expect(toFebEnd.months, 'a short month does not silently complete a month early').toBe(0);
  expect(
    toFebEnd.extraDays,
    'elapsedMonthsDays walks its anchor with setMonth, which overflows a short month: Jan 31 + 1 month lands on Mar 3, the walk-back then lands on Feb 3, and the pledge is measured from the 3rd rather than from the day the metal came in',
  ).toBe(28);

  const toMarch = elapsedMonthsDays(d('2026-01-31'), d('2026-03-01'));
  expect(toMarch.months + (toMarch.extraDays > 0 ? 1 : 0), 'and the period is still billed once').toBe(1);
});

test('[GL-166] A backwards period charges nothing rather than throwing', () => {
  const r = elapsedMonthsDays(d('2026-03-01'), d('2026-01-01'));
  expect(r, 'a clock skew never produces a negative period').toEqual({ months: 0, extraDays: 0 });
});

test('[GL-167] The monthly interest is the rate applied to the principal', () => {
  expect(pledgeInterestDue(PRINCIPAL, 2, d('2026-01-01'), d('2026-02-01')).monthlyInterest).toBe(4_000);
  expect(pledgeInterestDue(PRINCIPAL, 0, d('2026-01-01'), d('2026-02-01')).monthlyInterest).toBe(0);
  expect(
    pledgeInterestDue(PRINCIPAL, 1.5, d('2026-01-01'), d('2026-02-01')).monthlyInterest,
    'the rate is per month, not per annum',
  ).toBe(3_000);
});

test('[GL-168] A zero or negative principal owes no interest', () => {
  for (const principal of [0, -PRINCIPAL]) {
    const r = pledgeInterestDue(principal, RATE, d('2026-01-01'), d('2026-03-01'));
    expect(r.monthlyInterest, `principal ${principal}`).toBe(0);
    expect(r.interestDue).toBe(0);
  }
});

test('[GL-169] Interest is quoted in whole rupees', () => {
  const r = pledgeInterestDue(123_457, 1.75, d('2026-01-01'), d('2026-02-10'));
  expect(Number.isInteger(r.monthlyInterest)).toBe(true);
  expect(Number.isInteger(r.interestDue)).toBe(true);
});

// ── Prorated rule ───────────────────────────────────────────────────────────
test('[GL-180] Prorated billing charges the part month as a fraction', () => {
  const r = pledgeInterestDue(PRINCIPAL, RATE, d('2026-01-01'), d('2026-03-16'), 'prorated');
  expect(r.months).toBe(2);
  expect(r.extraDays).toBe(15);
  expect(r.monthsCharged, 'two months and half of a third').toBe(2.5);
  expect(r.interestDue).toBe(10_000);
});

test('[GL-181] The two rules disagree by design, and the setting decides which applies', () => {
  const from = d('2026-01-01');
  const to = d('2026-01-24');

  expect(billableMonths(from, to, 'full').monthsCharged, 'a whole month for 23 days').toBe(1);
  expect(
    billableMonths(from, to, 'prorated').monthsCharged,
    'or 23 thirtieths of one — an admin changes this, not a developer',
  ).toBeCloseTo(23 / 30, 6);
});

test('[GL-182] A prorated brand-new pledge owes nothing yet', () => {
  const r = pledgeInterestDue(PRINCIPAL, RATE, d('2026-01-01'), d('2026-01-01'), 'prorated');
  expect(r.monthsCharged, 'proration earns interest only as time passes').toBe(0);
  expect(r.interestDue).toBe(0);
});

test('[GL-183] Proration uses a thirty-day month', () => {
  expect(billableMonths(d('2026-01-01'), d('2026-01-16'), 'prorated').monthsCharged).toBeCloseTo(0.5, 6);
  expect(billableMonths(d('2026-01-01'), d('2026-01-31'), 'prorated').monthsCharged).toBeCloseTo(1, 6);
});

test('[GL-184] The prorated total is still rounded to whole rupees', () => {
  const r = pledgeInterestDue(123_457, 1.75, d('2026-01-01'), d('2026-02-11'), 'prorated');
  expect(Number.isInteger(r.interestDue)).toBe(true);
});

// ── Servicing ───────────────────────────────────────────────────────────────
test('[GL-200] The servicing summary reports what the pledge owes right now', () => {
  const s = computeServicing({
    outstandingPrincipal: PRINCIPAL,
    monthlyRatePercent: RATE,
    interestPaidUpto: d('2026-01-01'),
    now: d('2026-01-24'),
  });

  expect(s.monthlyInterest).toBe(4_000);
  expect(s.months).toBe(0);
  expect(s.extraDays).toBe(23);
  expect(s.monthsDue).toBe(1);
  expect(s.interestDue).toBe(4_000);
  expect(s.redemptionAmount).toBe(204_000);
});

test('[GL-201] The redemption amount is principal plus interest plus penalty', () => {
  const s = computeServicing({
    outstandingPrincipal: PRINCIPAL,
    monthlyRatePercent: RATE,
    interestPaidUpto: d('2026-01-01'),
    now: d('2026-01-24'),
    penalty: 1_500,
  });

  expect(s.redemptionAmount).toBe(205_500);
  expect(
    [s.outstandingPrincipal, s.interestDue],
    'each head is reported separately as well as summed',
  ).toEqual([PRINCIPAL, 4_000]);
});

test('[GL-202] A negative penalty or principal never reduces the redemption below its parts', () => {
  const negativePenalty = computeServicing({
    outstandingPrincipal: PRINCIPAL,
    monthlyRatePercent: RATE,
    interestPaidUpto: d('2026-01-01'),
    now: d('2026-01-24'),
    penalty: -5_000,
  });
  expect(negativePenalty.redemptionAmount, 'a quote cannot be talked down by a negative input').toBe(204_000);

  expect(redemptionAmount(-1_000, 4_000, 0), 'each part is floored at zero').toBe(4_000);
});

test('[GL-204] An interest payment covers whole and fractional months', () => {
  expect(monthsCoveredByPayment(12_000, 4_000)).toBe(3);
  expect(monthsCoveredByPayment(6_000, 4_000)).toBe(1.5);
});

test('[GL-205] A payment against a zero monthly interest covers nothing', () => {
  expect(monthsCoveredByPayment(12_000, 0), 'no division by zero').toBe(0);
});

test('[GL-206] The interest-paid-upto date advances by the months a payment covered', () => {
  expect(advanceByMonths(d('2026-01-01'), 1).toISOString().slice(0, 10)).toBe('2026-02-01');
  expect(
    advanceByMonths(d('2026-01-01'), 1.5).toISOString().slice(0, 10),
    'a fractional month advances by roughly thirty days',
  ).toBe('2026-02-16');
});

test('[GL-207] Advancing a month-end date does not skip a month', () => {
  const advanced = advanceByMonths(d('2026-01-31'), 1).toISOString().slice(0, 10);
  expect(
    advanced,
    `advanceByMonths uses setMonth with no day clamping, so 31 January + 1 month overflows to ${advanced}. A pledge anchored to a month end loses February every year it runs, and the borrower is billed from the wrong date`,
  ).toBe('2026-02-28');
});

// ── Part payment ────────────────────────────────────────────────────────────
test('[GL-220] A part payment reduces the outstanding principal', () => {
  expect(applyPartPayment(PRINCIPAL, 50_000)).toBe(150_000);
});

test('[GL-221] A part payment never drives the principal below zero', () => {
  expect(applyPartPayment(PRINCIPAL, 250_000), 'never −50000').toBe(0);
});

test('[GL-222] A zero or negative part payment changes nothing', () => {
  expect(applyPartPayment(PRINCIPAL, 0)).toBe(PRINCIPAL);
  expect(applyPartPayment(PRINCIPAL, -50_000)).toBe(PRINCIPAL);
});
