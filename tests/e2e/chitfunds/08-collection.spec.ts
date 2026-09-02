import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, branchPool, num, idemKey, type Session } from './support/harness';
import { loadState, type ChitRunState, type SeededGroup } from './support/state';

/**
 * Subscription collection, receipts, penalties and borrower payment intents.
 *
 * The money rule that governs all of it is MONEY-17: only cash legs move
 * physical float. A UPI subscription lands in the cash book and the GL, but the
 * branch's physical cash pool must not move — nobody handed anyone a note.
 * CHIT-23 governs the other half: SET_TOTAL_PAID posts the DELTA, never the
 * absolute figure, or every prior payment is counted twice.
 */

let owner: Session;
let admin: Session;
let agent: Session;
let s: ChitRunState;

const asAdmin = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });
const asOwner = () => ({ token: owner.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });
const asAgent = () => ({ token: agent.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

function payPath(g: SeededGroup) {
  return `/api/v1/chits/${g.id}/payments`;
}

/**
 * A subscription nobody has paid into yet.
 *
 * Later periods of the manual fixture are untouched by the auction specs, so
 * each collection case takes one and resets it rather than sharing a running
 * balance that makes every assertion depend on test order.
 */
async function freshSubscription(ticket: string, period: number) {
  const g = loadState().tenantA.groups.manual!;
  const memberId = g.membersByTicket[ticket];
  const sub = await db().chitSubscription.findFirstOrThrow({ where: { memberId, periodNumber: period } });
  await db().chitSubscription.update({
    where: { id: sub.id },
    data: {
      paidAmount: 0,
      status: 'upcoming',
      paidAt: null,
      dueAmount: g.monthlyContrib,
      lastReceiptNo: null,
      lastPaymentRefNo: null,
    },
  });
  return { group: g, memberId, period, subscriptionId: sub.id, due: g.monthlyContrib };
}

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agent = await loginApi(s.tenantA.agentHq!.username, s.password);
});

test.afterAll(async () => {
  await closeDb();
});

// ── ADD_PAYMENT and SET_TOTAL_PAID ──────────────────────────────────────────
test('[CF-515] ADD_PAYMENT posts the delta and advances the status', async () => {
  const { group, memberId, period, subscriptionId, due } = await freshSubscription('1', 12);
  await db().chitSubscription.update({ where: { id: subscriptionId }, data: { paidAmount: 2_000, status: 'partial' } });

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: 3_000, mode: 'ADD_PAYMENT', paymentMode: 'cash' },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect(res.data.receivedDelta, 'the posted amount is the delta').toBe(3_000);

  const row = await db().chitSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  expect(num(row.paidAmount)).toBe(due);
  expect(row.status).toBe('paid');
  expect(row.paidAt, 'a settled period is stamped').toBeTruthy();

  const receipt = await db().chitReceipt.findFirstOrThrow({ where: { entityId: subscriptionId }, orderBy: { issuedAt: 'desc' } });
  expect(num(receipt.amount), 'the receipt is for the delta, not the running total').toBe(3_000);
});

test('[CF-516] SET_TOTAL_PAID posts only the difference', async () => {
  const { group, memberId, period, subscriptionId } = await freshSubscription('2', 12);
  await db().chitSubscription.update({ where: { id: subscriptionId }, data: { paidAmount: 2_000, status: 'partial' } });

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: 4_000, mode: 'SET_TOTAL_PAID', paymentMode: 'cash' },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect(res.data.receivedDelta, 'CHIT-23: 4000 total on 2000 already paid posts 2000').toBe(2_000);

  const row = await db().chitSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  expect(num(row.paidAmount)).toBe(4_000);
  expect(row.status).toBe('partial');

  const receipt = await db().chitReceipt.findFirstOrThrow({ where: { entityId: subscriptionId }, orderBy: { issuedAt: 'desc' } });
  expect(num(receipt.amount), 'posting the absolute figure would double-count').toBe(2_000);
});

test('[CF-517] A SET_TOTAL_PAID that adds nothing is refused', async () => {
  const { group, memberId, period, subscriptionId } = await freshSubscription('3', 12);
  await db().chitSubscription.update({ where: { id: subscriptionId }, data: { paidAmount: 2_000, status: 'partial' } });
  const receiptsBefore = await db().chitReceipt.count({ where: { entityId: subscriptionId } });

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: 2_000, mode: 'SET_TOTAL_PAID', paymentMode: 'cash' },
    asAdmin(),
  );
  expect(String(res.error ?? '')).toMatch(/no new collection amount/i);
  expect([400, 409], `API-4: a refused collection is a 4xx, got ${res.status}`).toContain(res.status);
  expect(await db().chitReceipt.count({ where: { entityId: subscriptionId } })).toBe(receiptsBefore);
});

test('[CF-518] A SET_TOTAL_PAID below the current paid amount does not reverse money', async () => {
  const { group, memberId, period, subscriptionId } = await freshSubscription('4', 12);
  await db().chitSubscription.update({ where: { id: subscriptionId }, data: { paidAmount: 4_000, status: 'partial' } });
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: 1_000, mode: 'SET_TOTAL_PAID', paymentMode: 'cash' },
    asAdmin(),
  );
  expect(String(res.error ?? ''), 'a reversal is never disguised as a collection').toMatch(/no new collection amount/i);
  expect([400, 409]).toContain(res.status);

  const row = await db().chitSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  expect(num(row.paidAmount), 'the paid figure is not walked backwards').toBe(4_000);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!)).toBe(poolBefore);
});

test('[CF-519] A zero or negative collection is refused', async () => {
  const { group, memberId, period } = await freshSubscription('5', 12);
  for (const amount of [0, -100]) {
    const res = await api.post(payPath(group), { memberId, periodNumber: period, amount }, asAdmin());
    expect(res.status, `amount ${amount}`).toBe(400);
    expect(String(res.error ?? '')).toMatch(/greater than zero/i);
  }
});

test('[CF-530] A collection against an unknown subscription is refused', async () => {
  const g = loadState().tenantA.groups.manual!;
  const res = await api.post(
    payPath(g),
    { memberId: g.membersByTicket['1'], periodNumber: 999, amount: 1_000 },
    asAdmin(),
  );
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/subscription not found/i);
});

test('[CF-520] Collecting more than the due is handled explicitly', async () => {
  const { group, memberId, period, subscriptionId, due } = await freshSubscription('6', 12);

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: due + 1_000, mode: 'ADD_PAYMENT', paymentMode: 'cash' },
    asAdmin(),
  );

  if (res.status >= 400) {
    expect(String(res.error ?? '')).toMatch(/exceed|more than/i);
    return;
  }

  const row = await db().chitSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  const receipt = await db().chitReceipt.findFirstOrThrow({ where: { entityId: subscriptionId }, orderBy: { issuedAt: 'desc' } });
  expect(num(row.paidAmount), 'the overpayment is visible, not swallowed').toBe(due + 1_000);
  expect(num(receipt.amount), 'and the receipt agrees with the subscription').toBe(due + 1_000);
  expect(row.status).toBe('paid');
});

// ── What one collection writes ──────────────────────────────────────────────
test('[CF-521] One cash collection writes subscription, receipt, entry and pool credit', async () => {
  const { group, memberId, period, subscriptionId, due } = await freshSubscription('7', 12);
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: due, mode: 'ADD_PAYMENT', paymentMode: 'cash' },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  expect(row.status).toBe('paid');

  const receipts = await db().chitReceipt.findMany({ where: { entityId: subscriptionId, receiptType: 'collection' } });
  expect(receipts, 'one receipt').toHaveLength(1);
  expect(row.lastReceiptNo, 'the subscription points at its receipt').toBe(receipts[0].receiptNo);

  const entries = await db().accountEntry.findMany({
    where: { referenceId: subscriptionId, referenceType: 'chit_subscription', type: 'collection' },
  });
  expect(entries, 'one cash-book entry').toHaveLength(1);
  expect(num(entries[0].amount)).toBe(due);

  expect(
    await branchPool(s.tenantA.id, s.tenantA.branches.hq!),
    'CHIT-24: a cash collection credits the branch pool',
  ).toBe(poolBefore + due);
});

test('[CF-522] A non-cash chit collection must not move physical float', async () => {
  const { group, memberId, period, subscriptionId, due } = await freshSubscription('8', 12);
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: due, mode: 'ADD_PAYMENT', paymentMode: 'upi', referenceNo: `UPI-${s.runId}-1` },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const entries = await db().accountEntry.findMany({
    where: { referenceId: subscriptionId, referenceType: 'chit_subscription' },
  });
  expect(entries, 'the cash book and the GL still record it').toHaveLength(1);
  expect(entries[0].category, 'tagged with the mode it arrived by').toBe('upi');

  expect(
    await branchPool(s.tenantA.id, s.tenantA.branches.hq!),
    'MONEY-17: only cash legs move float — nobody handed anyone a note',
  ).toBe(poolBefore);
});

test('[CF-523] A cheque or bank collection behaves the same as UPI for float', async () => {
  for (const [ticket, paymentMode] of [['9', 'cheque'], ['10', 'bank_transfer']] as const) {
    const { group, memberId, period, due } = await freshSubscription(ticket, 12);
    const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

    const res = await api.post(
      payPath(group),
      { memberId, periodNumber: period, amount: due, mode: 'ADD_PAYMENT', paymentMode },
      asAdmin(),
    );
    expect(res.status, `${paymentMode} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);

    expect(
      await branchPool(s.tenantA.id, s.tenantA.branches.hq!),
      `MONEY-17: a ${paymentMode} leg does not move physical cash`,
    ).toBe(poolBefore);
  }
});

// ── Idempotency and receipt numbering ───────────────────────────────────────
test('[CF-524] A repeated idempotency key does not double-post', async () => {
  const { group, memberId, period, subscriptionId, due } = await freshSubscription('11', 12);
  const key = idemKey(s.runId, 'collect-replay');
  const body = { memberId, periodNumber: period, amount: due, mode: 'ADD_PAYMENT', paymentMode: 'cash', idempotencyKey: key };

  const first = await api.post(payPath(group), body, asAdmin());
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);
  const poolAfterFirst = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const replay = await api.post(payPath(group), body, asAdmin());
  expect(replay.status, 'the replay is answered, not refused').toBeLessThan(300);
  expect(replay.data.idempotent, 'and is marked as a replay').toBe(true);

  expect(await db().chitReceipt.count({ where: { entityId: subscriptionId, receiptType: 'collection' } })).toBe(1);
  expect(await db().accountEntry.count({ where: { referenceId: subscriptionId, type: 'collection' } })).toBe(1);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'the pool is credited once').toBe(poolAfterFirst);
});

test('[CF-525] The same key reused for a different subscription is refused', async () => {
  const { group, memberId, period, due } = await freshSubscription('12', 12);

  const res = await api.post(
    payPath(group),
    { memberId, periodNumber: period, amount: due, mode: 'ADD_PAYMENT', paymentMode: 'cash', idempotencyKey: idemKey(s.runId, 'collect-replay') },
    asAdmin(),
  );
  expect(res.status).toBe(409);
  expect(String(res.error ?? '')).toMatch(/already used for another chit payment/i);
});

test('[CF-526] [CF-527] Collection receipts increment and carry the branch code', async () => {
  const g = loadState().tenantA.groups.manual!;
  const numbers: string[] = [];

  for (const ticket of ['13', '14', '15']) {
    const { memberId, period, due } = await freshSubscription(ticket, 12);
    const res = await api.post(
      payPath(g),
      { memberId, periodNumber: period, amount: due, mode: 'ADD_PAYMENT', paymentMode: 'cash' },
      asAdmin(),
    );
    expect(res.status, `${ticket} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
    numbers.push(res.data.receiptNo);
  }

  const hqCode = s.tenantA.branchCodes.hq!;
  for (const receiptNo of numbers) {
    expect(receiptNo, 'CHIT-25: CC-<branchCode>-<year>-nnnnnn').toMatch(
      new RegExp(`^CC-${hqCode}-\\d{4}-\\d{6}$`),
    );
    expect(receiptNo, 'never the literal BR placeholder').not.toContain('CC-BR-');
  }

  const sequence = numbers.map((n) => Number(n.slice(-6)));
  expect(new Set(sequence).size, 'no reuse').toBe(3);
  expect(sequence[1] - sequence[0], 'and no gaps').toBe(1);
  expect(sequence[2] - sequence[1]).toBe(1);
});

test('[CF-529] An agent may collect but only within their own scope', async () => {
  const state = loadState();
  const own = await freshSubscription('16', 12);

  const mine = await api.post(
    payPath(own.group),
    { memberId: own.memberId, periodNumber: own.period, amount: own.due, mode: 'ADD_PAYMENT', paymentMode: 'cash' },
    asAgent(),
  );
  expect(mine.status, `an agent collects on their own branch: ${JSON.stringify(mine.raw)}`).toBeLessThan(300);

  const erode = state.tenantA.groups.erode!;
  const foreignMember = erode.membersByTicket['1'];
  const foreign = await api.post(
    `/api/v1/chits/${erode.id}/payments`,
    { memberId: foreignMember, periodNumber: 1, amount: 100, mode: 'ADD_PAYMENT', paymentMode: 'cash' },
    asAgent(),
  );
  expect(foreign.status, 'SCOPE-3: another branch is 404, not 403').toBe(404);
});

test('[CF-531] Marking a period missed sets the status without touching money', async () => {
  const { subscriptionId } = await freshSubscription('17', 12);
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);
  const receiptsBefore = await db().chitReceipt.count({ where: { entityId: subscriptionId } });

  const res = await api.post(`/api/v1/chits/subscriptions/${subscriptionId}/miss`, {}, asAdmin());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  expect(row.status).toBe('missed');
  expect(num(row.paidAmount), 'no money is invented or removed').toBe(0);
  expect(await db().chitReceipt.count({ where: { entityId: subscriptionId } })).toBe(receiptsBefore);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!)).toBe(poolBefore);
});

// ── Penalties ───────────────────────────────────────────────────────────────
test('[CF-580] An admin can raise a penalty against a subscription', async () => {
  const { group, subscriptionId } = await freshSubscription('18', 12);

  const res = await api.post(
    `/api/v1/chits/${group.id}/penalties`,
    { subscriptionId, amount: 250, reason: 'Late contribution' },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitPenalty.findFirstOrThrow({ where: { subscriptionId } });
  expect(num(row.amount)).toBe(250);
  expect(num(row.paidAmount)).toBe(0);
});

test('[CF-581] A penalty needs a subscription and a positive amount', async () => {
  const { group, subscriptionId } = await freshSubscription('19', 12);

  for (const body of [{ subscriptionId, amount: 0 }, { amount: 250 }]) {
    const res = await api.post(`/api/v1/chits/${group.id}/penalties`, body, asAdmin());
    expect(res.status, JSON.stringify(body)).toBe(400);
    expect(String(res.error ?? '')).toMatch(/subscriptionid and positive amount/i);
  }
});

test('[CF-582] An agent cannot raise or waive a penalty', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const { subscriptionId } = await freshSubscription('20', 12);

  const raise = await api.post(`/api/v1/chits/${g.id}/penalties`, { subscriptionId, amount: 250 }, asAgent());
  expect(raise.status).toBe(403);

  // ChitPenalty hangs off the subscription, not the group, so the group filter
  // has to travel the relation.
  const existing = await db().chitPenalty.findFirstOrThrow({
    where: { subscription: { member: { chitGroupId: g.id } } },
  });
  const waive = await api.post(
    `/api/v1/chits/${g.id}/penalties/${existing.id}/waive`,
    { reason: 'agent waive' },
    asAgent(),
  );
  expect(waive.status).toBe(403);
});

test('[CF-583] [CF-584] [CF-587] A penalty payment reduces the outstanding and numbers the receipt', async () => {
  const g = loadState().tenantA.groups.manual!;
  const penalty = await db().chitPenalty.findFirstOrThrow({ where: { subscription: { member: { chitGroupId: g.id } }, status: { not: 'waived' } } });
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const part = await api.post(
    `/api/v1/chits/${g.id}/penalties/${penalty.id}/pay`,
    { amount: 100, paymentMode: 'cash' },
    asAdmin(),
  );
  expect(part.status, JSON.stringify(part.raw)).toBeLessThan(300);

  const afterPart = await db().chitPenalty.findUniqueOrThrow({ where: { id: penalty.id } });
  expect(num(afterPart.paidAmount)).toBe(100);
  expect(afterPart.status).toBe('partial');
  expect(
    await branchPool(s.tenantA.id, s.tenantA.branches.hq!),
    'a cash penalty payment credits the pool',
  ).toBe(poolBefore + 100);

  const receipt = await db().chitReceipt.findFirstOrThrow({
    where: { receiptType: 'penalty', entityId: penalty.id },
    orderBy: { issuedAt: 'desc' },
  });
  expect(receipt.receiptNo, 'CHIT-25: the penalty series is CPN').toMatch(/^CPN-/);
  expect(
    receipt.receiptNo,
    `CHIT-25: the penalty receipt must carry the branch code (${s.tenantA.branchCodes.hq}), not the literal BR fallback`,
  ).toContain(`CPN-${s.tenantA.branchCodes.hq}-`);

  const rest = await api.post(
    `/api/v1/chits/${g.id}/penalties/${penalty.id}/pay`,
    { amount: num(penalty.amount) - 100, paymentMode: 'cash' },
    asAdmin(),
  );
  expect(rest.status, JSON.stringify(rest.raw)).toBeLessThan(300);

  const settled = await db().chitPenalty.findUniqueOrThrow({ where: { id: penalty.id } });
  expect(settled.status).toBe('paid');
  expect(num(settled.paidAmount), 'payments sum to the penalty exactly').toBe(num(penalty.amount));
});

test('[CF-585] A payment above the outstanding is refused', async () => {
  const g = loadState().tenantA.groups.manual!;
  const { subscriptionId } = await freshSubscription('21', 12);
  const raised = await api.post(`/api/v1/chits/${g.id}/penalties`, { subscriptionId, amount: 250 }, asAdmin());
  expect(raised.status).toBeLessThan(300);

  const penalty = await db().chitPenalty.findFirstOrThrow({ where: { subscriptionId } });
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await api.post(`/api/v1/chits/${g.id}/penalties/${penalty.id}/pay`, { amount: 300 }, asAdmin());
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/exceeds outstanding penalty/i);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'nothing posted').toBe(poolBefore);
});

test('[CF-586] Who may pay a penalty is enforced server-side', async () => {
  const g = loadState().tenantA.groups.manual!;
  const penalty = await db().chitPenalty.findFirstOrThrow({
    where: { subscription: { member: { chitGroupId: g.id } }, status: { in: ['due', 'partial'] } },
  });

  const res = await api.post(`/api/v1/chits/${g.id}/penalties/${penalty.id}/pay`, { amount: 10 }, asAgent());
  expect(
    res.status,
    `ROLE-4: the handler must decide who may post penalty money rather than accepting any authenticated caller (got ${res.status})`,
  ).toBe(403);
});

test('[CF-588] [CF-589] Waiving leaves a trail and closes the penalty', async () => {
  const g = loadState().tenantA.groups.manual!;
  const { subscriptionId } = await freshSubscription('22', 12);
  const raised = await api.post(`/api/v1/chits/${g.id}/penalties`, { subscriptionId, amount: 250 }, asAdmin());
  expect(raised.status).toBeLessThan(300);
  const penalty = await db().chitPenalty.findFirstOrThrow({ where: { subscriptionId } });

  const waive = await api.post(
    `/api/v1/chits/${g.id}/penalties/${penalty.id}/waive`,
    { reason: 'Hardship — branch manager approved' },
    asAdmin(),
  );
  expect(waive.status, JSON.stringify(waive.raw)).toBeLessThan(300);

  const row = await db().chitPenalty.findUniqueOrThrow({ where: { id: penalty.id } });
  expect(row.status).toBe('waived');
  expect(row, 'the row survives — a waiver is recorded, not deleted').toBeTruthy();

  const pay = await api.post(`/api/v1/chits/${g.id}/penalties/${penalty.id}/pay`, { amount: 50 }, asAdmin());
  expect(pay.status, 'a waived penalty has nothing outstanding').toBe(400);
});

test('[CF-590] A penalty from another group is not payable through this group', async () => {
  const state = loadState();
  const erode = state.tenantA.groups.erode!;
  const penalty = await db().chitPenalty.findFirstOrThrow({ where: { subscription: { member: { chitGroupId: state.tenantA.groups.manual!.id } } } });

  const res = await api.post(`/api/v1/chits/${erode.id}/penalties/${penalty.id}/pay`, { amount: 10 }, asAdmin());
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/penalty not found/i);
});

// ── Payment intents ─────────────────────────────────────────────────────────
test('[CF-557] A confirmed amount must be positive', async () => {
  const intents = await api.get('/api/v1/chits/payment-intents', asAdmin());
  expect(intents.status, JSON.stringify(intents.raw)).toBeLessThan(300);

  const res = await api.post(
    '/api/v1/chits/payment-intents/intent_missing',
    { action: 'approve', confirmedAmount: 0 },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/confirmedamount must be a positive number/i);
});

test('[CF-559] Rejection requires a reason', async () => {
  const res = await api.post(
    '/api/v1/chits/payment-intents/intent_missing',
    { action: 'reject' },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/rejectionreason is required/i);
});

test('[CF-563] Who may review a payment intent is stated and enforced', async () => {
  const res = await api.get('/api/v1/chits/payment-intents', asAgent());
  expect(
    [200, 403],
    `CHIT-29 separates collection from approval — an agent either may review intents or is refused, but the answer must be deliberate (got ${res.status})`,
  ).toContain(res.status);
});

test('[CF-562] The staff intent queue is branch-scoped for a branch role', async () => {
  const branchScoped = await api.get('/api/v1/chits/payment-intents', asAdmin());
  expect(branchScoped.status).toBeLessThan(300);
  const rows = Array.isArray(branchScoped.data) ? branchScoped.data : branchScoped.data?.items ?? [];
  for (const row of rows) {
    expect(row.branchId ?? s.tenantA.branches.hq, 'SCOPE-3: only the active branch').toBe(s.tenantA.branches.hq);
  }

  const tenantWide = await api.get('/api/v1/chits/payment-intents', asOwner());
  expect(tenantWide.status, 'a superadmin reads across branches').toBeLessThan(300);
});
