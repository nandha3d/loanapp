import assert from 'node:assert/strict';
import { calculatePackageDeduction, normalizePackageInput, PackageError } from '../lib/packages/service';

assert.equal(calculatePackageDeduction(10000, 2.5, 'percentage'), 250);
assert.equal(calculatePackageDeduction(10000, 250, 'fixed'), 250);
assert.deepEqual(normalizePackageInput({
  name: 'Weekly', principal: 10000, deduction: 2.5,
  deductionType: 'percentage', frequency: 'weekly', tenure: 10,
  penaltyRate: 0,
}), {
  name: 'Weekly', principal: 10000, deduction: 250,
  deductionType: 'percentage', frequency: 'weekly', tenure: 10,
  perInstalment: 1000, penaltyRate: 0,
});
assert.throws(() => normalizePackageInput({
  name: 'Invalid', principal: 10000, deduction: 2,
  tenure: 0,
}), PackageError);

console.log('Loan package deduction and validation passed');
