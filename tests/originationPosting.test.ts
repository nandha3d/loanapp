import assert from 'node:assert/strict';
import { buildOriginationPostingPlan } from '../lib/accounting/originationPosting';
import { buildDedupKey, isDuplicateJournalEntry } from '../lib/accounting/postingKeys';

const hp = buildOriginationPostingPlan({
  principal: 85_000,
  disbursedAmount: 79_000,
  upfrontCreditKey: 'processing_fee_income',
  payoutLegs: [
    { mode: 'bank', amount: 50_000 },
    { mode: 'cash', amount: 29_000 },
  ],
});

assert.equal(hp.totalDebit, 85_000);
assert.equal(hp.totalCredit, 85_000);
assert.deepEqual(hp.lines, [
  { key: 'loan_receivable', debit: 85_000, credit: 0 },
  { key: 'bank_account', debit: 0, credit: 50_000 },
  { key: 'cash_on_hand', debit: 0, credit: 29_000 },
  { key: 'processing_fee_income', debit: 0, credit: 6_000 },
]);

const upfront = buildOriginationPostingPlan({
  principal: 100_000,
  disbursedAmount: 90_000,
  upfrontCreditKey: 'interest_income',
});
assert.deepEqual(upfront.lines, [
  { key: 'loan_receivable', debit: 100_000, credit: 0 },
  { key: 'cash_on_hand', debit: 0, credit: 90_000 },
  { key: 'interest_income', debit: 0, credit: 10_000 },
]);

assert.throws(
  () => buildOriginationPostingPlan({
    principal: 85_000,
    disbursedAmount: 79_000,
    upfrontCreditKey: 'processing_fee_income',
    payoutLegs: [{ mode: 'cash', amount: 70_000 }],
  }),
  /payout legs/i,
);

// ─── Journal dedup key ───────────────────────────────────────────────────────
// The key backs a UNIQUE index, so it is the only thing stopping a re-run from
// double-posting. Both auto-posting paths for a disbursement must produce the
// SAME key, or the loan is booked twice.

assert.equal(
  buildDedupKey('loan_disburse', 'tenant_1', 'loan_9'),
  'loan_disburse:tenant_1:loan_9',
);

// Tenant-qualified: the unique index is global, so two tenants must never be
// able to collide on a shared source id.
assert.notEqual(
  buildDedupKey('collection', 'tenant_a', 'entry_1'),
  buildDedupKey('collection', 'tenant_b', 'entry_1'),
);

// Manual entries are allowed to repeat, and a missing source id has no identity
// to dedup on — both must stay null rather than inventing a key that collides.
assert.equal(buildDedupKey('manual', 'tenant_1', 'entry_1'), null);
assert.equal(buildDedupKey('collection', 'tenant_1', null), null);
assert.equal(buildDedupKey('collection', 'tenant_1', undefined), null);

assert.equal(isDuplicateJournalEntry({ code: 'P2002' }), true);
assert.equal(isDuplicateJournalEntry({ code: 'P2003' }), false);
assert.equal(isDuplicateJournalEntry(new Error('boom')), false);
assert.equal(isDuplicateJournalEntry(null), false);

console.log('origination posting tests passed');
