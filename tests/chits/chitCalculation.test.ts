import { calculateChitAuction, calculateChitPayment } from '../../lib/chits/calculations';
import { assertValidCommissionPct, assertValidPrizeAmount, validateChitConfig } from '../../lib/chits/validation';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn: () => void, message: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`Expected throw: ${message}`);
}

const auction = calculateChitAuction({
  chitValue: 100000,
  prizeAmount: 75000,
  commissionPct: 5,
  totalMembers: 20,
});
assertEqual(auction.bidDiscount, 25000, 'bid discount');
assertEqual(auction.commission, 1250, 'commission from bid discount');
assertEqual(auction.distributableDividend, 23750, 'distributable dividend');
assertEqual(auction.dividend, 1187.5, 'ALL_MEMBERS dividend');

const nonWinners = calculateChitAuction({
  chitValue: 100000,
  prizeAmount: 80000,
  commissionPct: 5,
  totalMembers: 20,
  dividendPolicy: 'NON_WINNERS_ONLY',
});
assertEqual(nonWinners.dividendEligibleMembers, 19, 'NON_WINNERS_ONLY count');
assertEqual(nonWinners.dividend, 1000, 'NON_WINNERS_ONLY dividend');

const commissionOnValue = calculateChitAuction({
  chitValue: 100000,
  prizeAmount: 80000,
  commissionPct: 5,
  totalMembers: 20,
  commissionBasis: 'CHIT_VALUE',
  gstPct: 18,
});
assertEqual(commissionOnValue.commission, 5000, 'commission from chit value');
assertEqual(commissionOnValue.gstAmount, 900, 'gst on commission');

const rounded = calculateChitAuction({
  chitValue: 100000,
  prizeAmount: 75000,
  commissionPct: 5,
  totalMembers: 20,
  dividendRounding: 10,
});
assertEqual(rounded.dividend, 1180, 'dividend rounded down to ten');
assertEqual(rounded.roundingIncome, 150, 'rounding income retained');

const addPayment = calculateChitPayment({
  currentPaidAmount: 2000,
  incomingAmount: 3000,
  dueAmount: 5000,
  mode: 'ADD_PAYMENT',
});
assertEqual(addPayment.newPaidAmount, 5000, 'ADD_PAYMENT total');
assertEqual(addPayment.receivedDelta, 3000, 'ADD_PAYMENT delta');
assertEqual(addPayment.status, 'paid', 'ADD_PAYMENT paid status');

const setPayment = calculateChitPayment({
  currentPaidAmount: 2000,
  incomingAmount: 3000,
  dueAmount: 5000,
  mode: 'SET_TOTAL_PAID',
});
assertEqual(setPayment.newPaidAmount, 3000, 'SET_TOTAL_PAID total');
assertEqual(setPayment.receivedDelta, 1000, 'SET_TOTAL_PAID delta');
assertEqual(setPayment.status, 'partial', 'SET_TOTAL_PAID partial status');

assertThrows(
  () => assertValidPrizeAmount({ chitValue: 100000, prizeAmount: 125000 }),
  'prize greater than chit value',
);
assertThrows(
  () => assertValidCommissionPct({ commissionPct: 10, foremanCommissionCapPct: 5 }),
  'commission cap',
);
assertThrows(
  () => validateChitConfig({ minDiscountPct: 20, maxDiscountPct: 10 }),
  'invalid discount range',
);

console.log('chitCalculation tests passed');
