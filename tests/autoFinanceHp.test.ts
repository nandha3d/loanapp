/**
 * Auto Finance (HP) domain rules — quoting, waterfall allocation, the
 * split-row due chart, and the daily-operations gates.
 *
 * Run: npm run test:autofinance
 */
import assert from 'node:assert/strict';
import {
  calculateHpQuote,
  calculateHpDisbursement,
  validatePayoutSplit,
} from '../lib/autofinance/hp';
import {
  planWaterfallAllocation,
  summarizeWaterfallByInstalment,
  calculateSettlementQuote,
} from '../lib/autofinance/allocation';
import { buildLedgerRows, summarizeLedger } from '../lib/autofinance/ledger';
import {
  checkLoginWindow,
  parseTimeOfDay,
  summarizeDayClosing,
  evaluateDayClosingGate,
  businessDateKey,
} from '../lib/autofinance/operations';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// ---------------------------------------------------------------------------
console.log('HP quoting');
// ---------------------------------------------------------------------------

check('flat rate splits principal and interest evenly', () => {
  const quote = calculateHpQuote({
    vehicleValue: 100000,
    downPayment: 20000,
    interestRate: 12,
    interestMethod: 'flat',
    tenureMonths: 24,
  });
  assert.equal(quote.principal, 80000);
  // 80000 * 12% * 2 years = 19200
  assert.equal(quote.totalInterest, 19200);
  assert.equal(quote.totalPayable, 99200);
  assert.equal(quote.schedule.length, 24);
  const summed = quote.schedule.reduce((s, r) => s + r.dueAmount, 0);
  assert.equal(Math.round(summed), 99200);
});

check('round-off makes every instalment a whole rupee', () => {
  const quote = calculateHpQuote({
    vehicleValue: 100000,
    downPayment: 15000,
    interestRate: 11,
    interestMethod: 'flat',
    tenureMonths: 18,
    roundOffEmi: true,
  });
  assert.ok(Number.isInteger(quote.emi), `EMI ${quote.emi} should be a whole rupee`);
  // Every row except a remainder-absorbing last row carries the same EMI.
  for (const row of quote.schedule.slice(0, -1)) {
    assert.equal(row.dueAmount, quote.emi);
  }
  assert.equal(quote.totalPayable, quote.principal + quote.totalInterest);
});

check('diminishing amortises the balance to zero', () => {
  const quote = calculateHpQuote({
    vehicleValue: 500000,
    downPayment: 100000,
    interestRate: 12,
    interestMethod: 'diminishing',
    tenureMonths: 36,
  });
  assert.equal(quote.principal, 400000);
  const last = quote.schedule[quote.schedule.length - 1];
  assert.equal(last.balance, 0, 'final balance must clear');
  const principalSum = quote.schedule.reduce((s, r) => s + r.principalComponent, 0);
  assert.ok(Math.abs(principalSum - 400000) < 1, `principal components sum to ${principalSum}`);
  // Diminishing must cost less than flat at the same nominal rate.
  const flat = calculateHpQuote({
    vehicleValue: 500000,
    downPayment: 100000,
    interestRate: 12,
    interestMethod: 'flat',
    tenureMonths: 36,
  });
  assert.ok(quote.totalInterest < flat.totalInterest);
});

check('schedule always sums exactly to total payable', () => {
  for (const tenure of [7, 11, 13, 23, 37]) {
    const quote = calculateHpQuote({
      vehicleValue: 123457,
      downPayment: 33333,
      interestRate: 13.5,
      interestMethod: 'flat',
      tenureMonths: tenure,
    });
    const summed = quote.schedule.reduce((s, r) => s + r.dueAmount, 0);
    assert.ok(
      Math.abs(summed - quote.totalPayable) < 0.01,
      `tenure ${tenure}: schedule ${summed} vs total ${quote.totalPayable}`,
    );
  }
});

check('rejects a down payment at or above the vehicle value', () => {
  assert.throws(() => calculateHpQuote({
    vehicleValue: 50000,
    downPayment: 50000,
    interestRate: 10,
    interestMethod: 'flat',
    tenureMonths: 12,
  }), /Down payment must be less than/);
});

check('disbursement nets the recovered charges off the payout', () => {
  const d = calculateHpDisbursement({
    principal: 80000,
    handLoanAmount: 5000,
    insuranceCharge: 3000,
    documentCharge: 1000,
    brokerCommission: 2000,
  });
  assert.equal(d.grossPayout, 85000);
  assert.equal(d.recoveredCharges, 6000);
  assert.equal(d.netPayout, 79000);
});

check('payout splitter must reconcile, but may be left blank', () => {
  assert.equal(validatePayoutSplit(79000, null, null).valid, true);
  assert.equal(validatePayoutSplit(79000, 50000, 29000).valid, true);
  assert.equal(validatePayoutSplit(79000, 50000, 20000).valid, false);
});

// ---------------------------------------------------------------------------
console.log('Bulk allocation waterfall');
// ---------------------------------------------------------------------------

const asOf = new Date('2026-06-15T06:00:00.000Z');
function ledger() {
  return [
    // three overdue, one with a penalty
    { id: 'i1', instalmentNo: 1, dueDate: '2026-03-10', dueAmount: 5000, receivedAmount: 0, penaltyOutstanding: 300 },
    { id: 'i2', instalmentNo: 2, dueDate: '2026-04-10', dueAmount: 5000, receivedAmount: 2000 },
    { id: 'i3', instalmentNo: 3, dueDate: '2026-05-10', dueAmount: 5000, receivedAmount: 0, penaltyOutstanding: 150 },
    // future
    { id: 'i4', instalmentNo: 4, dueDate: '2026-07-10', dueAmount: 5000, receivedAmount: 0 },
  ];
}

check('clears oldest overdue first, penalty before the due', () => {
  const plan = planWaterfallAllocation(ledger(), 10000, asOf);
  const applied = plan.lines.filter((l) => l.applied > 0);
  assert.equal(applied[0].instalmentNo, 1);
  assert.equal(applied[0].bucket, 'penalty');
  assert.equal(applied[0].applied, 300);
  assert.equal(applied[1].bucket, 'due');
  assert.equal(applied[1].applied, 5000);
  // 10000 − 300 − 5000 = 4700 left, i2 owes 3000 → cleared, 1700 to i3 penalty+due
  assert.equal(plan.penaltyPaid, 450);
  assert.equal(plan.duePaid, 9550);
  assert.equal(plan.unapplied, 0);
});

check('remainder spills onto upcoming dues as an advance', () => {
  const plan = planWaterfallAllocation(ledger(), 25000, asOf);
  // total owed = 450 penalty + 18000 due = 18450
  assert.equal(plan.remainingOutstanding, 0);
  assert.equal(plan.unapplied, 25000 - 18450);
  const future = plan.lines.find((l) => l.instalmentNo === 4 && l.bucket === 'due');
  assert.equal(future?.cleared, true);
  assert.equal(future?.overdue, false);
});

check('a short payment leaves the tail outstanding', () => {
  const plan = planWaterfallAllocation(ledger(), 1000, asOf);
  assert.equal(plan.penaltyPaid, 300);
  assert.equal(plan.duePaid, 700);
  assert.equal(plan.unapplied, 0);
  assert.equal(plan.instalmentsCleared, 0);
  assert.equal(plan.remainingOutstanding, 450 + 18000 - 1000);
});

check('waiving a penalty routes the whole amount to dues', () => {
  const rows = ledger().map((r) => ({ ...r, penaltyOutstanding: 0 }));
  const plan = planWaterfallAllocation(rows, 1000, asOf);
  assert.equal(plan.penaltyPaid, 0);
  assert.equal(plan.duePaid, 1000);
});

check('waived instalments are skipped entirely', () => {
  const rows = ledger().map((r) => (r.id === 'i1' ? { ...r, status: 'waived' } : r));
  const plan = planWaterfallAllocation(rows, 1000, asOf);
  assert.ok(!plan.lines.some((l) => l.instalmentNo === 1));
});

check('per-instalment summary matches the line items', () => {
  const plan = planWaterfallAllocation(ledger(), 10000, asOf);
  const summary = summarizeWaterfallByInstalment(plan);
  const total = summary.reduce((s, r) => s + r.dueApplied + r.penaltyApplied, 0);
  assert.equal(total, 10000);
  const first = summary.find((s) => s.instalmentId === 'i1');
  assert.equal(first?.penaltyApplied, 300);
  assert.equal(first?.dueApplied, 5000);
});

check('settlement discounts cannot exceed the head they apply to', () => {
  const quote = calculateSettlementQuote({
    principalOutstanding: 40000,
    interestOutstanding: 5000,
    penaltyOutstanding: 1200,
    chargesOutstanding: 800,
    interestDiscount: 9999,
    penaltyDiscount: 500,
  });
  assert.equal(quote.interestDiscount, 5000);
  assert.equal(quote.penaltyDiscount, 500);
  assert.equal(quote.finalSettlementAmount, 40000 + 5000 + 1200 + 800 - 5500);
});

// ---------------------------------------------------------------------------
console.log('Due-chart split rows');
// ---------------------------------------------------------------------------

check('a partial payment splits into a paid row and a balance row', () => {
  const rows = buildLedgerRows(
    [{
      id: 'i2',
      instalmentNo: 2,
      dueDate: '2026-04-10',
      dueAmount: 5000,
      receivedAmount: 2000,
      principalComponent: 4000,
      interestComponent: 1000,
      penaltyOutstanding: 250,
    }],
    { asOf },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].segment, 'paid');
  assert.equal(rows[0].tone, 'paid');
  assert.equal(rows[0].amount, 2000);
  assert.equal(rows[0].principal, 1600); // pro-rated 4000 * 2000/5000
  assert.equal(rows[1].segment, 'balance');
  assert.equal(rows[1].tone, 'overdue');
  assert.equal(rows[1].amount, 3000);
  assert.equal(rows[1].penalty, 250);
  assert.ok(rows.every((r) => r.isSplit));
});

check('tone is red past due, green upcoming, white settled', () => {
  const rows = buildLedgerRows(
    [
      { id: 'a', instalmentNo: 1, dueDate: '2026-05-10', dueAmount: 5000, receivedAmount: 5000 },
      { id: 'b', instalmentNo: 2, dueDate: '2026-06-10', dueAmount: 5000, receivedAmount: 0 },
      { id: 'c', instalmentNo: 3, dueDate: '2026-07-10', dueAmount: 5000, receivedAmount: 0 },
    ],
    { asOf },
  );
  assert.deepEqual(rows.map((r) => r.tone), ['paid', 'overdue', 'upcoming']);
  assert.ok(rows.every((r) => !r.isSplit));
});

check('running balance walks down to zero', () => {
  const rows = buildLedgerRows(
    Array.from({ length: 4 }, (_, i) => ({
      id: `i${i}`,
      instalmentNo: i + 1,
      dueDate: `2026-0${i + 3}-10`,
      dueAmount: 5000,
      receivedAmount: 0,
    })),
    { asOf },
  );
  assert.equal(rows[rows.length - 1].runningBalance, 0);
  assert.equal(rows[0].runningBalance, 15000);
});

check('ledger totals bucket the money correctly', () => {
  const rows = buildLedgerRows(
    [
      { id: 'a', instalmentNo: 1, dueDate: '2026-05-10', dueAmount: 5000, receivedAmount: 5000 },
      { id: 'b', instalmentNo: 2, dueDate: '2026-06-10', dueAmount: 5000, receivedAmount: 1000, penaltyOutstanding: 100 },
      { id: 'c', instalmentNo: 3, dueDate: '2026-07-10', dueAmount: 5000, receivedAmount: 0 },
    ],
    { asOf },
  );
  const totals = summarizeLedger(rows);
  assert.equal(totals.totalPaid, 6000);
  assert.equal(totals.totalOverdue, 4000);
  assert.equal(totals.totalUpcoming, 5000);
  assert.equal(totals.totalPenalty, 100);
  assert.equal(totals.overdueRows, 1);
});

// ---------------------------------------------------------------------------
console.log('Daily operations');
// ---------------------------------------------------------------------------

check('time-of-day parser rejects junk', () => {
  assert.equal(parseTimeOfDay('08:30'), 510);
  assert.equal(parseTimeOfDay('9:05'), 545);
  assert.equal(parseTimeOfDay('24:00'), null);
  assert.equal(parseTimeOfDay('08:99'), null);
  assert.equal(parseTimeOfDay('nonsense'), null);
  assert.equal(parseTimeOfDay(null), null);
});

check('an unset window never blocks login', () => {
  assert.equal(checkLoginWindow({}).allowed, true);
  assert.equal(checkLoginWindow({ allowedLoginStart: '08:00' }).allowed, true);
});

check('login window enforces IST office hours', () => {
  const user = { allowedLoginStart: '08:00', allowedLoginEnd: '20:00' };
  // 12:00 IST = 06:30 UTC
  assert.equal(checkLoginWindow(user, new Date('2026-06-15T06:30:00Z')).allowed, true);
  // 06:00 IST = 00:30 UTC
  const early = checkLoginWindow(user, new Date('2026-06-15T00:30:00Z'));
  assert.equal(early.allowed, false);
  assert.match(early.message!, /08:00/);
});

check('a window spanning midnight works for night shifts', () => {
  const user = { allowedLoginStart: '22:00', allowedLoginEnd: '06:00' };
  // 23:00 IST = 17:30 UTC
  assert.equal(checkLoginWindow(user, new Date('2026-06-15T17:30:00Z')).allowed, true);
  // 02:00 IST = 20:30 UTC previous day
  assert.equal(checkLoginWindow(user, new Date('2026-06-14T20:30:00Z')).allowed, true);
  // 12:00 IST = 06:30 UTC
  assert.equal(checkLoginWindow(user, new Date('2026-06-15T06:30:00Z')).allowed, false);
});

check('day closing computes expected cash and variance', () => {
  const s = summarizeDayClosing({
    openingCash: 10000,
    collectedCash: 45000,
    disbursedCash: 20000,
    countedClosing: 34500,
  });
  assert.equal(s.expectedClosing, 35000);
  assert.equal(s.variance, -500);
  assert.equal(s.balanced, false);

  const ok = summarizeDayClosing({
    openingCash: 0, collectedCash: 100, disbursedCash: 0, countedClosing: 100,
  });
  assert.equal(ok.balanced, true);
});

check('the gate blocks until yesterday is closed', () => {
  const now = new Date('2026-06-15T06:00:00Z'); // 15 Jun IST
  const blocked = evaluateDayClosingGate([], now);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.pendingDate, '2026-06-14');

  const open = evaluateDayClosingGate(['2026-06-14'], now);
  assert.equal(open.blocked, false);
});

check('a brand-new workspace is not blocked on day one', () => {
  const now = new Date('2026-06-15T06:00:00Z');
  const gate = evaluateDayClosingGate([], now, '2026-06-15');
  assert.equal(gate.blocked, false);
});

check('business date follows IST, not UTC', () => {
  // 2026-06-15T19:00Z is already 16 Jun in IST (00:30).
  assert.equal(businessDateKey(new Date('2026-06-15T19:00:00Z')), '2026-06-16');
  assert.equal(businessDateKey(new Date('2026-06-15T06:00:00Z')), '2026-06-15');
});

console.log(`\nAuto Finance HP: ${passed} checks passed.`);
