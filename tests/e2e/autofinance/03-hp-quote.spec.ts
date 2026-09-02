import { expect, test } from '@playwright/test';
import { calculateHpQuote, calculateHpDisbursement, validatePayoutSplit } from '../../../lib/autofinance/hp';
import { buildHpOriginationTerms } from '../../../lib/autofinance/origination';

/**
 * The hire-purchase quote, its payout and its due dates.
 *
 * These import the calculator directly rather than driving it through the API:
 * it is deliberately free of Prisma and React so the wizard, the EMI widget and
 * the mobile route can share one source of truth, and testing it in isolation
 * is what that design is FOR. The API-level cases that prove the persisted loan
 * carries these same figures live in 04-origination.spec.ts.
 *
 * Reference contract, worked by hand:
 *   vehicleValue 500000, downPayment 100000, rate 12%, flat, 24 months
 *     principal 400000 · interest 96000 · payable 496000 · emi 20666.67
 */

const REF = {
  vehicleValue: 500_000,
  downPayment: 100_000,
  interestRate: 12,
  tenureMonths: 24,
} as const;

const flat = (over: Record<string, unknown> = {}) =>
  calculateHpQuote({ ...REF, interestMethod: 'flat', ...over } as any);

const dim = (over: Record<string, unknown> = {}) =>
  calculateHpQuote({ ...REF, interestMethod: 'diminishing', ...over } as any);

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The origination terms for the reference contract, with dates. */
const terms = (over: Record<string, unknown> = {}) =>
  buildHpOriginationTerms({
    vehicleValue: REF.vehicleValue,
    downPayment: REF.downPayment,
    interestRate: REF.interestRate,
    interestMethod: 'flat',
    tenureMonths: REF.tenureMonths,
    startDate: '2026-01-15',
    ...over,
  } as any);

// ── Flat ────────────────────────────────────────────────────────────────────
test('[AUTO-070] The reference flat quote produces the worked figures', () => {
  const q = flat();
  expect(q.principal).toBe(400_000);
  expect(q.totalInterest).toBe(96_000);
  expect(q.totalPayable).toBe(496_000);
  expect(q.emi).toBe(20_666.67);
  expect(q.schedule).toHaveLength(24);
});

test('[AUTO-071] Flat interest is charged on the whole principal for the whole tenure', () => {
  expect(flat({ tenureMonths: 12 }).totalInterest, '400000 × 12% × 1 year').toBe(48_000);
  expect(flat({ tenureMonths: 24 }).totalInterest, '× 2 years').toBe(96_000);
  expect(flat({ tenureMonths: 36 }).totalInterest, '× 3 years').toBe(144_000);
});

test('[AUTO-072] Every flat instalment carries the same principal and interest split', () => {
  const rows = flat().schedule;
  for (const row of rows.slice(0, -1)) {
    expect(row.principalComponent, `row ${row.instalmentNo}`).toBe(16_666.67);
    expect(row.interestComponent, `row ${row.instalmentNo}`).toBe(4_000);
    expect(row.dueAmount).toBe(20_666.67);
  }
  const last = rows[rows.length - 1];
  expect(last.interestComponent, 'the rounding lands on principal, not on the finance charge').toBe(4_000);
});

test('[AUTO-073] The schedule sums exactly to totalPayable', () => {
  const q = flat();
  expect(sum(q.schedule.map((r) => r.dueAmount))).toBe(q.totalPayable);
  expect(
    q.schedule[q.schedule.length - 1].dueAmount,
    'the −0.08 drift is settled on the final instalment, not spread',
  ).toBe(20_666.59);
});

test('[AUTO-074] roundOffEmi changes what the customer actually repays', () => {
  const q = flat({ roundOffEmi: true });
  expect(q.emi).toBe(20_667);
  expect(q.totalPayable, 'restated from the rounded EMI').toBe(496_008);
  expect(q.totalInterest, 'the rounding is charged, not absorbed').toBe(96_008);
});

test('[AUTO-075] A rounded schedule still sums to its own totalPayable', () => {
  const q = flat({ roundOffEmi: true });
  expect(sum(q.schedule.map((r) => r.dueAmount))).toBe(496_008);
  expect(q.schedule.every((r) => r.dueAmount === 20_667), 'no residue on the final row').toBe(true);
});

test('[AUTO-076] The running balance reaches zero on the final instalment', () => {
  const rows = flat().schedule;
  for (let i = 1; i < rows.length; i++) {
    expect(rows[i].balance, `row ${i + 1} is not above row ${i}`).toBeLessThanOrEqual(rows[i - 1].balance);
  }
  expect(rows[rows.length - 1].balance).toBe(0);
});

test('[AUTO-077] A single-instalment flat contract is principal plus one month of interest', () => {
  const q = flat({ tenureMonths: 1 });
  expect(q.totalInterest).toBe(4_000);
  expect(q.emi).toBe(404_000);
  expect(q.schedule).toHaveLength(1);
});

test('[AUTO-078] A zero-rate flat contract repays only the principal', () => {
  const q = flat({ interestRate: 0 });
  expect(q.totalInterest).toBe(0);
  expect(q.totalPayable).toBe(400_000);
  expect(q.emi).toBe(16_666.67);
});

test('[AUTO-079] An additional financed amount is inside the principal, not beside it', () => {
  const q = flat({ additionalFinancedAmount: 50_000 });
  expect(q.principal, 'the advance is financed under the same contract').toBe(450_000);
  expect(q.totalInterest, 'and interest is charged on the whole of it').toBe(108_000);
});

test('[AUTO-080] A fractional vehicle value survives the quote without drift', () => {
  const q = flat({ vehicleValue: 499_999.99, downPayment: 99_999.99 });
  expect(q.principal).toBe(400_000);
});

test('[AUTO-081] A long tenure does not degrade the totals', () => {
  const q = flat({ tenureMonths: 84 });
  expect(q.schedule).toHaveLength(84);
  expect(sum(q.schedule.map((r) => r.dueAmount))).toBe(q.totalPayable);
});

// ── Diminishing ─────────────────────────────────────────────────────────────
test('[AUTO-095] The first interest component is one month on the full principal', () => {
  const rows = dim().schedule;
  expect(rows[0].interestComponent, '400000 × 1% a month').toBe(4_000);
  for (let i = 1; i < rows.length; i++) {
    expect(
      rows[i].interestComponent,
      `row ${i + 1} charges interest on a smaller balance than row ${i}`,
    ).toBeLessThan(rows[i - 1].interestComponent);
  }
});

test('[AUTO-096] Diminishing interest is materially less than flat at the same rate', () => {
  expect(dim().totalInterest).toBeLessThan(flat().totalInterest);
  expect(
    dim().totalInterest,
    'roughly half — the two methods are never interchangeable at the same quoted rate',
  ).toBeLessThan(60_000);
});

test('[AUTO-097] The principal components sum to the principal', () => {
  const q = dim();
  expect(sum(q.schedule.map((r) => r.principalComponent))).toBe(400_000);
});

test('[AUTO-098] The final balance is zero', () => {
  const rows = dim().schedule;
  const last = rows[rows.length - 1];
  expect(last.balance).toBe(0);
  expect(
    last.dueAmount,
    'the final row clears what is left rather than repeating the headline EMI',
  ).toBe(Math.round((last.principalComponent + last.interestComponent) * 100) / 100);
});

test('[AUTO-099] totalInterest is derived from the schedule, not quoted separately', () => {
  const q = dim();
  expect(sum(q.schedule.map((r) => r.interestComponent))).toBeCloseTo(q.totalInterest, 1);
  expect(sum(q.schedule.map((r) => r.dueAmount))).toBe(q.totalPayable);
});

test('[AUTO-100] A zero-rate diminishing contract degenerates to equal principal instalments', () => {
  const q = dim({ interestRate: 0 });
  expect(q.emi, 'no division by zero in the annuity factor').toBe(16_666.67);
  expect(q.schedule.every((r) => r.interestComponent === 0)).toBe(true);
  expect(sum(q.schedule.map((r) => r.principalComponent))).toBe(400_000);
});

test('[AUTO-101] A single-instalment diminishing contract matches the flat one', () => {
  const q = dim({ tenureMonths: 1 });
  expect(q.schedule).toHaveLength(1);
  expect(q.emi, 'the annuity does not blow up at n = 1').toBe(404_000);
});

test('[AUTO-102] roundOffEmi rounds the annuity and the last row absorbs the difference', () => {
  const q = dim({ roundOffEmi: true });
  expect(Number.isInteger(q.emi), 'a whole-rupee EMI').toBe(true);
  expect(sum(q.schedule.map((r) => r.dueAmount))).toBe(q.totalPayable);
});

test('[AUTO-103] A very high rate still produces a payable schedule', () => {
  const q = dim({ interestRate: 48 });
  expect(q.schedule.every((r) => r.dueAmount > 0)).toBe(true);
  expect(q.schedule[q.schedule.length - 1].balance).toBe(0);
});

test('[AUTO-104] The interest component never exceeds the instalment', () => {
  for (const rate of [12, 24, 48]) {
    const q = dim({ interestRate: rate });
    expect(
      q.schedule.every((r) => r.principalComponent >= 0),
      `at ${rate}% every row still reduces the principal`,
    ).toBe(true);
  }
});

// ── Validation ──────────────────────────────────────────────────────────────
const INVALID: Array<{ id: string; title: string; input: Record<string, unknown>; match: RegExp }> = [
  { id: 'AUTO-121', title: 'A negative down payment is refused', input: { downPayment: -1_000 }, match: /down payment cannot be negative/i },
  { id: 'AUTO-123', title: 'A negative rate is refused', input: { interestRate: -5 }, match: /interest rate cannot be negative/i },
];

for (const c of INVALID) {
  test(`[${c.id}] ${c.title}`, () => {
    expect(() => flat(c.input)).toThrow(c.match);
  });
}

test('[AUTO-120] A zero or negative vehicle value is refused', () => {
  for (const vehicleValue of [0, -1]) {
    expect(() => flat({ vehicleValue }), `vehicleValue ${vehicleValue}`).toThrow(
      /vehicle value must be greater than zero/i,
    );
  }
});

test('[AUTO-122] A down payment at or above the vehicle value is refused', () => {
  expect(() => flat({ downPayment: REF.vehicleValue })).toThrow(/less than the vehicle value/i);
  expect(() => flat({ downPayment: REF.vehicleValue + 1 })).toThrow(/less than the vehicle value/i);
});

test('[AUTO-124] Tenure must be a positive whole number of months', () => {
  for (const tenureMonths of [0, -6, 12.5]) {
    expect(() => flat({ tenureMonths }), `tenure ${tenureMonths}`).toThrow(/positive whole number/i);
  }
});

test('[AUTO-125] A negative charge is refused by name', () => {
  expect(() => terms({ insuranceCharge: -1 })).toThrow(/insurance charge cannot be negative/i);
  expect(() => terms({ documentCharge: -1 })).toThrow(/document charge cannot be negative/i);
  expect(() => terms({ brokerCommission: -1 })).toThrow(/broker commission cannot be negative/i);
});

test('[AUTO-126] A negative hand-loan amount is refused', () => {
  expect(() => terms({ handLoanAmount: -5_000 })).toThrow(/hand-loan amount cannot be negative/i);
});

test('[AUTO-127] A non-numeric money field is refused, not coerced to zero', () => {
  expect(
    () => flat({ vehicleValue: 'five lakh' }),
    'a coerced NaN would otherwise schedule a zero-value contract',
  ).toThrow(/vehicle value/i);
});

// ── Payout, charges and legs ────────────────────────────────────────────────
test('[AUTO-145] Charges are recovered from the payout, not added to it', () => {
  const t = terms({ insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000 });
  expect(t.grossPayout).toBe(400_000);
  expect(t.recoveredCharges).toBe(10_000);
  expect(t.netPayout, 'the borrower receives less; they do not owe more').toBe(390_000);
  expect(t.principal, 'the principal is untouched by the charges').toBe(400_000);

  const helper = calculateHpDisbursement({
    principal: 400_000, insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000,
  });
  expect(helper, 'the three figures are reported separately, never as one net number').toEqual({
    grossPayout: 400_000, recoveredCharges: 10_000, netPayout: 390_000,
  });
});

test('[AUTO-146] A hand-loan advance is financed inside the principal and paid out once', () => {
  const t = terms({ handLoanAmount: 50_000, insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000 });
  expect(t.principal).toBe(450_000);
  expect(t.grossPayout, 'never counted twice — once in the principal and again in the payout').toBe(450_000);
  expect(t.netPayout).toBe(440_000);
});

test('[AUTO-147] Charges that swallow the whole payout are refused', () => {
  expect(() => terms({ insuranceCharge: 400_000 })).toThrow(/recovered charges must be less than the gross payout/i);
});

test('[AUTO-148] Two payout legs must sum to the net payout', () => {
  const t = terms({
    insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000,
    payoutMode1: 'cash', payoutAmount1: 200_000,
    payoutMode2: 'bank_transfer', payoutAmount2: 190_000,
  });
  expect(t.payoutLegs).toHaveLength(2);
  expect(t.payoutLegs.map((l) => l.mode)).toEqual(['cash', 'bank_transfer']);
  expect(sum(t.payoutLegs.map((l) => l.amount))).toBe(390_000);
});

test('[AUTO-149] A split that does not add up is refused with both figures', () => {
  expect(() =>
    terms({
      insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000,
      payoutMode1: 'cash', payoutAmount1: 200_000,
      payoutMode2: 'bank', payoutAmount2: 100_000,
    }),
  ).toThrow(/\(300000\).*\(390000\)/);
});

test('[AUTO-150] An empty split defaults to a single cash leg for the whole payout', () => {
  const t = terms({ insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000 });
  expect(t.payoutLegs).toEqual([{ mode: 'cash', amount: 390_000 }]);
  expect(t.cashPayout).toBe(390_000);
  expect(t.nonCashPayout).toBe(0);
});

test('[AUTO-151] A leg with an amount but no mode is refused', () => {
  expect(() => terms({ payoutAmount1: 200_000 })).toThrow(/payout mode 1 is required/i);
});

test('[AUTO-152] An unsupported payout mode is refused', () => {
  expect(() => terms({ payoutMode1: 'crypto', payoutAmount1: 400_000 })).toThrow(/payout mode 1 is not supported/i);
});

test('[AUTO-153] Payout modes are matched case-insensitively and stored lowercase', () => {
  const t = terms({
    insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000,
    payoutMode1: 'CASH', payoutAmount1: 200_000,
    payoutMode2: 'Bank_Transfer', payoutAmount2: 190_000,
  });
  expect(t.payoutLegs.map((l) => l.mode)).toEqual(['cash', 'bank_transfer']);
});

test('[AUTO-154] Only the cash legs count as cash out of the branch pool', () => {
  const t = terms({
    insuranceCharge: 5_000, documentCharge: 2_000, brokerCommission: 3_000,
    payoutMode1: 'cash', payoutAmount1: 200_000,
    payoutMode2: 'bank_transfer', payoutAmount2: 190_000,
  });
  expect(t.cashPayout, 'MONEY-17: the pool falls by the cash leg only').toBe(200_000);
  expect(t.nonCashPayout).toBe(190_000);
});

test('[AUTO-156] A negative payout leg amount is refused', () => {
  expect(() => terms({ payoutMode1: 'cash', payoutAmount1: -1_000 })).toThrow(/payout amount 1 cannot be negative/i);
});

test('[AUTO-157] A split within a paisa of the payout is accepted', () => {
  expect(validatePayoutSplit(390_000, 200_000, 189_999.995).valid).toBe(true);
  expect(validatePayoutSplit(390_000, 200_000, 189_000).valid, 'a rupee out is still out').toBe(false);
});

// ── Due dates ───────────────────────────────────────────────────────────────
test('[AUTO-170] The first due date defaults to one month after the issue date', () => {
  const dates = terms({ startDate: '2026-01-15' }).schedule.map((r) => iso(r.dueDate));
  expect(dates[0]).toBe('2026-02-15');
  expect(dates[1]).toBe('2026-03-15');
});

test('[AUTO-171] An explicit dueDay sets the day of the month', () => {
  const dates = terms({ startDate: '2026-01-20', dueDay: 5 }).schedule.map((r) => iso(r.dueDate));
  expect(dates[0]).toBe('2026-02-05');
  expect(dates[1]).toBe('2026-03-05');
});

test('[AUTO-172] A month-end due day clamps to the shortest month', () => {
  const dates = terms({ startDate: '2026-01-31' }).schedule.map((r) => iso(r.dueDate));
  expect(dates[0], 'never 2026-03-03').toBe('2026-02-28');
  expect(
    dates[1],
    'the clamped day is what carries forward, so the whole schedule follows the 28th',
  ).toBe('2026-03-28');
});

test('[AUTO-173] A leap-year February clamps to the 29th', () => {
  const dates = terms({ startDate: '2028-01-31' }).schedule.map((r) => iso(r.dueDate));
  expect(dates[0]).toBe('2028-02-29');
});

test('[AUTO-174] An explicit first due date is honoured', () => {
  const dates = terms({ startDate: '2026-01-15', firstDueDate: '2026-03-10' }).schedule.map((r) => iso(r.dueDate));
  expect(dates[0]).toBe('2026-03-10');
  expect(dates[1]).toBe('2026-04-10');
});

test('[AUTO-175] A first due date on or before the issue date is refused', () => {
  expect(() => terms({ startDate: '2026-01-15', firstDueDate: '2026-01-15' })).toThrow(/after the issue date/i);
  expect(() => terms({ startDate: '2026-01-15', firstDueDate: '2026-01-01' })).toThrow(/after the issue date/i);
});

test('[AUTO-176] A due day outside 1–31 is refused', () => {
  for (const dueDay of [0, 32, 5.5]) {
    expect(() => terms({ dueDay }), `dueDay ${dueDay}`).toThrow(/whole number from 1 to 31/i);
  }
});

test('[AUTO-177] An invalid issue date is refused', () => {
  expect(() => terms({ startDate: 'not-a-date' })).toThrow(/issue date is invalid/i);
});

test('[AUTO-178] The schedule has exactly one row per month of the tenure', () => {
  const rows = terms().schedule;
  expect(rows).toHaveLength(24);
  expect(rows.map((r) => r.instalmentNo)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
});

test('[AUTO-181] Due dates are stored as calendar dates, not local timestamps', () => {
  for (const row of terms().schedule) {
    expect(
      row.dueDate.toISOString().endsWith('T00:00:00.000Z'),
      `instalment ${row.instalmentNo} is UTC midnight, so it cannot slip a day in another timezone`,
    ).toBe(true);
  }
});

test('[AUTO-105] The deduction type follows the interest method', () => {
  expect(terms({ interestMethod: 'flat' }).deductionType).toBe('emi_flat');
  expect(terms({ interestMethod: 'diminishing' }).deductionType).toBe('emi_floating');
});
