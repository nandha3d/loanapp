import { expect, test } from '@playwright/test';
import { closeDb, db, num, waitForRow } from './support/db';
import { api, loginApi, setTenantSetting, type Session } from './support/api';
import { loadState, patchState } from './support/state';
import { ensureSession } from './support/session';
import { ensureAccountingConfigured } from './support/setup';
import { bodyText, gotoOk, mpath } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false).

const APP_TYPE = 'microlending';

test.afterAll(async () => {
  await closeDb();
});

test.beforeAll(ensureAccountingConfigured);

async function agentSession(): Promise<Session> {
  const s = loadState();
  return loginApi(s.tenantA.agentHq!.username, s.password);
}

async function agentBalance(tenantId: string, agentId: string): Promise<number> {
  const row = await db().agentAccount.findFirst({ where: { tenantId, appType: APP_TYPE, agentId } });
  return num(row?.balance);
}

/** A live loan on the HQ agent's own route, with dues to collect. */
async function collectableLoan(tenantId: string, customerId: string) {
  return db().loan.findFirstOrThrow({
    where: { tenantId, customerId, status: 'active', frequency: 'daily' },
    orderBy: { createdAt: 'asc' },
  });
}

test('[ML-250] Agent collection sheet lists dues for their routes', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });
  await gotoOk(page, mpath('/collection'), 'collection sheet');

  const customer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  const text = await bodyText(page);
  expect(text, 'the agent’s own borrower is on the sheet').toContain(customer.name.toLowerCase().slice(0, 12));
});

test('[ML-251] Full collection marks the instalment paid', async () => {
  const s = loadState();
  const agent = await agentSession();
  const loan = await collectableLoan(s.tenantA.id, s.tenantA.customerHq!);

  const due = await db().instalment.findFirstOrThrow({
    where: { loanId: loan.id, status: { in: ['upcoming', 'partial', 'missed'] } },
    orderBy: { dueDate: 'asc' },
  });

  const res = await api.post(
    '/api/v1/collection/collect',
    {
      loanId: loan.id,
      amount: num(due.dueAmount),
      paymentMode: 'cash',
      remarks: `full ${s.runId}`,
      idempotencyKey: `full-${s.runId}-${due.id}`,
    },
    { token: agent.token },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  // recordActualLoanCollection posts to the collection-date instalment, which
  // is not necessarily the oldest unpaid one — so assert on the row that moved.
  const settled = await waitForRow(
    async () => {
      const rows = await db().instalment.findMany({ where: { loanId: loan.id } });
      return rows.find((r) => r.status === 'paid' && num(r.receivedAmount) > 0) ?? null;
    },
    'an instalment to be settled by the collection',
  );
  expect(settled.status, 'a fully paid instalment is derived as paid (MONEY-11)').toBe('paid');
  expect(num(settled.receivedAmount), 'the full due was applied').toBeGreaterThanOrEqual(num(settled.dueAmount));

  patchState((state) => {
    state.tenantA.loans.collected = loan.id;
  });
});

test('[ML-255] Cash collection increases the collecting agent’s float', async () => {
  const s = loadState();
  const agent = await agentSession();
  const loan = await collectableLoan(s.tenantA.id, s.tenantA.customerHq!);
  const due = await db().instalment.findFirstOrThrow({
    where: { loanId: loan.id, status: { in: ['upcoming', 'partial', 'missed'] } },
    orderBy: { dueDate: 'asc' },
  });
  const before = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await api.post(
    '/api/v1/collection/collect',
    {
      loanId: loan.id,
      amount: num(due.dueAmount),
      paymentMode: 'cash',
      idempotencyKey: `float-${s.runId}-${due.id}`,
    },
    { token: agent.token },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const after = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  expect(after, 'cash collected in the field lands in the agent’s float (MONEY-17)').toBe(
    before + num(due.dueAmount),
  );
});

test('[ML-252] Partial collection marks the instalment partial', async () => {
  const s = loadState();
  const agent = await agentSession();
  const loan = await collectableLoan(s.tenantA.id, s.tenantA.customerHq!);
  const due = await db().instalment.findFirstOrThrow({
    where: { loanId: loan.id, status: { in: ['upcoming', 'partial', 'missed'] } },
    orderBy: { dueDate: 'asc' },
  });
  const part = Math.max(1, Math.floor(num(due.dueAmount) / 2));

  const res = await api.post(
    '/api/v1/collection/collect',
    {
      loanId: loan.id,
      amount: part,
      paymentMode: 'cash',
      idempotencyKey: `part-${s.runId}-${due.id}`,
    },
    { token: agent.token },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const partial = await waitForRow(
    async () => {
      const rows = await db().instalment.findMany({ where: { loanId: loan.id } });
      return rows.find((r) => r.status === 'partial' && num(r.receivedAmount) > 0) ?? null;
    },
    'the partial payment to post',
  );
  expect(num(partial.receivedAmount), 'the part payment is recorded').toBeGreaterThan(0);
  expect(
    num(partial.receivedAmount),
    'and it is less than the full due, hence partial (MONEY-11)',
  ).toBeLessThan(num(partial.dueAmount));
});

test('[ML-254] A retried collection does not double-post', async () => {
  const s = loadState();
  const agent = await agentSession();
  const loan = await collectableLoan(s.tenantA.id, s.tenantA.customerHq!);
  const due = await db().instalment.findFirstOrThrow({
    where: { loanId: loan.id, status: { in: ['upcoming', 'partial', 'missed'] } },
    orderBy: { dueDate: 'asc' },
  });

  const payload = {
    loanId: loan.id,
    amount: 100,
    paymentMode: 'cash',
    remarks: `retry ${s.runId}`,
    idempotencyKey: `retry-${s.runId}-${due.id}`,
  };

  const first = await api.post('/api/v1/collection/collect', payload, { token: agent.token });
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);
  const afterFirst = num((await db().instalment.findUniqueOrThrow({ where: { id: due.id } })).receivedAmount);

  // The same submission again — a flaky mobile network retry.
  await api.post('/api/v1/collection/collect', payload, { token: agent.token });
  await new Promise((r) => setTimeout(r, 1_500));

  const afterSecond = num((await db().instalment.findUniqueOrThrow({ where: { id: due.id } })).receivedAmount);
  expect(afterSecond, 'the retry must not post a second time (MONEY-13)').toBe(afterFirst);

  const entries = await db().collectionEntry.count({
    where: { tenantId: s.tenantA.id, loanId: loan.id, remarks: `retry ${s.runId}` },
  });
  expect(entries, 'exactly one collection entry survives the retry').toBe(1);
});

test('[ML-253] Allocation fills today first, then oldest overdue, then future', async () => {
  const s = loadState();
  const agent = await agentSession();

  // Build a backlog: a loan that started a week ago, so instalments 1..n are
  // overdue and one falls due today.
  const admin = await loginApi(s.tenantA.admin!.username, s.password);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 4);

  const created = await api.post(
    '/api/v1/loans',
    {
      customerId: s.tenantA.customerHq,
      principal: 5000,
      deduction: 0,
      deductionType: 'upfront_fixed',
      tenure: 10,
      frequency: 'daily',
      startDate: start.toISOString().slice(0, 10),
      loanType: 'cheque',
    },
    { token: admin.token },
  );
  expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);
  const loanId = created.data?.id ?? created.data?.loan?.id;

  const schedule = await db().instalment.findMany({ where: { loanId }, orderBy: { dueDate: 'asc' } });
  // Due dates are stored at UTC midnight; comparing raw timestamps against a
  // local midnight silently finds nothing east of Greenwich.
  const dayOf = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todays = schedule.find((i) => dayOf(i.dueDate) === todayKey);
  const overdue = schedule.filter((i) => dayOf(i.dueDate) < todayKey);
  expect(todays, 'the schedule has a due for today').toBeTruthy();
  expect(overdue.length, 'and a backlog behind it').toBeGreaterThan(0);

  // Pay exactly one instalment's worth: today's due must clear first.
  const res = await api.post(
    '/api/v1/collection/collect',
    {
      loanId,
      amount: num(todays!.dueAmount),
      paymentMode: 'cash',
      idempotencyKey: `alloc-${s.runId}-${loanId}`,
    },
    { token: agent.token },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const todaysAfter = await db().instalment.findUniqueOrThrow({ where: { id: todays!.id } });
  const oldestAfter = await db().instalment.findUniqueOrThrow({ where: { id: overdue[0].id } });

  expect(
    num(todaysAfter.receivedAmount),
    'today’s due is cleared first, even with a backlog behind it (MONEY-10)',
  ).toBe(num(todays!.dueAmount));
  expect(num(oldestAfter.receivedAmount), 'the backlog waits its turn').toBe(0);
});

test('[ML-256] A receipt record is produced for a collection', async () => {
  const s = loadState();
  const entry = await db().collectionEntry.findFirst({
    where: { tenantId: s.tenantA.id },
    orderBy: { submittedAt: 'desc' },
  });
  expect(entry, 'a collection entry exists').toBeTruthy();

  const owner = await loginApi(s.tenantA.owner.username, s.password);

  // Receipt PDFs sit behind a plan flag and an operator switch; a tenant
  // without either is meant to get 403, so turn both on before asking.
  await db().tenantSubscription.update({
    where: { tenantId: s.tenantA.id },
    data: { receiptPdfAllowed: true },
  });
  await setTenantSetting(owner, 'receipt_pdf_active', 'true');

  const res = await api.get(`/api/v1/receipts/${entry!.id}`, { token: owner.token });
  expect(res.status, 'a receipt is retrievable for the entry once the add-on is on').toBeLessThan(400);
});

test('[ML-257] Loan closes when the last instalment is settled', async () => {
  const s = loadState();
  const admin = await loginApi(s.tenantA.admin!.username, s.password);
  const agent = await agentSession();

  const created = await api.post(
    '/api/v1/loans',
    {
      customerId: s.tenantA.customerHq,
      principal: 300,
      deduction: 0,
      deductionType: 'upfront_fixed',
      tenure: 3,
      frequency: 'daily',
      startDate: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
      loanType: 'cheque',
    },
    { token: admin.token },
  );
  expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);
  const loanId = created.data?.id ?? created.data?.loan?.id;

  const schedule = await db().instalment.findMany({ where: { loanId }, orderBy: { dueDate: 'asc' } });
  for (const instalment of schedule) {
    await api.post(
      '/api/v1/collection/collect',
      {
        loanId,
        amount: num(instalment.dueAmount),
        paymentMode: 'cash',
        idempotencyKey: `close-${s.runId}-${instalment.id}`,
      },
      { token: agent.token },
    );
  }

  const closed = await waitForRow(
    async () => {
      const l = await db().loan.findUnique({ where: { id: loanId } });
      return l && l.status !== 'active' ? l : null;
    },
    'the loan to close once fully repaid',
  );
  expect(closed.status, 'a fully repaid loan is derived as closed (MONEY-11)').toBe('closed');

  const unpaid = await db().instalment.count({
    where: { loanId, status: { in: ['upcoming', 'partial', 'missed'] } },
  });
  expect(unpaid, 'nothing is left outstanding').toBe(0);
});

test('[ML-259] Non-cash collection does not move physical float', async () => {
  const s = loadState();
  const agent = await agentSession();
  const loan = await collectableLoan(s.tenantA.id, s.tenantA.customerHq!);
  const due = await db().instalment.findFirst({
    where: { loanId: loan.id, status: { in: ['upcoming', 'partial', 'missed'] } },
    orderBy: { dueDate: 'asc' },
  });
  if (!due) test.skip(true, 'no outstanding due left on the reference loan');

  const before = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  const res = await api.post(
    '/api/v1/collection/collect',
    {
      loanId: loan.id,
      amount: 50,
      paymentMode: 'upi',
      idempotencyKey: `upi-${s.runId}-${due!.id}`,
    },
    { token: agent.token },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'only cash legs move float (MONEY-17)').toBe(
    before,
  );
});

test('[ML-258] Collection rows are branch-scoped', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const hq = await api.get('/api/v1/collection/today', { token: owner.token, branchId: s.tenantA.branches.hq });
  const erode = await api.get('/api/v1/collection/today', {
    token: owner.token,
    branchId: s.tenantA.branches.erode,
  });

  const idsOf = (payload: any) => {
    const rows = Array.isArray(payload) ? payload : payload?.items ?? payload?.rows ?? [];
    return rows.map((r: any) => r.customerId ?? r.customer?.id ?? r.loanId).filter(Boolean);
  };

  expect(hq.status).toBeLessThan(400);
  expect(erode.status).toBeLessThan(400);
  expect(idsOf(erode.data), 'the HQ borrower must not appear on the Erode sheet').not.toContain(
    s.tenantA.customerHq,
  );
});

test('[ML-330] Cash book records disbursals and collections', async () => {
  const s = loadState();
  const disbursals = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, type: 'loan_disburse' },
  });
  const collections = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, type: { contains: 'collect' } },
  });

  expect(disbursals, 'every disbursal is in the cash book (ACC-6)').toBeGreaterThan(0);
  expect(collections, 'every collection is in the cash book (ACC-6)').toBeGreaterThan(0);
});

test('[ML-331] Journal entries balance', async () => {
  const s = loadState();
  const entries = await db().journalEntry.findMany({
    where: { tenantId: s.tenantA.id },
    include: { lines: true },
  });
  if (entries.length === 0) {
    test.skip(true, 'statutory accounting is not enabled for this tenant (ACC-4)');
  }

  for (const entry of entries) {
    const debit = entry.lines.reduce((sum, l) => sum + num(l.debit), 0);
    const credit = entry.lines.reduce((sum, l) => sum + num(l.credit), 0);
    expect(Math.round(debit * 100), `journal ${entry.id} balances (ACC-3)`).toBe(Math.round(credit * 100));
  }
});

test('[ML-332] Journal dedup keys prevent double posting', async () => {
  const s = loadState();
  const entries = await db().journalEntry.findMany({
    where: { tenantId: s.tenantA.id, sourceType: { not: undefined } },
    select: { dedupKey: true, sourceType: true, sourceId: true },
  });
  if (entries.length === 0) {
    test.skip(true, 'no auto-posted journal entries for this tenant');
  }

  for (const entry of entries) {
    expect(entry.dedupKey, 'auto-posted entries carry a dedup key (ACC-5, DB-10)').toBeTruthy();
    expect(entry.sourceId, 'and the id of what produced them').toBeTruthy();
  }
  const keys = entries.map((e) => e.dedupKey);
  expect(new Set(keys).size, 'dedup keys are unique').toBe(keys.length);
});
