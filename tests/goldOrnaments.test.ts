import assert from 'node:assert/strict';
import {
  computeNetWeight,
  resolveOrnamentLine,
  ornamentTotals,
} from '../lib/gold/ornaments';

// computeNetWeight
assert.equal(computeNetWeight(5, 0.5), 4.5);
assert.equal(computeNetWeight(3, 5), 0); // wastage > gross clamps to 0
assert.equal(computeNetWeight(8, 0), 8);

// resolveOrnamentLine — derives net + value
{
  const l = resolveOrnamentLine({ grossWeightGrams: 5, wastageGrams: 0.5, ratePerGram: 10273.97 });
  assert.equal(l.netWeightGrams, 4.5);
  assert.equal(l.value, Math.round(4.5 * 10273.97)); // 46233
  assert.equal(l.quantity, 1);
}

// explicit net overrides derived
{
  const l = resolveOrnamentLine({ grossWeightGrams: 5, wastageGrams: 0.5, netWeightGrams: 4.0, ratePerGram: 10000 });
  assert.equal(l.netWeightGrams, 4.0);
  assert.equal(l.value, 40000);
}

// quantity floored, missing → 1
{
  const l = resolveOrnamentLine({ quantity: 2.9, grossWeightGrams: 2, ratePerGram: 100 });
  assert.equal(l.quantity, 2);
}

// totals across the 2-ornament pledge from the competitor receipt (CHAIN + RING)
{
  const totals = ornamentTotals([
    { grossWeightGrams: 5.0, wastageGrams: 0.5, netWeightGrams: 4.5, ratePerGram: 10273.97 },
    { grossWeightGrams: 3.0, wastageGrams: 0.2, netWeightGrams: 2.8, ratePerGram: 10273.97 },
  ]);
  assert.equal(totals.totalQuantity, 2);
  assert.equal(totals.totalGrossWeight, 8.0);
  assert.equal(totals.totalNetWeight, 7.3);
  assert.equal(totals.totalWastage, 0.7);
  assert.ok(totals.totalValue > 0);
}

// empty
{
  const t = ornamentTotals([]);
  assert.equal(t.totalValue, 0);
  assert.equal(t.totalNetWeight, 0);
}

console.log('gold ornament tests passed');
