import assert from 'node:assert/strict';
import { computeServicing, monthsCoveredByPayment, advanceByMonths } from '../lib/gold/servicing';

// computeServicing — competitor: ₹75,000 @ 2%/month, 2mo 23d
{
  const s = computeServicing({
    outstandingPrincipal: 75000,
    monthlyRatePercent: 2,
    interestPaidUpto: new Date('2026-01-01'),
    now: new Date('2026-03-24'),
  });
  assert.equal(s.monthlyInterest, 1500);
  assert.equal(s.monthsDue, 3);
  assert.equal(s.interestDue, 4500);
  assert.equal(s.redemptionAmount, 79500); // 75000 + 4500
}

// after a ₹50,000 part-payment, interest is on ₹25,000
{
  const s = computeServicing({
    outstandingPrincipal: 25000,
    monthlyRatePercent: 2,
    interestPaidUpto: new Date('2026-01-01'),
    now: new Date('2026-02-01'),
  });
  assert.equal(s.monthlyInterest, 500);
  assert.equal(s.redemptionAmount, 25500);
}

// monthsCoveredByPayment
assert.equal(monthsCoveredByPayment(3000, 1500), 2);
assert.equal(monthsCoveredByPayment(1500, 0), 0); // guard divide-by-zero

// advanceByMonths
{
  const d = advanceByMonths(new Date('2026-01-01'), 2);
  assert.equal(d.getMonth(), 2); // March (0-indexed)
}
// GL-207: advancing a month-end date must not skip a month. 31 Jan + 1 month
// clamps to 28 Feb — the buggy setMonth overflowed to 3 Mar and lost February.
{
  const d = advanceByMonths(new Date('2026-01-31'), 1);
  assert.equal(d.getMonth(), 1); // February, not March
  assert.equal(d.getDate(), 28); // clamped to Feb's last day
}

console.log('gold servicing tests passed');
