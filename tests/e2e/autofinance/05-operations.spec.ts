import { expect, test } from '@playwright/test';
import {
  planWaterfallAllocation,
  summarizeWaterfallByInstalment,
  calculateSettlementQuote,
} from '../../../lib/autofinance/allocation';
import { buildLedgerRows } from '../../../lib/autofinance/ledger';
import {
  checkLoginWindow,
  summarizeDayClosing,
  evaluateDayClosingGate,
  businessDateKey,
  parseTimeOfDay,
} from '../../../lib/autofinance/operations';

/**
 * Field operations: the collection waterfall, the settlement quote, the due
 * chart, the login window and the day-closing gate.
 *
 * All five are pure helpers by design — the callers hand in the stored values
 * so the rules can be tested without a database. That is what makes it possible
 * to assert the exact rupee that lands on each bucket, which is the whole point
 * of a waterfall: an agent types one lump sum and the borrower is entitled to
 * know precisely where it went.
 *
 * Waterfall fixture (EMI 20666.67):
 *   #1 overdue, nothing paid, 500 penalty outstanding
 *   #2 overdue, nothing paid
 *   #3 upcoming
 */

const EMI = 20_666.67;
const ASOF = new Date('2026-06-15T00:00:00.000Z');

const instalments = (over: Array<Partial<Record<string, unknown>>> = []) =>
  [
    { id: 'i1', instalmentNo: 1, dueDate: '2026-04-15', dueAmount: EMI, receivedAmount: 0, penaltyOutstanding: 500 },
    { id: 'i2', instalmentNo: 2, dueDate: '2026-05-15', dueAmount: EMI, receivedAmount: 0 },
    { id: 'i3', instalmentNo: 3, dueDate: '2026-07-15', dueAmount: EMI, receivedAmount: 0 },
  ].map((row, i) => ({ ...row, ...(over[i] ?? {}) })) as any;

const plan = (amount: number, rows = instalments()) => planWaterfallAllocation(rows, amount, ASOF);

// ── Waterfall ───────────────────────────────────────────────────────────────
test('[AUTO-270] A lump sum settles the oldest overdue row first', () => {
  const p = plan(25_000);

  expect(p.penaltyPaid, 'the 500 penalty on instalment 1 goes first').toBe(500);
  expect(p.duePaid, 'the rest lands on dues').toBe(24_500);
  expect(p.instalmentsCleared, 'instalment 1 is settled in full').toBe(1);
  expect(p.penaltiesCleared).toBe(1);

  const byInstalment = summarizeWaterfallByInstalment(p);
  const first = byInstalment.find((r) => r.instalmentId === 'i1')!;
  const second = byInstalment.find((r) => r.instalmentId === 'i2')!;

  expect(first.penaltyApplied).toBe(500);
  expect(first.dueApplied).toBe(EMI);
  expect(second.dueApplied, '25000 − 500 − 20666.67').toBe(3_833.33);
  expect(byInstalment.find((r) => r.instalmentId === 'i3'), 'the upcoming row is not reached').toBeUndefined();
});

test('[AUTO-271] Penalty on a row is cleared before the instalment itself', () => {
  const p = plan(500);
  expect(p.penaltyPaid).toBe(500);
  expect(p.duePaid, 'the instalment is untouched').toBe(0);
  expect(p.instalmentsCleared).toBe(0);
});

test('[AUTO-272] Overdue rows are taken before upcoming ones whatever their number', () => {
  // Instalment 3 is the only overdue row; 1 and 2 are in the future.
  const rows = instalments([
    { dueDate: '2026-08-15', penaltyOutstanding: 0 },
    { dueDate: '2026-09-15' },
    { dueDate: '2026-05-15' },
  ]);
  const p = planWaterfallAllocation(rows, EMI, ASOF);

  const applied = summarizeWaterfallByInstalment(p);
  expect(applied, 'exactly one row was paid').toHaveLength(1);
  expect(applied[0].instalmentId, 'the overdue row, not the lowest number').toBe('i3');
});

test('[AUTO-273] Money left after every row is settled is reported as unapplied', () => {
  const p = plan(100_000);
  const totalOutstanding = 500 + EMI * 3;

  expect(p.unapplied, 'the exact remainder is surfaced as an advance').toBe(
    Math.round((100_000 - totalOutstanding) * 100) / 100,
  );
  expect(p.remainingOutstanding, 'nothing is left owing').toBe(0);
  expect(p.instalmentsCleared).toBe(3);
});

test('[AUTO-274] A partial payment leaves an honest outstandingAfter on the row it stopped at', () => {
  const p = plan(25_000);
  const stopped = p.lines.find((l) => l.instalmentId === 'i2' && l.bucket === 'due')!;

  expect(stopped.outstandingAfter, '20666.67 − 3833.33').toBe(16_833.34);
  expect(stopped.cleared).toBe(false);

  const summed = p.lines.reduce((sum, l) => sum + l.outstandingAfter, 0);
  expect(Math.round(summed * 100) / 100, 'remainingOutstanding is the sum of every line').toBe(p.remainingOutstanding);
});

test('[AUTO-275] A waived row is skipped entirely', () => {
  const rows = instalments([{ status: 'waived' }]);
  const p = planWaterfallAllocation(rows, 25_000, ASOF);

  expect(p.lines.some((l) => l.instalmentId === 'i1'), 'no line for the waived row').toBe(false);
  expect(p.penaltyPaid, 'and its penalty is not collected either').toBe(0);
  expect(summarizeWaterfallByInstalment(p)[0].instalmentId, 'the money starts at instalment 2').toBe('i2');
});

test('[AUTO-276] A zero or negative offer plans nothing', () => {
  for (const amount of [0, -500]) {
    const p = plan(amount);
    expect(p.lines.every((l) => l.applied === 0), `offer ${amount}`).toBe(true);
    expect(p.penaltyPaid).toBe(0);
    expect(p.duePaid).toBe(0);
    expect(p.unapplied, 'a negative offer never becomes an advance').toBe(0);
  }
});

// ── Settlement ──────────────────────────────────────────────────────────────
const SETTLE = {
  principalOutstanding: 200_000,
  interestOutstanding: 30_000,
  penaltyOutstanding: 5_000,
  chargesOutstanding: 2_000,
};

test('[AUTO-300] A settlement quote totals every outstanding head', () => {
  const q = calculateSettlementQuote(SETTLE);
  expect(q.finalSettlementAmount).toBe(237_000);
  expect(q.totalDiscount).toBe(0);
  expect(
    [q.principalOutstanding, q.interestOutstanding, q.penaltyOutstanding, q.chargesOutstanding],
    'each head is reported separately so the customer can see what they are paying',
  ).toEqual([200_000, 30_000, 5_000, 2_000]);
});

test('[AUTO-301] A discount can never exceed the head it is applied against', () => {
  const q = calculateSettlementQuote({ ...SETTLE, interestDiscount: 40_000 });
  expect(q.interestDiscount, 'clamped to the interest actually outstanding').toBe(30_000);
  expect(q.finalSettlementAmount, 'never below principal plus charges plus penalty').toBe(207_000);
});

test('[AUTO-302] Interest and penalty discounts are applied to their own heads', () => {
  const q = calculateSettlementQuote({ ...SETTLE, interestDiscount: 10_000, penaltyDiscount: 1_000 });
  expect(q.interestDiscount).toBe(10_000);
  expect(q.penaltyDiscount).toBe(1_000);
  expect(q.totalDiscount).toBe(11_000);
  expect(q.finalSettlementAmount).toBe(226_000);
});

test('[AUTO-303] A negative discount is treated as zero', () => {
  const q = calculateSettlementQuote({ ...SETTLE, interestDiscount: -5_000, penaltyDiscount: -1_000 });
  expect(q.totalDiscount, 'a negative discount never inflates the settlement').toBe(0);
  expect(q.finalSettlementAmount).toBe(237_000);
});

test('[AUTO-308] Quoting a settlement twice gives the same figure', () => {
  const a = calculateSettlementQuote({ ...SETTLE, interestDiscount: 5_000 });
  const b = calculateSettlementQuote({ ...SETTLE, interestDiscount: 5_000 });
  expect(a).toEqual(b);
});

// ── Due chart ───────────────────────────────────────────────────────────────
const ledgerInput = [
  {
    id: 'l1', instalmentNo: 1, dueDate: '2026-04-15', dueAmount: EMI, receivedAmount: EMI,
    receivedAt: '2026-04-16', receiptNo: 'RC-001', paymentMode: 'cash',
    principalComponent: 16_666.67, interestComponent: 4_000,
  },
  {
    id: 'l2', instalmentNo: 2, dueDate: '2026-05-15', dueAmount: EMI, receivedAmount: 0,
    principalComponent: 16_666.67, interestComponent: 4_000, penaltyOutstanding: 250,
  },
  {
    id: 'l3', instalmentNo: 3, dueDate: '2026-07-15', dueAmount: EMI, receivedAmount: 0,
    principalComponent: 16_666.67, interestComponent: 4_000,
  },
];

test('[AUTO-320] [AUTO-321] [AUTO-322] Each row reads as paid, overdue or upcoming', () => {
  const rows = buildLedgerRows(ledgerInput as any, { asOf: ASOF });

  const first = rows.find((r) => r.instalmentNo === 1)!;
  expect(first.tone).toBe('paid');
  expect(first.segment).toBe('full');
  expect(first.receiptNo).toBe('RC-001');
  expect(first.paymentMode).toBe('cash');

  expect(rows.find((r) => r.instalmentNo === 2)!.tone, 'past its date and unpaid').toBe('overdue');
  expect(rows.find((r) => r.instalmentNo === 3)!.tone, 'still in the future').toBe('upcoming');
});

test('[AUTO-323] [AUTO-324] A partly paid instalment is two rows that split pro-rata', () => {
  const partial = ledgerInput.map((row) =>
    row.id === 'l2' ? { ...row, receivedAmount: 10_333.34 } : row,
  );
  const rows = buildLedgerRows(partial as any, { asOf: ASOF });
  const halves = rows.filter((r) => r.instalmentNo === 2);

  expect(halves, 'one white row and one red row on the same date').toHaveLength(2);
  expect(halves.map((r) => r.segment)).toEqual(['paid', 'balance']);
  expect(halves.every((r) => r.isSplit)).toBe(true);
  expect(halves[0].dueDate.getTime(), 'both carry the same due date').toBe(halves[1].dueDate.getTime());

  const principal = Math.round((halves[0].principal + halves[1].principal) * 100) / 100;
  const interest = Math.round((halves[0].interest + halves[1].interest) * 100) / 100;
  expect(principal, 'the halves sum back to the instalment’s own components').toBeCloseTo(16_666.67, 1);
  expect(interest, 'neither half is given the whole interest').toBeCloseTo(4_000, 1);
});

test('[AUTO-325] The running balance falls down the chart', () => {
  const rows = buildLedgerRows(ledgerInput as any, { asOf: ASOF });
  for (let i = 1; i < rows.length; i++) {
    expect(rows[i].runningBalance, `row ${i + 1}`).toBeLessThanOrEqual(rows[i - 1].runningBalance);
  }
  expect(rows[rows.length - 1].runningBalance).toBeGreaterThanOrEqual(0);
});

test('[AUTO-326] Penalty outstanding is shown on the row it belongs to', () => {
  const rows = buildLedgerRows(ledgerInput as any, { asOf: ASOF });
  const penalised = rows.filter((r) => r.penalty > 0);

  expect(penalised, 'exactly one row carries the charge').toHaveLength(1);
  expect(penalised[0].instalmentNo, 'the row it accrued against, not a floating charge').toBe(2);
  expect(penalised[0].penalty).toBe(250);
});

// ── Login window ────────────────────────────────────────────────────────────
/** An instant at the given IST wall-clock time, as a UTC Date. */
const ist = (hh: number, mm = 0) => new Date(Date.UTC(2026, 5, 15, hh, mm) - 5.5 * 60 * 60 * 1000);

test('[AUTO-380] A user with no window set can log in at any time', () => {
  for (const at of [ist(3), ist(12), ist(23)]) {
    expect(checkLoginWindow({}, at).allowed, 'the default is no restriction').toBe(true);
  }
});

test('[AUTO-381] An agent inside their window is allowed', () => {
  const result = checkLoginWindow({ allowedLoginStart: '08:00', allowedLoginEnd: '20:00' }, ist(9));
  expect(result.allowed).toBe(true);
  expect(result.message, 'nothing to say when the answer is yes').toBeNull();
});

test('[AUTO-382] An agent outside their window is refused with the window quoted', () => {
  const result = checkLoginWindow({ allowedLoginStart: '08:00', allowedLoginEnd: '20:00' }, ist(21));
  expect(result.allowed).toBe(false);
  expect(result.message, 'the agent is told when to try again').toContain('08:00–20:00');
});

test('[AUTO-383] A window that spans midnight is honoured', () => {
  const night = { allowedLoginStart: '22:00', allowedLoginEnd: '06:00' };
  expect(checkLoginWindow(night, ist(23)).allowed, 'a night recovery shift is a real shift').toBe(true);
  expect(checkLoginWindow(night, ist(3)).allowed).toBe(true);
  expect(checkLoginWindow(night, ist(7)).allowed).toBe(false);
});

test('[AUTO-384] The window boundaries are inclusive', () => {
  const day = { allowedLoginStart: '08:00', allowedLoginEnd: '20:00' };
  expect(checkLoginWindow(day, ist(8, 0)).allowed).toBe(true);
  expect(checkLoginWindow(day, ist(20, 0)).allowed).toBe(true);
  expect(checkLoginWindow(day, ist(20, 1)).allowed).toBe(false);
});

test('[AUTO-385] A half-configured window does not lock anyone out', () => {
  expect(checkLoginWindow({ allowedLoginStart: '08:00' }, ist(0)).allowed).toBe(true);
  expect(checkLoginWindow({ allowedLoginEnd: '20:00' }, ist(23)).allowed).toBe(true);
});

test('[AUTO-386] A malformed window value disables the restriction rather than misapplying it', () => {
  expect(parseTimeOfDay('25:00'), 'an out-of-range hour does not parse').toBeNull();
  expect(parseTimeOfDay('8:5'), 'nor does a missing minute digit').toBeNull();

  const result = checkLoginWindow({ allowedLoginStart: '25:00', allowedLoginEnd: '20:00' }, ist(23));
  expect(
    result.allowed,
    'the check fails open — so a typo in a restriction silently removes it, and whoever set it is never told',
  ).toBe(true);
  expect(result.window, 'and nothing is reported back about the window at all').toBeNull();
});

test('[AUTO-389] The window is evaluated in IST, not in the server’s timezone', () => {
  // 23:00 UTC is 04:30 IST the next day — inside a 00:00–06:00 window.
  const at = new Date(Date.UTC(2026, 5, 15, 23, 0));
  const result = checkLoginWindow({ allowedLoginStart: '00:00', allowedLoginEnd: '06:00' }, at);
  expect(result.allowed, 'the business day is the Indian business day').toBe(true);
});

// ── Day closing ─────────────────────────────────────────────────────────────
const DAY = { openingCash: 10_000, collectedCash: 50_000, disbursedCash: 20_000 };

test('[AUTO-405] The expected closing cash is opening plus collected less disbursed', () => {
  expect(summarizeDayClosing({ ...DAY, countedClosing: 40_000 }).expectedClosing).toBe(40_000);
});

test('[AUTO-406] A counted total that matches balances the day', () => {
  const s = summarizeDayClosing({ ...DAY, countedClosing: 40_000 });
  expect(s.variance).toBe(0);
  expect(s.balanced).toBe(true);
});

test('[AUTO-407] A short count is reported as a negative variance', () => {
  const s = summarizeDayClosing({ ...DAY, countedClosing: 39_500 });
  expect(s.variance).toBe(-500);
  expect(s.balanced, 'the shortfall is surfaced, never absorbed').toBe(false);
});

test('[AUTO-408] Sub-rupee drift does not block a close', () => {
  const s = summarizeDayClosing({ ...DAY, countedClosing: 39_999.5 });
  expect(s.variance).toBe(-0.5);
  expect(s.balanced, 'decimal rounding is not a cash shortage').toBe(true);
});

test('[AUTO-409] An excess count is reported too', () => {
  const s = summarizeDayClosing({ ...DAY, countedClosing: 40_500 });
  expect(s.variance).toBe(500);
  expect(s.balanced, 'cash over is as much a discrepancy as cash short').toBe(false);
});

test('[AUTO-410] Staff are blocked until the previous business day is closed', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const gate = evaluateDayClosingGate([], now);

  expect(gate.blocked).toBe(true);
  expect(gate.pendingDate, 'the operator is told exactly which date to close').toBe(
    businessDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  );
  expect(gate.message).toContain(gate.pendingDate!);
});

test('[AUTO-411] Closing yesterday lifts the block', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const yesterday = businessDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const gate = evaluateDayClosingGate([yesterday], now);

  expect(gate.blocked).toBe(false);
  expect(gate.pendingDate).toBeNull();
});

test('[AUTO-412] A brand-new workspace is not blocked on its first day', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const gate = evaluateDayClosingGate([], now, businessDateKey(now));

  expect(gate.blocked, 'days before the tenant existed never needed closing').toBe(false);
});

test('[AUTO-413] The business date rolls over at IST midnight', () => {
  // 18:29 UTC is 23:59 IST; 18:31 UTC is 00:01 IST the next day.
  expect(businessDateKey(new Date(Date.UTC(2026, 5, 15, 18, 29)))).toBe('2026-06-15');
  expect(businessDateKey(new Date(Date.UTC(2026, 5, 15, 18, 31))), 'not at UTC midnight').toBe('2026-06-16');
});
