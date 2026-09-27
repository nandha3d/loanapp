import assert from 'node:assert/strict';
import { calculateGstTotals, validateChallanAmount } from '../lib/accounting/tax';

assert.deepEqual(calculateGstTotals({
  outputCGST: 20, outputSGST: 10, outputIGST: 5,
  inputCGST: 15, inputSGST: 12, inputIGST: 8,
}), { netCGST: 5, netSGST: 0, netIGST: 0, totalLiability: 5, itcCarryForward: 5 });
assert.doesNotThrow(() => validateChallanAmount(12.50, [
  { tdsAmount: 10.25 }, { tdsAmount: 2.25 },
]));
assert.throws(() => validateChallanAmount(12.51, [
  { tdsAmount: 10.25 }, { tdsAmount: 2.25 },
]));
console.log('Tax arithmetic passed');
