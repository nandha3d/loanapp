import assert from 'node:assert/strict';
import { computeSettlement } from '../lib/chit/settlementMath';

// Reverse auction: chit value 100000, winner bids the prize down to 90000, so the
// discount is 10000. Foreman commission is 5% of the DISCOUNT (not the prize) =
// 500. The remaining 9500 is shared among the OTHER 9 members (10 - 1) = 1055.56.
{
  const r = computeSettlement({
    chitValue: 100000,
    prizeAmount: 90000,
    commissionPct: 5,
    totalMembers: 10,
  });
  assert.equal(r.bidDiscount, 10000, 'bidDiscount = chitValue - prizeAmount');
  assert.equal(r.commission, 500, 'commission = 5% of the discount, not the prize');
  assert.ok(
    Math.abs(r.dividend - 9500 / 9) < 1e-9,
    `dividend divided by (members - 1); got ${r.dividend}`,
  );
}

// The dividend must use (totalMembers - 1) — the winner does not share in their
// own discount. Guard against the old mobile bug that divided by totalMembers.
{
  const r = computeSettlement({
    chitValue: 100000,
    prizeAmount: 80000,
    commissionPct: 0,
    totalMembers: 5,
  });
  assert.equal(r.bidDiscount, 20000);
  assert.equal(r.commission, 0);
  assert.equal(r.dividend, 20000 / 4, 'dividend = discount / (members - 1)');
  assert.notEqual(r.dividend, 20000 / 5, 'must NOT divide by totalMembers');
}

// A single-member group cannot pay a dividend to anyone else (no divide-by-zero).
{
  const r = computeSettlement({
    chitValue: 50000,
    prizeAmount: 45000,
    commissionPct: 5,
    totalMembers: 1,
  });
  assert.equal(r.dividend, 0, 'single-member group pays no dividend');
}

console.log('chitSettlement.test.ts: all assertions passed');
