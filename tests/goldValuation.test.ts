import assert from 'node:assert/strict';
import {
  computeGoldValuation,
  finenessFor,
  GOLD_RATE_KEY,
} from '../lib/gold/valuation';

// ── finenessFor ───────────────────────────────────────────────────────────────
assert.equal(finenessFor('24K'), 1.0);
assert.equal(finenessFor('22k'), 0.916); // case-insensitive
assert.equal(finenessFor('18K'), 0.75);
// A karat outside the table values at its OWN fineness (N/24), never 22K (GL-022).
assert.equal(finenessFor('9K'), 0.375);
// Truly unrecognised purity is refused (0), not silently valued at 22K.
assert.equal(finenessFor('unknown'), 0);
assert.equal(finenessFor(''), 0);

// ── computeGoldValuation ──────────────────────────────────────────────────────
// 10g of 22K at ₹6000/g pure, 75% LTV
{
  const v = computeGoldValuation({
    netWeightGrams: 10,
    purityKarat: '22K',
    ratePerGram: 6000,
    ltvPercent: 75,
  });
  // 10 * 6000 * 0.916 = 54,960
  assert.equal(v.assessedValue, 54960);
  // 54,960 * 0.75 = 41,220
  assert.equal(v.eligibleAmount, 41220);
  assert.equal(v.finenessUsed, 0.916);
}

// 24K pure gold values at full rate
{
  const v = computeGoldValuation({
    netWeightGrams: 5,
    purityKarat: '24K',
    ratePerGram: 6000,
    ltvPercent: 100,
  });
  assert.equal(v.assessedValue, 30000);
  assert.equal(v.eligibleAmount, 30000);
}

// LTV is clamped to 0..100; negatives clamp to 0
{
  const v = computeGoldValuation({
    netWeightGrams: 10,
    purityKarat: '22K',
    ratePerGram: 6000,
    ltvPercent: 150,
  });
  assert.equal(v.eligibleAmount, v.assessedValue); // capped at 100%
}

// Missing/zero inputs never throw, return 0
{
  const v = computeGoldValuation({
    netWeightGrams: 0,
    purityKarat: '22K',
    ratePerGram: 0,
    ltvPercent: 75,
  });
  assert.equal(v.assessedValue, 0);
  assert.equal(v.eligibleAmount, 0);
}

// ── AppSetting key helper (no hardcoded rate) ────────────────────────────────
assert.equal(GOLD_RATE_KEY('22K'), 'gold_rate_per_gram_22k');

console.log('gold valuation tests passed');
