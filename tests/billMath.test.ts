import assert from 'node:assert/strict';
import { calculateBillPayment, calculateBillTotals } from '../lib/accounting/bills';

assert.deepEqual(calculateBillTotals([
  { amount: 100.01, gstRate: 18 },
  { amount: 19.99, gstRate: 5 },
]), { subtotal: 120, gstAmount: 19, totalAmount: 139, lineGstCents: [1800, 100] });
assert.deepEqual(calculateBillPayment(100, 10, 139), { bankAmount: 90, remaining: 39 });
assert.throws(() => calculateBillPayment(139.01, 0, 139));
assert.throws(() => calculateBillPayment(100, 101, 139));
assert.throws(() => calculateBillTotals([{ amount: 1.001 }]));
console.log('Bill arithmetic passed');
