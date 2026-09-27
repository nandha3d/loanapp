import assert from 'node:assert/strict';
import { validateManualJournalLines } from '../lib/accounting/journalInput';

const balanced = [
  { accountId: 'cash', debit: 125.25, credit: 0 },
  { accountId: 'income', debit: 0, credit: 125.25 },
];
assert.equal(validateManualJournalLines(balanced, true), null);
assert.equal(validateManualJournalLines([{ ...balanced[0], debit: -125.25 }, balanced[1]], true), 'invalid_lines');
assert.equal(validateManualJournalLines([{ ...balanced[0], credit: 1 }, balanced[1]], true), 'invalid_lines');
assert.equal(validateManualJournalLines([{ ...balanced[0], debit: 125.251 }, balanced[1]], true), 'invalid_lines');
assert.equal(validateManualJournalLines([{ ...balanced[0], debit: Number.NaN }, balanced[1]], true), 'invalid_lines');
assert.equal(validateManualJournalLines([{ ...balanced[0], debit: '125.25' }, balanced[1]], true), 'invalid_lines');
assert.equal(validateManualJournalLines([balanced[0]], true), 'min_lines');
assert.equal(validateManualJournalLines([balanced[0]], false), null);
assert.equal(validateManualJournalLines([balanced[0], { ...balanced[1], credit: 125.24 }], true), 'not_balanced');
console.log('Journal line validation passed');
