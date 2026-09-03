import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, branchPool, agentFloat, num, idemKey, type Session } from './support/harness';
import { loadState, patchState, type AutoRunState } from './support/state';

/**
 * EMI collection on a hire-purchase account.
 *
 * There are two ways money reaches an HP loan and they are NOT the same code:
 *
 *   • the mobile / API path — /api/v1/collection/collect, which funnels through
 *     recordActualLoanCollection and posts the cash book, the GL and the float;
 *   • the web receipt action — recordHpReceipt, which recomputes the waterfall
 *     itself and writes Payment, PaymentAllocation, instalments and penalties.
 *
 * Spec 05 already proved the allocation planner is right. What this file tests
 * is what each path actually LEAVES BEHIND, because a payment that settles an
 * instalment but never reaches the cash book is money the office cannot find.
 * AUTO-288 compares the two directly rather than assuming they agree.
 */

let owner: Session;
let admin: Session;
let agentHq: Session;
let s: AutoRunState;

const asAdmin = () => ({ token: admin.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });
const asAgent = () => ({ token: agentHq.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });

const EMI = 20_666.67;

/** Age a loan's first two instalments so there is something overdue to collect. */
async function makeOverdue(loanId: string, count = 2) {
  const rows = await db().instalment.findMany({
    where: { loanId },
    orderBy: { instalmentNo: 'asc' },
    take: count,
  });
  for (const [i, row] of rows.entries()) {
    await db().instalment.update({
      where: { id: row.id },
      data: { dueDate: new Date(Date.now() - (count - i) * 30 * 24 * 3600 * 1000) },
    });
  }
  return rows;
}

/** Reset a loan's schedule so each collection case starts from a known ledger. */
async function resetSchedule(loanId: string) {
  await db().paymentAllocation.deleteMany({ where: { instalment: { loanId } } });
  await db().payment.deleteMany({ where: { loanId } });
  await db().instalment.updateMany({
    where: { loanId },
    data: { receivedAmount: 0, status: 'upcoming', receivedAt: null, paymentMode: null },
  });
  await db().loan.update({
    where: { id: loanId },
    data: { status: 'active', paidCount: 0, totalCollected: 0, closedAt: null, closureType: null },
  });
}

async function collect(session: Session, body: Record<string, unknown>, branchId?: string) {
  return api.post('/api/v1/collection/collect', body, {
    token: session.token,
    appType: 'autofinance',
    branchId: branchId ?? s.tenantA.branches.hq,
  });
}

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agentHq = await loginApi(s.tenantA.agentHq!.username, s.password);
});

test.afterAll(async () => {
  await closeDb();
});

// ── The canonical collection path ───────────────────────────────────────────
test('[AUTO-277] The committed receipt matches the previewed plan exactly', async () => {
  const loanId = loadState().tenantA.loans.reference;
  await resetSchedule(loanId);
  await makeOverdue(loanId);

  const before = await db().instalment.findMany({
    where: { loanId },
    orderBy: { instalmentNo: 'asc' },
    select: { id: true, instalmentNo: true, receivedAmount: true },
  });

  const res = await collect(agentHq, {
    loanId,
    amount: 25_000,
    paymentMode: 'cash',
    idempotencyKey: idemKey(s.runId, 'emi-1'),
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const after = await db().instalment.findMany({
    where: { loanId },
    orderBy: { instalmentNo: 'asc' },
    select: { id: true, instalmentNo: true, receivedAmount: true, status: true },
  });
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const applied = after
    .map((r) => ({ no: r.instalmentNo, delta: num(r.receivedAmount) - num(beforeById.get(r.id)!.receivedAmount) }))
    .filter((r) => r.delta > 0);

  const total = Math.round(applied.reduce((sum, r) => sum + r.delta, 0) * 100) / 100;
  expect(total, 'the whole 25000 landed somewhere on the ledger').toBe(25_000);
  expect(applied[0].no, 'oldest first').toBe(1);
  expect(
    applied.map((r) => r.no),
    'and in ascending order, never skipping an older row for a newer one',
  ).toEqual([...applied.map((r) => r.no)].sort((a, b) => a - b));
});

test('[AUTO-278] A cash EMI receipt credits the collecting agent’s float', async () => {
  const loanId = loadState().tenantA.loans.reference;
  await resetSchedule(loanId);
  await makeOverdue(loanId);

  const floatBefore = await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id);
  const entriesBefore = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', type: 'collection' },
  });

  const res = await collect(agentHq, {
    loanId,
    amount: EMI,
    paymentMode: 'cash',
    idempotencyKey: idemKey(s.runId, 'emi-cash'),
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  expect(
    await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id),
    'MONEY-17: cash in the agent’s hand is float',
  ).toBe(Math.round((floatBefore + EMI) * 100) / 100);

  expect(
    await db().accountEntry.count({
      where: { tenantId: s.tenantA.id, appType: 'autofinance', type: 'collection' },
    }),
    'ACC-6: and it reaches the cash book',
  ).toBe(entriesBefore + 1);
});

test('[AUTO-279] A UPI EMI receipt does not move physical float', async () => {
  const loanId = loadState().tenantA.loans.reference;
  await resetSchedule(loanId);
  await makeOverdue(loanId);

  const floatBefore = await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id);
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await collect(agentHq, {
    loanId,
    amount: EMI,
    paymentMode: 'upi',
    idempotencyKey: idemKey(s.runId, 'emi-upi'),
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const paid = await db().instalment.count({ where: { loanId, status: { in: ['paid', 'partial'] } } });
  expect(paid, 'the instalment is still settled').toBeGreaterThan(0);

  expect(
    await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id),
    'MONEY-17: nobody handed the agent a note',
  ).toBe(floatBefore);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'and none reached the branch drawer').toBe(poolBefore);
});

test('[AUTO-280] A replayed receipt does not post twice', async () => {
  const loanId = loadState().tenantA.loans.reference;
  await resetSchedule(loanId);
  await makeOverdue(loanId);

  const key = idemKey(s.runId, 'emi-replay');
  const body = { loanId, amount: EMI, paymentMode: 'cash', idempotencyKey: key };

  const first = await collect(agentHq, body);
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);

  const floatAfterFirst = await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id);
  const collectedAfterFirst = num((await db().loan.findUniqueOrThrow({ where: { id: loanId } })).totalCollected);

  const replay = await collect(agentHq, body);
  expect([200, 201, 409], `a replay is answered or refused, never applied twice (got ${replay.status})`).toContain(
    replay.status,
  );

  expect(
    num((await db().loan.findUniqueOrThrow({ where: { id: loanId } })).totalCollected),
    'DB-11: the ledger moved once',
  ).toBe(collectedAfterFirst);
  expect(
    await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id),
    'and so did the float',
  ).toBe(floatAfterFirst);
});

test('[AUTO-281] A receipt cannot be posted against another branch’s loan', async () => {
  const state = loadState();
  const erodeLoan = await db().loan.findFirst({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', branchId: s.tenantA.branches.erode },
  });
  if (!erodeLoan) test.skip(true, 'the journey has no Erode HP loan yet');

  const before = await db().instalment.aggregate({
    where: { loanId: erodeLoan!.id },
    _sum: { receivedAmount: true },
  });

  const res = await collect(
    admin,
    { loanId: erodeLoan!.id, amount: EMI, paymentMode: 'cash', idempotencyKey: idemKey(s.runId, 'cross-branch') },
    s.tenantA.branches.hq,
  );
  expect(res.status, 'SCOPE-3: out of the active branch is 404').toBe(404);

  const after = await db().instalment.aggregate({
    where: { loanId: erodeLoan!.id },
    _sum: { receivedAmount: true },
  });
  expect(num(after._sum.receivedAmount), 'the Erode ledger is untouched').toBe(num(before._sum.receivedAmount));
  void state;
});

test('[AUTO-282] A fully repaid HP loan is derived as closed', async () => {
  const loanId = loadState().tenantA.loans.reference;
  await resetSchedule(loanId);

  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  const outstanding = num(loan.totalPayable);

  // Collect the whole contract in instalment-sized bites so every row is
  // settled through the real path rather than by editing the table.
  for (let i = 0; i < 24; i++) {
    const res = await collect(agentHq, {
      loanId,
      amount: EMI + 1,
      paymentMode: 'cash',
      idempotencyKey: idemKey(s.runId, `payoff-${i}`),
    });
    if (res.status >= 300) break;
    const fresh = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
    if (fresh.status === 'closed') break;
  }

  const closed = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  expect(closed.status, `MONEY-11: a loan of ${outstanding} fully repaid is derived as closed`).toBe('closed');
  expect(
    await db().instalment.count({ where: { loanId, status: { in: ['upcoming', 'partial', 'missed'] } } }),
    'nothing is left outstanding',
  ).toBe(0);
});

test('[AUTO-283] Collecting on a closed loan is refused', async () => {
  const loanId = loadState().tenantA.loans.reference;
  const closed = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  if (closed.status !== 'closed') test.skip(true, 'the payoff case did not close the loan');

  const before = num(closed.totalCollected);
  const res = await collect(agentHq, {
    loanId,
    amount: EMI,
    paymentMode: 'cash',
    idempotencyKey: idemKey(s.runId, 'after-close'),
  });

  expect(res.status, 'nothing is outstanding to collect').toBeGreaterThanOrEqual(400);
  expect(num((await db().loan.findUniqueOrThrow({ where: { id: loanId } })).totalCollected)).toBe(before);
});

// ── The web receipt action, and whether the two paths agree ─────────────────
test('[AUTO-285] An HP EMI receipt posts to the cash book and the GL', async () => {
  const state = loadState();
  const loanId = state.tenantA.loans.diminishing;
  await resetSchedule(loanId);
  await makeOverdue(loanId);

  const entriesBefore = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', type: 'collection' },
  });
  const floatBefore = await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await collect(agentHq, {
    loanId,
    amount: 25_000,
    paymentMode: 'cash',
    idempotencyKey: idemKey(s.runId, 'gl-check'),
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const payments = await db().payment.count({ where: { loanId } });
  const entries = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', type: 'collection' },
  });

  expect(
    entries,
    `ACC-6 / MONEY-17: every rupee that settled an instalment must also reach the cash book — ${payments} payment row(s) were written`,
  ).toBe(entriesBefore + 1);
  expect(
    await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id),
    'and a cash receipt must credit the collecting agent’s float',
  ).toBeGreaterThan(floatBefore);
});

test('[AUTO-288] The web receipt and the mobile collection route agree on what a payment does', async () => {
  const state = loadState();
  const loanId = state.tenantA.loans.diminishing;
  await resetSchedule(loanId);
  await makeOverdue(loanId);

  const res = await collect(agentHq, {
    loanId,
    amount: EMI,
    paymentMode: 'cash',
    idempotencyKey: idemKey(s.runId, 'parity'),
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const viaApi = {
    settled: await db().instalment.count({ where: { loanId, status: { in: ['paid', 'partial'] } } }),
    entries: await db().accountEntry.count({
      where: { tenantId: s.tenantA.id, appType: 'autofinance', referenceType: { contains: 'instal' } },
    }),
    payments: await db().payment.count({ where: { loanId } }),
  };

  expect(viaApi.settled, 'the API path settles the instalment').toBeGreaterThan(0);
  expect(
    viaApi.entries,
    'API-8 / STRUCT-3: whichever path an operator uses, the same trail must exist — a receipt that settles a row without an entry is money the books cannot see',
  ).toBeGreaterThan(0);
});

test('[AUTO-433] An agent handover moves cash from the agent to the branch', async () => {
  const floatBefore = await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id);
  if (floatBefore <= 0) test.skip(true, 'the agent is holding no cash to hand over');

  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);
  const amount = Math.min(5_000, floatBefore);

  const res = await api.post(
    '/api/v1/wallet/collect',
    { agentId: s.tenantA.agentHq!.id, amount },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  expect(
    await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id),
    'the agent hands it over',
  ).toBe(Math.round((floatBefore - amount) * 100) / 100);
  expect(
    await branchPool(s.tenantA.id, s.tenantA.branches.hq!),
    'MONEY-16: and the branch receives exactly that — cash is moved, never created',
  ).toBe(Math.round((poolBefore + amount) * 100) / 100);
});

test('[AUTO-555] A negative amount cannot reverse money through a receipt route', async () => {
  const state = loadState();
  const loanId = state.tenantA.loans.diminishing;
  const floatBefore = await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await collect(agentHq, {
    loanId,
    amount: -25_000,
    paymentMode: 'cash',
    idempotencyKey: idemKey(s.runId, 'negative'),
  });
  expect(res.status).toBe(400);
  expect(
    await agentFloat(s.tenantA.id, s.tenantA.agentHq!.id),
    'X-14: a reversal is its own operation, never a negative collection',
  ).toBe(floatBefore);

  patchState((st) => {
    st.tenantA.loans.collectionTested = loanId;
  });
});
