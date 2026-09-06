import { expect, test, type Page } from '@playwright/test';
import { distributeInstalmentAmounts } from '@/lib/loanCalculator';
import { closeDb, db, num, waitForRow } from './support/db';
import { api, loginApi, setTenantSetting, type Session } from './support/api';
import { loadState, patchState } from './support/state';
import { ensureSession } from './support/session';
import { ensureAccountingConfigured } from './support/setup';
import { bodyText, gotoOk, mpath, waitForHydration } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false).

const APP_TYPE = 'microlending';

test.afterAll(async () => {
  await closeDb();
});

function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function ownerSession(): Promise<Session> {
  const s = loadState();
  return loginApi(s.tenantA.owner.username, s.password);
}

async function adminSession(): Promise<Session> {
  const s = loadState();
  return loginApi(s.tenantA.admin!.username, s.password);
}

async function agentBalance(tenantId: string, agentId: string): Promise<number> {
  const row = await db().agentAccount.findFirst({ where: { tenantId, appType: APP_TYPE, agentId } });
  return num(row?.balance);
}

async function poolBalance(tenantId: string, branchId: string): Promise<number> {
  const row = await db().branchCashAccount.findFirst({ where: { tenantId, appType: APP_TYPE, branchId } });
  return num(row?.balance);
}

/** Originate through the one origination path, as a given session. */
async function originate(session: Session, body: Record<string, unknown>, branchId?: string) {
  return api.post('/api/v1/loans', body, { token: session.token, branchId });
}

/**
 * Keep working capital in the branch pool and float with the agent.
 *
 * This file originates two dozen contracts; without a top-up the pool empties
 * part way through and every later case fails on "insufficient float" — a
 * bookkeeping artefact of the test order, not a defect. An operator funds the
 * branch before lending, so the suite does too.
 */
async function ensureWorkingCapital(minimum = 400_000) {
  const s = loadState();
  const owner = await ownerSession();

  const pool = await db().branchCashAccount.findFirst({
    where: { tenantId: s.tenantA.id, appType: APP_TYPE, branchId: s.tenantA.branches.hq! },
  });
  if (num(pool?.balance) < minimum) {
    await api.post(
      '/api/v1/wallet/branch',
      { branchId: s.tenantA.branches.hq, amount: minimum, note: 'working capital for the loan cases' },
      { token: owner.token, branchId: s.tenantA.branches.hq },
    );
  }

  const float = await db().agentAccount.findFirst({
    where: { tenantId: s.tenantA.id, appType: APP_TYPE, agentId: s.tenantA.agentHq!.id },
  });
  if (num(float?.balance) < 50_000) {
    await api.post(
      '/api/v1/wallet/release',
      { agentId: s.tenantA.agentHq!.id, amount: 50_000, note: 'field float for the loan cases' },
      { token: owner.token, branchId: s.tenantA.branches.hq },
    );
  }
}

test.beforeAll(async () => {
  await ensureAccountingConfigured();
  await ensureWorkingCapital();
});

test('[ML-180] Agent opens the new-loan form with an approved customer', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });
  await gotoOk(page, mpath('/loans/new'), 'new loan form');

  await expect(page.locator('select[name="customerId"]')).toBeVisible();
  await expect(page.locator('input[name="principal"]')).toBeVisible();
  await expect(page.locator('select[name="frequency"]')).toBeVisible();
  await expect(page.locator('input[name="tenure"]')).toBeVisible();

  const options = await page
    .locator('select[name="customerId"] option')
    .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  expect(options, 'the approved HQ customer is selectable').toContain(s.tenantA.customerHq);
});

test('[ML-181] Agent-originated loan is pending_review and disburses nothing', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await originate(agent, {
    customerId: s.tenantA.customerHq,
    principal: 30000,
    deduction: 3000,
    deductionType: 'upfront_fixed',
    tenure: 30,
    frequency: 'daily',
    startDate: isoDay(),
    penaltyRate: 50,
    loanType: 'cheque',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loanId = res.data?.id ?? res.data?.loan?.id;
  const loan = await waitForRow(() => db().loan.findFirst({ where: { id: loanId } }), 'the agent-originated loan');

  expect(loan.status, 'an agent without the bypass flag files for review (MONEY-8)').toBe('pending_review');
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'a pending loan disburses nothing').toBe(
    floatBefore,
  );
  expect(
    await db().accountEntry.count({ where: { tenantId: s.tenantA.id, referenceId: loan.id } }),
    'no cash-book entry before approval',
  ).toBe(0);

  patchState((state) => {
    state.tenantA.loans.pendingDaily = loan.id;
  });
});

test('[ML-182] Pending loan notifies the approvers and joins their queue', async () => {
  const s = loadState();
  const loan = await db().loan.findUniqueOrThrow({ where: { id: s.tenantA.loans.pendingDaily } });

  expect(loan.status, 'the queue is the set of pending_review loans').toBe('pending_review');

  const notifications = await db().systemNotification.findMany({
    where: { tenantId: s.tenantA.id, type: 'approval_pending' },
  });
  expect(notifications.length, 'notifyApprovers() ran for the origination (X-23)').toBeGreaterThan(0);
  expect(
    notifications.some((n) => (n.message ?? '').includes(loan.loanCode)),
    'the notification names the contract awaiting review',
  ).toBe(true);
});

test('[ML-183] Admin sees the pending loan in the approvals queue', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'admin', { username: s.tenantA.admin!.username, password: s.password });
  await gotoOk(page, mpath('/approvals'), 'approvals queue');

  const loan = await db().loan.findUniqueOrThrow({ where: { id: s.tenantA.loans.pendingDaily } });
  await page.getByText(/loans/i).first().click().catch(() => {});
  await page.waitForTimeout(800);

  const text = await bodyText(page);
  expect(text, 'the pending loan is listed by contract number').toContain(loan.loanCode.toLowerCase());
});

test('[ML-184] Approving the loan activates it', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'admin', { username: s.tenantA.admin!.username, password: s.password });
  await gotoOk(page, mpath('/approvals'), 'approvals queue');
  await waitForHydration(page, 'table');

  const loan = await db().loan.findUniqueOrThrow({ where: { id: s.tenantA.loans.pendingDaily } });
  const loansTab = page.locator('button, div').filter({ hasText: /^loans/i }).first();
  await loansTab.click().catch(() => {});
  await page.waitForTimeout(600);

  const row = page.locator('tr').filter({ hasText: loan.loanCode }).first();
  await row.getByRole('button', { name: /approve/i }).click();

  const approved = await waitForRow(
    async () => {
      const l = await db().loan.findUnique({ where: { id: loan.id } });
      return l && l.status !== 'pending_review' ? l : null;
    },
    'the loan approval to land',
  );
  expect(approved.status, 'approval activates the contract').toBe('active');

  const instalments = await db().instalment.count({ where: { loanId: loan.id } });
  expect(instalments, 'the schedule is live').toBe(30);
});

test('[ML-186] Rejecting a loan moves no money', async ({ page }) => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const res = await originate(agent, {
    customerId: s.tenantA.customerHq,
    principal: 12000,
    deduction: 1200,
    deductionType: 'upfront_fixed',
    tenure: 12,
    frequency: 'daily',
    startDate: isoDay(),
    loanType: 'cheque',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  const loanId = res.data?.id ?? res.data?.loan?.id;
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });

  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);

  await ensureSession(page, 'admin', { username: s.tenantA.admin!.username, password: s.password });
  await gotoOk(page, mpath('/approvals'), 'approvals queue');
  await waitForHydration(page, 'table');
  await page.locator('button, div').filter({ hasText: /^loans/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);

  const row = page.locator('tr').filter({ hasText: loan.loanCode }).first();
  const reject = row.getByRole('button', { name: /reject|confirm/i }).first();
  await reject.click();
  await expect(reject).toContainText(/confirm/i, { timeout: 10_000 });
  await reject.click();

  const settled = await waitForRow(
    async () => {
      const l = await db().loan.findUnique({ where: { id: loan.id } });
      return l && l.status !== 'pending_review' ? l : null;
    },
    'the rejection to land',
  );

  expect(settled.status, 'a rejected loan never becomes active').not.toBe('active');
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'agent float untouched').toBe(floatBefore);
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'branch pool untouched').toBe(poolBefore);
  expect(
    await db().accountEntry.count({ where: { tenantId: s.tenantA.id, referenceId: loan.id } }),
    'nothing is posted to the cash book',
  ).toBe(0);
});

test('[ML-198] Admin origination bypasses approval', async () => {
  const s = loadState();
  const admin = await adminSession();
  const res = await originate(admin, {
    customerId: s.tenantA.customerHq,
    principal: 10000,
    deduction: 1000,
    deductionType: 'upfront_fixed',
    tenure: 10,
    frequency: 'daily',
    startDate: isoDay(),
    loanType: 'cheque',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data?.id ?? res.data?.loan?.id } });
  expect(loan.status, 'an admin originates straight to active').toBe('active');
  patchState((state) => {
    state.tenantA.loans.adminDaily = loan.id;
  });
});

test('[ML-192] Staff origination funds from the branch pool, not an agent float', async () => {
  const s = loadState();
  const admin = await adminSession();
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await originate(admin, {
    customerId: s.tenantA.customerHq,
    principal: 15000,
    deduction: 1500,
    deductionType: 'upfront_fixed',
    tenure: 15,
    frequency: 'daily',
    startDate: isoDay(),
    loanType: 'cheque',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data?.id ?? res.data?.loan?.id } });

  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'the branch pool funded the payout').toBe(
    poolBefore - num(loan.disbursed),
  );
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'no agent float was touched').toBe(floatBefore);
});

test('[ML-190] Cash disbursal from agent float debits that float', async () => {
  const s = loadState();
  // The agent carries the bypass flag for this case so origination disburses.
  // It is put back at the end: left on, it would make ML-181 (which asserts an
  // agent files for review) pass for the wrong reason on the next run.
  await db().user.update({ where: { id: s.tenantA.agentHq!.id }, data: { bypassLoanApproval: true } });
  try {
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await originate(agent, {
    customerId: s.tenantA.customerHq,
    principal: 9000,
    deduction: 900,
    deductionType: 'upfront_fixed',
    tenure: 9,
    frequency: 'daily',
    startDate: isoDay(),
    loanType: 'cheque',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data?.id ?? res.data?.loan?.id } });

  expect(loan.status, 'the bypass flag originates straight to active').toBe('active');
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'the agent’s own float funded it').toBe(
    floatBefore - num(loan.disbursed),
  );

  const movement = await db().walletTransaction.findFirst({
    where: { tenantId: s.tenantA.id, refId: loan.id },
  });
  expect(movement, 'the debit is on the ledger').toBeTruthy();
  patchState((state) => {
    state.tenantA.loans.agentCash = loan.id;
  });
  } finally {
    await db().user.update({ where: { id: s.tenantA.agentHq!.id }, data: { bypassLoanApproval: false } });
  }
});

test('[ML-191] Disbursal beyond available float is refused atomically', async () => {
  const s = loadState();
  // The float check only runs on a loan that actually disburses, so the agent
  // carries the bypass for this case and gives it back afterwards.
  await db().user.update({ where: { id: s.tenantA.agentHq!.id }, data: { bypassLoanApproval: true } });
  try {
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  const loansBefore = await db().loan.count({ where: { tenantId: s.tenantA.id } });

  const res = await originate(agent, {
    customerId: s.tenantA.customerHq,
    principal: floatBefore + 1_000_000,
    deduction: 0,
    deductionType: 'upfront_fixed',
    tenure: 10,
    frequency: 'daily',
    startDate: isoDay(),
    loanType: 'cheque',
  });

  expect([400, 402, 409], `over-disbursal must be refused, got ${res.status}`).toContain(res.status);
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'float unchanged').toBe(floatBefore);
  expect(
    await db().loan.count({ where: { tenantId: s.tenantA.id } }),
    'the whole transaction rolls back — no loan row survives (DB-5)',
  ).toBe(loansBefore);
  } finally {
    await db().user.update({ where: { id: s.tenantA.agentHq!.id }, data: { bypassLoanApproval: false } });
  }
});

test('[ML-197] Invalid principal or tenure is rejected', async () => {
  const s = loadState();
  const admin = await adminSession();
  const before = await db().loan.count({ where: { tenantId: s.tenantA.id } });

  for (const body of [
    { principal: 0, tenure: 10 },
    { principal: 10000, tenure: 0 },
  ]) {
    const res = await originate(admin, {
      customerId: s.tenantA.customerHq,
      deduction: 0,
      deductionType: 'upfront_fixed',
      frequency: 'daily',
      startDate: isoDay(),
      loanType: 'cheque',
      ...body,
    });
    expect(res.status, `principal ${body.principal} / tenure ${body.tenure} must be refused`).toBe(400);
  }
  expect(await db().loan.count({ where: { tenantId: s.tenantA.id } }), 'no loan row created').toBe(before);
});

// ── Frequency and interest matrix ───────────────────────────────────────────

type FreqCase = {
  id: string;
  title: string;
  body: Record<string, unknown>;
  stateKey: string;
  expect: (loan: any, instalments: any[]) => void;
};

const dayGap = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

const FREQ_CASES: FreqCase[] = [
  {
    id: 'ML-215',
    title: 'Daily loan with an upfront fixed deduction',
    stateKey: 'freqDailyFixed',
    body: {
      principal: 30000,
      deduction: 3000,
      deductionType: 'upfront_fixed',
      tenure: 30,
      frequency: 'daily',
    },
    expect: (loan, instalments) => {
      expect(num(loan.totalPayable), 'upfront deduction leaves totalPayable at the principal').toBe(30000);
      expect(num(loan.disbursed), 'the deduction is taken at disbursal').toBe(27000);
      expect(instalments).toHaveLength(30);
      expect(dayGap(instalments[0].dueDate, instalments[1].dueDate), 'daily dues are one day apart').toBe(1);
    },
  },
  {
    id: 'ML-216',
    title: 'Daily loan with an upfront percentage deduction',
    stateKey: 'freqDailyPct',
    body: {
      principal: 20000,
      deduction: 10,
      deductionType: 'upfront_percentage',
      tenure: 20,
      frequency: 'daily',
    },
    expect: (loan) => {
      expect(num(loan.disbursed), '10% of the principal is deducted').toBe(18000);
      expect(num(loan.totalPayable)).toBe(20000);
    },
  },
  {
    id: 'ML-217',
    title: 'Weekly schedule steps by seven days',
    stateKey: 'freqWeekly',
    body: {
      principal: 20000,
      deduction: 2000,
      deductionType: 'upfront_fixed',
      tenure: 10,
      frequency: 'weekly',
    },
    expect: (_loan, instalments) => {
      expect(instalments).toHaveLength(10);
      for (let i = 1; i < instalments.length; i++) {
        expect(dayGap(instalments[i - 1].dueDate, instalments[i].dueDate), 'weekly dues are 7 days apart').toBe(7);
      }
    },
  },
  {
    id: 'ML-218',
    title: 'Bi-weekly schedule steps by fourteen days',
    stateKey: 'freqBiweekly',
    body: {
      principal: 24000,
      deduction: 2400,
      deductionType: 'upfront_fixed',
      tenure: 6,
      frequency: 'biweekly',
    },
    expect: (_loan, instalments) => {
      expect(instalments).toHaveLength(6);
      for (let i = 1; i < instalments.length; i++) {
        expect(dayGap(instalments[i - 1].dueDate, instalments[i].dueDate), 'bi-weekly dues are 14 days apart').toBe(
          14,
        );
      }
    },
  },
  {
    id: 'ML-219',
    title: 'Monthly schedule honours the chosen due day',
    stateKey: 'freqMonthly',
    body: {
      principal: 60000,
      deduction: 6000,
      deductionType: 'upfront_fixed',
      tenure: 12,
      frequency: 'monthly',
      dueDay: 10,
    },
    expect: (_loan, instalments) => {
      expect(instalments).toHaveLength(12);
      for (const instalment of instalments) {
        expect(new Date(instalment.dueDate).getDate(), 'every due date falls on the chosen day').toBe(10);
      }
    },
  },
  {
    id: 'ML-220',
    title: 'EMI flat interest adds interest on top of the principal',
    stateKey: 'freqEmiFlat',
    body: {
      principal: 100000,
      deduction: 12,
      deductionType: 'emi_flat',
      tenure: 12,
      frequency: 'monthly',
      dueDay: 5,
    },
    expect: (loan, instalments) => {
      expect(num(loan.totalPayable), 'principal + principal × rate%').toBe(112000);
      const sum = instalments.reduce((acc, i) => acc + num(i.dueAmount), 0);
      expect(Math.round(sum), 'the instalments add up to the total payable').toBe(112000);
    },
  },
  {
    id: 'ML-221',
    title: 'EMI floating uses a reducing-balance schedule',
    stateKey: 'freqEmiFloating',
    body: {
      principal: 100000,
      deduction: 18,
      deductionType: 'emi_floating',
      tenure: 12,
      frequency: 'monthly',
      dueDay: 5,
    },
    expect: (loan) => {
      expect(num(loan.totalPayable), 'a reducing-balance schedule still repays more than the principal').toBeGreaterThan(
        100000,
      );
      expect(num(loan.totalPayable), 'and less than the flat-interest total at the same rate').toBeLessThan(118000);
    },
  },
];

for (const freq of FREQ_CASES) {
  test(`[${freq.id}] ${freq.title}`, async () => {
    const s = loadState();
    const admin = await adminSession();

    const res = await originate(admin, {
      customerId: s.tenantA.customerHq,
      startDate: isoDay(),
      loanType: 'cheque',
      penaltyRate: 50,
      ...freq.body,
    });
    expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

    const loanId = res.data?.id ?? res.data?.loan?.id;
    const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
    const instalments = await db().instalment.findMany({
      where: { loanId: loan.id },
      orderBy: { instalmentNo: 'asc' },
    });

    freq.expect(loan, instalments);

    patchState((state) => {
      state.tenantA.loans[freq.stateKey] = loan.id;
    });
  });
}

test('[ML-222] Interest-only is refused when the tenant flag is off', async () => {
  const s = loadState();
  const owner = await ownerSession();
  await setTenantSetting(owner, 'interest_only_enabled', '0');
  const admin = await adminSession();

  const res = await originate(admin, {
    customerId: s.tenantA.customerHq,
    principal: 100000,
    deduction: 2,
    deductionType: 'interest_only',
    tenure: 6,
    frequency: 'monthly',
    dueDay: 5,
    startDate: isoDay(),
    loanType: 'cheque',
  });

  expect([400, 403], `interest-only must be refused while the flag is off, got ${res.status}`).toContain(res.status);
});

test('[ML-224] Interest-only with a non-monthly frequency is rejected', async () => {
  const s = loadState();
  const owner = await ownerSession();
  await setTenantSetting(owner, 'interest_only_enabled', '1');
  const admin = await adminSession();

  const res = await originate(admin, {
    customerId: s.tenantA.customerHq,
    principal: 100000,
    deduction: 2,
    deductionType: 'interest_only',
    tenure: 6,
    frequency: 'daily',
    startDate: isoDay(),
    loanType: 'cheque',
  });

  expect(res.status, 'a monthly rate must never be billed daily (MONEY-3)').toBe(400);
});

test('[ML-223] Interest-only bills interest monthly with a bullet principal', async () => {
  const s = loadState();
  const owner = await ownerSession();
  await setTenantSetting(owner, 'interest_only_enabled', '1');
  const admin = await adminSession();

  const res = await originate(admin, {
    customerId: s.tenantA.customerHq,
    principal: 100000,
    deduction: 2,
    deductionType: 'interest_only',
    tenure: 6,
    frequency: 'monthly',
    dueDay: 5,
    startDate: isoDay(),
    loanType: 'cheque',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data?.id ?? res.data?.loan?.id } });
  const instalments = await db().instalment.findMany({ where: { loanId: loan.id }, orderBy: { instalmentNo: 'asc' } });

  expect(instalments).toHaveLength(6);
  for (const instalment of instalments) {
    expect(num(instalment.dueAmount), 'every due is one month of interest').toBe(2000);
  }
  expect(num(loan.interestRate), 'the rate is persisted for recomputation (MONEY-5)').toBe(2);
  expect(num(loan.outstandingPrincipal), 'the bullet principal is carried on the loan').toBe(100000);
});

test('[ML-225] Rounding remainder lands on the final instalment', async () => {
  const s = loadState();
  const admin = await adminSession();

  // 10,007 over 3 dues does not divide evenly.
  const res = await originate(admin, {
    customerId: s.tenantA.customerHq,
    principal: 10007,
    deduction: 0,
    deductionType: 'upfront_fixed',
    tenure: 3,
    frequency: 'daily',
    startDate: isoDay(),
    loanType: 'cheque',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data?.id ?? res.data?.loan?.id } });
  const instalments = await db().instalment.findMany({ where: { loanId: loan.id }, orderBy: { instalmentNo: 'asc' } });

  const sum = instalments.reduce((acc, i) => acc + num(i.dueAmount), 0);
  expect(sum, 'the schedule adds up to the total payable exactly').toBe(num(loan.totalPayable));

  const front = instalments.slice(0, -1).map((i) => num(i.dueAmount));
  expect(new Set(front).size, 'every instalment but the last is identical').toBe(1);
  expect(num(instalments.at(-1)!.dueAmount), 'the remainder is absorbed by the final instalment').not.toBe(front[0]);
});

test('[ML-195] Instalment schedule is generated with the right row count', async () => {
  const s = loadState();
  const loans = await db().loan.findMany({ where: { tenantId: s.tenantA.id, appType: APP_TYPE } });
  expect(loans.length).toBeGreaterThan(3);

  for (const loan of loans) {
    if (loan.status === 'rejected' || loan.status === 'pending_review') continue;
    const instalments = await db().instalment.findMany({
      where: { loanId: loan.id },
      orderBy: { instalmentNo: 'asc' },
    });
    expect(instalments.length, `${loan.loanCode} has one row per instalment`).toBe(loan.totalInstalments);
    instalments.forEach((instalment, index) => {
      expect(instalment.instalmentNo, `${loan.loanCode} instalment numbers run 1..n`).toBe(index + 1);
    });
  }
});

test('[ML-226] Loan end date equals the last instalment due date', async () => {
  const s = loadState();
  const loans = await db().loan.findMany({ where: { tenantId: s.tenantA.id, status: { not: 'rejected' } } });

  for (const loan of loans) {
    const last = await db().instalment.findFirst({
      where: { loanId: loan.id },
      orderBy: { dueDate: 'desc' },
    });
    if (!last || !loan.endDate) continue;
    expect(
      new Date(loan.endDate).toISOString().slice(0, 10),
      `${loan.loanCode} ends on its last due date`,
    ).toBe(new Date(last.dueDate).toISOString().slice(0, 10));
  }
});

test('[ML-227] Persisted loan totals match the calculator preview', async () => {
  const s = loadState();
  const loans = await db().loan.findMany({
    where: { tenantId: s.tenantA.id, status: { in: ['active', 'closed'] } },
  });
  expect(loans.length).toBeGreaterThan(0);

  for (const loan of loans) {
    // interest_only bills interest on the schedule and settles the principal as
    // a bullet at closure, so its dues deliberately fall short of totalPayable
    // (MONEY-3, MONEY-5). ML-223 checks that shape on its own terms.
    if (loan.deductionType === 'interest_only') continue;

    const instalments = await db().instalment.findMany({ where: { loanId: loan.id } });
    const scheduled = instalments.reduce((sum, i) => sum + num(i.dueAmount), 0);

    // The quoted rate is not persisted for anything but interest_only (MONEY-5),
    // so the stored figures are checked against each other and against the
    // schedule the calculator actually produced.
    expect(Math.round(scheduled), `${loan.loanCode}: the schedule adds up to totalPayable`).toBe(
      Math.round(num(loan.totalPayable)),
    );

    const split = distributeInstalmentAmounts(num(loan.totalPayable), loan.totalInstalments);
    expect(num(loan.perInstalment), `${loan.loanCode}: perInstalment is the calculator's split`).toBe(split[0]);

    if ((loan.deductionType ?? '').startsWith('upfront')) {
      expect(num(loan.totalPayable), `${loan.loanCode}: an upfront deduction leaves totalPayable at principal`).toBe(
        num(loan.principal),
      );
      expect(num(loan.disbursed), `${loan.loanCode}: disbursed is principal less the deduction`).toBe(
        num(loan.principal) - num(loan.deduction),
      );
    }
  }
});

test('[ML-187] Contract numbers use the frequency prefix', async () => {
  const s = loadState();
  const expectations: Array<[string, RegExp]> = [
    ['daily', /^DL/i],
    ['weekly', /^WL/i],
    ['biweekly', /^BWL/i],
    ['monthly', /^ML/i],
  ];

  for (const [frequency, prefix] of expectations) {
    const loan = await db().loan.findFirst({
      where: { tenantId: s.tenantA.id, frequency, status: { not: 'rejected' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(loan, `a ${frequency} loan exists to check`).toBeTruthy();
    expect(loan!.loanCode, `${frequency} contracts carry the ${prefix} prefix (ORIG-1)`).toMatch(prefix);
  }
});

test('[ML-188] Contract numbers are unique tenant-wide', async () => {
  const s = loadState();
  const loans = await db().loan.findMany({ where: { tenantId: s.tenantA.id }, select: { loanCode: true } });
  const codes = loans.map((l) => l.loanCode);
  expect(codes.length).toBeGreaterThan(3);
  expect(new Set(codes).size, 'no contract number is reissued inside the tenant (ORIG-1)').toBe(codes.length);
});

test('[ML-189] Loan is stamped with the customer’s branch', async () => {
  const s = loadState();
  const owner = await ownerSession();

  // Filing for another branch's customer is refused outright — the customer
  // picker is branch-scoped, so the id is simply not in scope (SCOPE-16).
  const crossBranch = await originate(
    owner,
    {
      customerId: s.tenantA.customerHq,
      principal: 8000,
      deduction: 800,
      deductionType: 'upfront_fixed',
      tenure: 8,
      frequency: 'daily',
      startDate: isoDay(),
      loanType: 'cheque',
    },
    s.tenantA.branches.erode,
  );
  expect(
    crossBranch.status,
    'an HQ customer is out of scope while Erode is selected',
  ).toBeGreaterThanOrEqual(400);

  // Filed from the customer's own branch, the loan carries that branch.
  const res = await originate(
    owner,
    {
      customerId: s.tenantA.customerHq,
      principal: 8000,
      deduction: 800,
      deductionType: 'upfront_fixed',
      tenure: 8,
      frequency: 'daily',
      startDate: isoDay(),
      loanType: 'cheque',
    },
    s.tenantA.branches.hq,
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data?.id ?? res.data?.loan?.id } });
  const customer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  expect(loan.branchId, 'the loan is stamped with the customer’s branch (SCOPE-7)').toBe(customer.branchId);
});

test('[ML-194] Origination writes an audit row', async () => {
  const s = loadState();
  const loans = await db().loan.findMany({ where: { tenantId: s.tenantA.id }, select: { id: true, loanCode: true } });
  const audits = await db().auditLog.findMany({
    where: { tenantId: s.tenantA.id, entityType: 'loan' },
    select: { entityId: true },
  });
  const audited = new Set(audits.map((a) => a.entityId));

  for (const loan of loans) {
    expect(audited.has(loan.id), `${loan.loanCode} has an audit row (SEC-2)`).toBe(true);
  }
});

test('[ML-193] Origination writes the cash book', async () => {
  const s = loadState();
  const active = await db().loan.findMany({
    where: { tenantId: s.tenantA.id, status: { in: ['active', 'closed'] } },
    select: { id: true, loanCode: true },
  });
  expect(active.length).toBeGreaterThan(0);

  for (const loan of active) {
    const entries = await db().accountEntry.count({
      where: { tenantId: s.tenantA.id, referenceId: loan.id, type: 'loan_disburse' },
    });
    expect(entries, `${loan.loanCode} has a cash-book entry per payout leg (ACC-6)`).toBeGreaterThan(0);
  }
});

test('[ML-196] Schedule cannot be edited once money has moved', async () => {
  const s = loadState();
  const admin = await adminSession();
  const loanId = s.tenantA.loans.adminDaily;

  const res = await api.patch(`/api/v1/loans/${loanId}`, { tenure: 99, principal: 999999 }, { token: admin.token });
  const after = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  const instalments = await db().instalment.count({ where: { loanId } });

  expect(num(after.principal), 'an originated contract keeps its terms (MONEY-12, X-16)').not.toBe(999999);
  expect(after.totalInstalments, 'the tenure is not rewritten').not.toBe(99);
  expect(instalments, 'the schedule still matches the contract').toBe(after.totalInstalments);
  // Whether the route refuses loudly or ignores the fields, the contract must
  // be untouched — that is the invariant MONEY-12 actually protects.
  expect(res.status, `the edit did not corrupt the contract (status ${res.status})`).toBeLessThan(500);
});
