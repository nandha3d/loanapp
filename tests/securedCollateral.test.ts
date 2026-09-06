import assert from 'node:assert/strict';
import {
  normalisePropertyCollateral,
  normaliseProductItem,
} from '../lib/secured/validation';

const throws = (fn: () => unknown, re: RegExp) => assert.throws(fn, re);

// ── Property mortgage register ───────────────────────────────────────────────
// PPF-045: the eligible amount is DERIVED, never taken from the request.
{
  const out = normalisePropertyCollateral(
    { marketValue: 5_000_000, eligibleLtvPercent: 60, eligibleAmount: 5_000_000 },
    { principal: 3_000_000 },
  );
  assert.equal(out.eligibleAmount, 3_000_000); // 60% of 5,000,000 — not the 5,000,000 claimed
}

// PPF-046: a principal above what the property supports is refused.
throws(
  () => normalisePropertyCollateral(
    { marketValue: 5_000_000, eligibleLtvPercent: 60 },
    { principal: 4_000_000 },
  ),
  /exceeds the 3000000/,
);

// PPF-026: negative extent / valuation are not measurements.
throws(() => normalisePropertyCollateral({ extentValue: -2_400 }, { principal: 1 }), /extentValue/);
throws(() => normalisePropertyCollateral({ marketValue: -5_000_000 }, { principal: 1 }), /marketValue/);

// PPF-047: an LTV above 100 is refused.
throws(
  () => normalisePropertyCollateral({ eligibleLtvPercent: 150 }, { principal: 1 }),
  /between 0 and 100/,
);

// PPF-029: a property cannot be valued on a day that has not happened.
{
  const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  throws(() => normalisePropertyCollateral({ valuationDate: future }, { principal: 1 }), /future/);
  const past = new Date(Date.now() - 24 * 3600 * 1000);
  const ok = normalisePropertyCollateral({ valuationDate: past.toISOString() }, { principal: 1 });
  assert.ok(ok.valuationDate instanceof Date);
}

// ── Product finance item register ────────────────────────────────────────────
// PPF-120: financed = invoice − down payment, derived not accepted.
{
  const out = normaliseProductItem(
    { invoiceAmount: 60_000, downPayment: 10_000, financedAmount: 60_000, tenureMonths: 12 },
    { principal: 50_000, tenure: 12 },
  );
  assert.equal(out.financedAmount, 50_000);
}

// PPF-121: the register and the ledger cannot disagree about the same advance.
throws(
  () => normaliseProductItem(
    { invoiceAmount: 60_000, downPayment: 10_000, financedAmount: 999_999 },
    { principal: 40_000, tenure: 12 },
  ),
  /does not match the loan principal/,
);

// PPF-122: a down payment at or above the invoice leaves nothing to finance.
for (const downPayment of [60_000, 61_000]) {
  throws(
    () => normaliseProductItem({ invoiceAmount: 60_000, downPayment }, { principal: 1, tenure: 12 }),
    /nothing left to finance/,
  );
}

// PPF-123: a negative invoice must not reach the register.
throws(
  () => normaliseProductItem({ invoiceAmount: -1_000 }, { principal: 1, tenure: 12 }),
  /invoiceAmount cannot be negative/,
);

// PPF-124: one contract, one term.
throws(
  () => normaliseProductItem(
    { invoiceAmount: 60_000, downPayment: 10_000, tenureMonths: 6 },
    { principal: 50_000, tenure: 12 },
  ),
  /does not match the loan tenure/,
);

console.log('secured collateral tests passed');
