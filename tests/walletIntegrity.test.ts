import assert from 'node:assert/strict';
import { InsufficientFloatError, calculateFloatBalance } from '../lib/wallet';

assert.equal(calculateFloatBalance(10_000, -4_000, true), 6_000);
assert.equal(calculateFloatBalance(10_000, 2_500, true), 12_500);
assert.equal(calculateFloatBalance(1_000, -2_000, false), -1_000);
assert.throws(
  () => calculateFloatBalance(1_000, -2_000, true),
  (error: unknown) => {
    assert.ok(error instanceof InsufficientFloatError);
    assert.equal(error.available, 1_000);
    assert.equal(error.required, 2_000);
    return true;
  },
);

console.log('wallet integrity tests passed');
