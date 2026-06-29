import assert from 'node:assert/strict';
import {
  elapsedMonthsDays,
  billableMonths,
  pledgeInterestDue,
  applyPartPayment,
  redemptionAmount,
} from '../lib/gold/pledgeInterest';

// elapsedMonthsDays
{
  const a = elapsedMonthsDays(new Date('2026-01-01'), new Date('2026-03-24'));
  assert.equal(a.months, 2);
  assert.equal(a.extraDays, 23); // matches competitor "2 months 23 days"
}
{
  const b = elapsedMonthsDays(new Date('2026-01-01'), new Date('2026-01-01'));
  assert.equal(b.months, 0);
  assert.equal(b.extraDays, 0);
}

// billableMonths — full-month rule (partial → full month)
{
  const full = billableMonths(new Date('2026-01-01'), new Date('2026-03-24'), 'full');
  assert.equal(full.monthsCharged, 3); // 2 whole + 23 days → 3
  const prorated = billableMonths(new Date('2026-01-01'), new Date('2026-03-24'), 'prorated');
  assert.ok(Math.abs(prorated.monthsCharged - (2 + 23 / 30)) < 1e-9);
  // brand-new pledge still owes 1 month
  const fresh = billableMonths(new Date('2026-01-01'), new Date('2026-01-01'), 'full');
  assert.equal(fresh.monthsCharged, 1);
}

// pledgeInterestDue — competitor: ₹75,000 @ 2%/month
{
  const r = pledgeInterestDue(75000, 2, new Date('2026-01-01'), new Date('2026-03-24'), 'full');
  assert.equal(r.monthlyInterest, 1500);
  assert.equal(r.monthsCharged, 3);
  assert.equal(r.interestDue, 4500); // matches the receipt's ₹4,500
}
// one fresh month = ₹1,500 ("1 month interest for 23 days")
{
  const r = pledgeInterestDue(75000, 2, new Date('2026-01-01'), new Date('2026-01-23'), 'full');
  assert.equal(r.interestDue, 1500);
}

// applyPartPayment
assert.equal(applyPartPayment(75000, 50000), 25000);
assert.equal(applyPartPayment(10000, 20000), 0); // never negative

// redemptionAmount
assert.equal(redemptionAmount(25000, 5500, 0), 30500);
assert.equal(redemptionAmount(75000, 4500, 1000), 80500);

console.log('pledge interest tests passed');
