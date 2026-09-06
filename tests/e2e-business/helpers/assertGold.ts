import assert from 'node:assert/strict';
import { computeGoldValuation, finenessFor } from '../../../lib/gold/valuation';
import { computeNetWeight, ornamentTotals } from '../../../lib/gold/ornaments';
import { assertMoneyEqual } from './assertMoney';

export function assertGoldValuation(input: {
  grossWeight: number;
  wastage: number;
  purityKarat: string;
  ratePerGram: number;
  ltvPercent: number;
  expectedLoanAmount?: number;
}) {
  const netWeight = computeNetWeight(input.grossWeight, input.wastage);
  const valuation = computeGoldValuation({
    netWeightGrams: netWeight,
    purityKarat: input.purityKarat,
    ratePerGram: input.ratePerGram,
    ltvPercent: input.ltvPercent,
  });
  assert.equal(valuation.finenessUsed, finenessFor(input.purityKarat));
  assertMoneyEqual(valuation.assessedValue, Math.round(netWeight * input.ratePerGram * finenessFor(input.purityKarat)), 'gold assessed value');
  if (input.expectedLoanAmount !== undefined) {
    assert.equal(input.expectedLoanAmount <= valuation.eligibleAmount, true, 'gold LTV eligible amount');
  }
  return { netWeight, valuation };
}

export function assertOrnamentTotals(items: Parameters<typeof ornamentTotals>[0], expected: ReturnType<typeof ornamentTotals>) {
  const actual = ornamentTotals(items);
  assert.deepEqual(actual, expected);
}
