import { expect, test } from '@playwright/test';
import {
  computeGoldValuation,
  finenessFor,
  KARAT_FINENESS,
} from '../../../lib/gold/valuation';
import {
  resolveOrnamentLine,
  ornamentTotals,
  computeNetWeight,
} from '../../../lib/gold/ornaments';
import {
  validateGoldOrigination,
  maximumConsumptionLtvPercent,
} from '../../../lib/gold/origination';

/**
 * Appraisal, ornament lines and the RBI loan-to-value ceiling.
 *
 * These import the gold maths directly. It is pure by design — shared by the
 * web pledge form and mirrored on mobile — so testing it in isolation is what
 * that design is for, and it needs no server.
 *
 * Reference pledge, worked by hand:
 *   50g net of 22K at ₹7000/g pure, LTV 75
 *     fineness       0.916
 *     assessedValue  50 × 7000 × 0.916 = 320600
 *     eligibleAmount 320600 × 75%      = 240450
 */

const RATE = 7_000;
const REF = { netWeightGrams: 50, purityKarat: '22K', ratePerGram: RATE, ltvPercent: 75 };

// ── Karat and fineness ──────────────────────────────────────────────────────
test('[GL-020] Each supported karat maps to its physical fineness', () => {
  expect(KARAT_FINENESS).toEqual({
    '24K': 1.0,
    '23K': 0.958,
    '22K': 0.916,
    '21K': 0.875,
    '20K': 0.833,
    '18K': 0.75,
    '14K': 0.585,
    '10K': 0.417,
  });
});

test('[GL-021] Karat lookup ignores case and surrounding whitespace', () => {
  expect(finenessFor('  22k  ')).toBe(0.916);
  expect(finenessFor('22K')).toBe(0.916);
  expect(finenessFor('18k')).toBe(0.75);
});

test('[GL-022] An unrecognised karat does not silently value as 22K', () => {
  const fallback = KARAT_FINENESS['22K'];

  for (const unknown of ['9K', '', 'gold']) {
    expect(
      finenessFor(unknown),
      `"${unknown}" resolves to the 22K constant (${fallback}). A 9K ornament appraised at 22K is over-valued by more than half, and nothing on the pledge records that a fallback was used — an unknown purity must be refused, or valued at its own fineness`,
    ).not.toBe(fallback);
  }
});

// ── Valuation ───────────────────────────────────────────────────────────────
test('[GL-035] The reference pledge produces the worked figures', () => {
  const v = computeGoldValuation(REF);
  expect(v.assessedValue).toBe(320_600);
  expect(v.eligibleAmount).toBe(240_450);
  expect(v.finenessUsed).toBe(0.916);
});

test('[GL-036] The rate given is the rate for PURE gold, adjusted by purity', () => {
  expect(computeGoldValuation({ ...REF, purityKarat: '24K' }).assessedValue).toBe(350_000);
  expect(
    computeGoldValuation({ ...REF, purityKarat: '22K' }).assessedValue,
    '22K is 91.6% of the pure-gold rate, never the full rate',
  ).toBe(320_600);
});

test('[GL-037] Assessed value scales linearly with weight', () => {
  expect(computeGoldValuation({ ...REF, netWeightGrams: 10 }).assessedValue).toBe(64_120);
  expect(computeGoldValuation({ ...REF, netWeightGrams: 50 }).assessedValue).toBe(320_600);
  expect(computeGoldValuation({ ...REF, netWeightGrams: 100 }).assessedValue).toBe(641_200);
});

test('[GL-038] A zero or negative weight values at zero rather than throwing', () => {
  for (const netWeightGrams of [0, -10]) {
    const v = computeGoldValuation({ ...REF, netWeightGrams });
    expect(v.assessedValue, `weight ${netWeightGrams}`).toBe(0);
    expect(v.eligibleAmount).toBe(0);
  }
});

test('[GL-039] A zero or negative rate values at zero', () => {
  for (const ratePerGram of [0, -7_000]) {
    expect(computeGoldValuation({ ...REF, ratePerGram }).assessedValue, `rate ${ratePerGram}`).toBe(0);
  }
});

test('[GL-040] The LTV percent is clamped to 0–100', () => {
  const high = computeGoldValuation({ ...REF, ltvPercent: 150 });
  expect(high.eligibleAmount, '150 clamps to 100 — never more than the metal is worth').toBe(high.assessedValue);

  expect(computeGoldValuation({ ...REF, ltvPercent: -20 }).eligibleAmount).toBe(0);
});

test('[GL-041] Assessed value and eligible amount are whole rupees', () => {
  const v = computeGoldValuation({ ...REF, netWeightGrams: 12.345, ltvPercent: 73 });
  expect(Number.isInteger(v.assessedValue), 'a pledge receipt never quotes paise on the appraisal').toBe(true);
  expect(Number.isInteger(v.eligibleAmount)).toBe(true);
});

test('[GL-042] A fractional weight is valued exactly', () => {
  const v = computeGoldValuation({ ...REF, netWeightGrams: 12.345 });
  expect(v.assessedValue, 'weight × rate × fineness, rounded once').toBe(Math.round(12.345 * RATE * 0.916));
});

// ── Ornament lines ──────────────────────────────────────────────────────────
test('[GL-055] Net weight is gross less wastage', () => {
  const line = resolveOrnamentLine({ grossWeightGrams: 12.5, wastageGrams: 0.5, ratePerGram: 6_400 });
  expect(line.netWeightGrams).toBe(12);
  expect(line.value).toBe(76_800);
  expect(computeNetWeight(12.5, 0.5)).toBe(12);
});

test('[GL-056] An explicit net weight overrides the derived one', () => {
  const line = resolveOrnamentLine({
    grossWeightGrams: 12.5, wastageGrams: 0.5, netWeightGrams: 11, ratePerGram: 6_400,
  });
  expect(line.netWeightGrams, 'the appraiser’s own measurement wins over the arithmetic').toBe(11);
  expect(line.value).toBe(70_400);
});

test('[GL-057] Wastage larger than the gross weight floors the net at zero', () => {
  const line = resolveOrnamentLine({ grossWeightGrams: 5, wastageGrams: 8, ratePerGram: 6_400 });
  expect(line.netWeightGrams, 'a negative weight never reaches a valuation').toBe(0);
  expect(line.value).toBe(0);
});

test('[GL-060] Quantity defaults to one and is a whole number', () => {
  expect(resolveOrnamentLine({ grossWeightGrams: 5 }).quantity).toBe(1);
  expect(resolveOrnamentLine({ quantity: 0, grossWeightGrams: 5 }).quantity).toBe(1);
  expect(resolveOrnamentLine({ quantity: -1, grossWeightGrams: 5 }).quantity).toBe(1);
  expect(resolveOrnamentLine({ quantity: 2.7, grossWeightGrams: 5 }).quantity, 'half an ornament is not a thing').toBe(2);
});

test('[GL-061] Header totals are the sum of the lines', () => {
  const totals = ornamentTotals([
    { quantity: 2, grossWeightGrams: 12.5, wastageGrams: 0.5, ratePerGram: 6_400 },
    { quantity: 1, grossWeightGrams: 8.25, wastageGrams: 0.25, ratePerGram: 6_400 },
    { quantity: 3, grossWeightGrams: 4, wastageGrams: 0, ratePerGram: 5_800 },
  ]);

  expect(totals.totalQuantity).toBe(6);
  expect(totals.totalGrossWeight).toBe(24.75);
  expect(totals.totalWastage).toBe(0.75);
  expect(totals.totalNetWeight).toBe(24);
  expect(totals.totalValue, '76800 + 51200 + 23200').toBe(151_200);
});

test('[GL-063] An empty line list totals to zero without throwing', () => {
  expect(ornamentTotals([])).toEqual({
    totalQuantity: 0,
    totalGrossWeight: 0,
    totalWastage: 0,
    totalNetWeight: 0,
    totalValue: 0,
  });
});

test('[GL-064] Weight totals do not accumulate floating-point drift', () => {
  const totals = ornamentTotals(Array.from({ length: 20 }, () => ({ grossWeightGrams: 0.001 })));
  expect(totals.totalGrossWeight, 'rounded once at the total, not per line').toBe(0.02);
});

test('[GL-065] Each line records its own rate', () => {
  const totals = ornamentTotals([
    { grossWeightGrams: 10, ratePerGram: 6_400 },
    { grossWeightGrams: 10, ratePerGram: 5_800 },
  ]);
  expect(totals.totalValue, 'a mixed-purity pledge is not flattened to one rate').toBe(122_000);
});

// ── LTV tiers ───────────────────────────────────────────────────────────────
test('[GL-080] A consumption loan up to ₹2.5L sits in the 85% tier', () => {
  expect(maximumConsumptionLtvPercent(100_000)).toBe(85);
  expect(maximumConsumptionLtvPercent(250_000), 'the boundary is inclusive').toBe(85);
});

test('[GL-081] Above ₹2.5L and up to ₹5L the ceiling is 80%', () => {
  expect(maximumConsumptionLtvPercent(250_001)).toBe(80);
  expect(maximumConsumptionLtvPercent(500_000)).toBe(80);
});

test('[GL-082] Above ₹5L the ceiling is 75%', () => {
  expect(maximumConsumptionLtvPercent(500_001)).toBe(75);
  expect(maximumConsumptionLtvPercent(2_000_000)).toBe(75);
});

const PLEDGE = {
  assessedValue: 320_600,
  requestedPrincipal: 200_000,
  totalPayableAtMaturity: 220_000,
  repaymentModel: 'bullet' as const,
};

test('[GL-087] A bullet pledge is measured on what is repayable at maturity', () => {
  const v = validateGoldOrigination(PLEDGE);
  expect(v.exposureForLtv, 'the interest a bullet accrues is part of the exposure').toBe(220_000);
  expect(v.borrowerConsumptionExposure).toBe(220_000);
  expect(v.maximumLtvPercent).toBe(85);
});

test('[GL-088] An amortising pledge is measured on principal', () => {
  const v = validateGoldOrigination({ ...PLEDGE, repaymentModel: 'amortizing' });
  expect(v.exposureForLtv, 'a reducing balance is not the same risk as a bullet').toBe(200_000);
});

test('[GL-083] The tier is decided by the borrower’s TOTAL exposure, not this loan alone', () => {
  const alone = validateGoldOrigination(PLEDGE);
  expect(alone.maximumLtvPercent).toBe(85);

  const withOthers = validateGoldOrigination({ ...PLEDGE, borrowerExistingConsumptionExposure: 400_000 });
  expect(withOthers.borrowerConsumptionExposure, '400000 already out plus 220000 now').toBe(620_000);
  expect(
    withOthers.maximumLtvPercent,
    'a borrower cannot stay in the 85% tier by splitting one pledge into several',
  ).toBe(75);
});

test('[GL-084] A requested LTV above the ceiling is clamped, never honoured', () => {
  const v = validateGoldOrigination({ ...PLEDGE, requestedLtvPercent: 90 });
  expect(v.maximumLtvPercent).toBe(85);
  expect(v.appliedLtvPercent, 'GOLD-1: a ceiling is never raised from configuration').toBe(85);
});

test('[GL-085] A requested LTV below the ceiling is honoured', () => {
  // A smaller advance, so lending at 60% still covers the exposure.
  const v = validateGoldOrigination({
    ...PLEDGE,
    requestedPrincipal: 150_000,
    totalPayableAtMaturity: 165_000,
    requestedLtvPercent: 60,
  });
  expect(v.appliedLtvPercent, 'a branch may lend more conservatively than the regulator requires').toBe(60);
  expect(v.eligibleAmount, '320600 × 60%').toBe(192_360);
});

test('[GL-086] A zero or negative requested LTV is refused', () => {
  for (const requestedLtvPercent of [0, -5]) {
    expect(
      () => validateGoldOrigination({ ...PLEDGE, requestedLtvPercent }),
      `LTV ${requestedLtvPercent}`,
    ).toThrow(/ltv percent must be greater than zero/i);
  }
});

test('[GL-089] An exposure above the eligible amount is refused with both figures', () => {
  expect(() =>
    validateGoldOrigination({
      ...PLEDGE,
      requestedPrincipal: 300_000,
      totalPayableAtMaturity: 330_000,
    }),
  ).toThrow(/330000\.00.*256480\.00/);
});

test('[GL-090] Exposure exactly at the eligible amount is accepted', () => {
  // The tier is decided by the exposure itself, so the boundary case has to be
  // self-consistent: 256480 sits in the 80% band, and 320600 × 80% is 256480.
  const v = validateGoldOrigination({
    ...PLEDGE,
    requestedPrincipal: 230_000,
    totalPayableAtMaturity: 256_480,
  });
  expect(v.maximumLtvPercent, 'an exposure above 2.5L is an 80% pledge').toBe(80);
  expect(v.exposureForLtv).toBe(256_480);
  expect(v.eligibleAmount, 'the ceiling is inclusive — equal is allowed').toBe(256_480);
});

test('[GL-091] The eligible amount rounds DOWN to the paisa', () => {
  const v = validateGoldOrigination({ ...PLEDGE, assessedValue: 320_601, requestedLtvPercent: 73 });
  const raw = (320_601 * 73) / 100;
  expect(
    v.eligibleAmount,
    'rounding up would sanction a rupee the ceiling does not allow',
  ).toBeLessThanOrEqual(raw);
  expect(v.eligibleAmount).toBe(Math.floor(raw * 100) / 100);
});

test('[GL-092] A negative existing exposure is floored at zero', () => {
  const v = validateGoldOrigination({ ...PLEDGE, borrowerExistingConsumptionExposure: -100_000 });
  expect(
    v.borrowerConsumptionExposure,
    'a negative cannot be used to buy headroom under the ceiling',
  ).toBe(220_000);
});

// ── Origination validation ──────────────────────────────────────────────────
test('[GL-110] A zero or negative assessed value is refused', () => {
  for (const assessedValue of [0, -1]) {
    expect(() => validateGoldOrigination({ ...PLEDGE, assessedValue })).toThrow(
      /assessed collateral value must be greater than zero/i,
    );
  }
});

test('[GL-111] A zero or negative principal is refused', () => {
  for (const requestedPrincipal of [0, -1]) {
    expect(() => validateGoldOrigination({ ...PLEDGE, requestedPrincipal })).toThrow(
      /requested principal must be greater than zero/i,
    );
  }
});

test('[GL-112] A zero total payable is refused', () => {
  expect(() => validateGoldOrigination({ ...PLEDGE, totalPayableAtMaturity: 0 })).toThrow(
    /total payable at maturity must be greater than zero/i,
  );
});

test('[GL-113] A non-numeric money field is refused, not coerced', () => {
  expect(
    () => validateGoldOrigination({ ...PLEDGE, assessedValue: 'three lakh' as unknown as number }),
    'a coerced NaN would otherwise sanction a pledge against nothing',
  ).toThrow(/assessed collateral value/i);
});
