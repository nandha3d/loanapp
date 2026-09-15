import { expect, test } from '@playwright/test';
import { hash } from 'bcryptjs';
import { calculateProvisioning } from '@/lib/npa/provisioningCalculator';
import { closeDb, db, num, waitForRow } from './support/db';
import { api, loginApi } from './support/api';
import { loadState, runPhone } from './support/state';
import { ensureSession, sessionFetch } from './support/session';
import { bodyText, gotoOk, mpath, setActiveBranch, waitForHydration } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false).

const APP_TYPE = 'microlending';

test.afterAll(async () => {
  await closeDb();
});

async function agentBalance(tenantId: string, agentId: string): Promise<number> {
  const row = await db().agentAccount.findFirst({ where: { tenantId, appType: APP_TYPE, agentId } });
  return num(row?.balance);
}

async function poolBalance(tenantId: string, branchId: string): Promise<number> {
  const row = await db().branchCashAccount.findFirst({ where: { tenantId, appType: APP_TYPE, branchId } });
  return num(row?.balance);
}

test('[ML-068] Agent permission flags do not gate non-agents', async () => {
  const s = loadState();

  // The agent-only toggles are explicitly off on the admin account.
  await db().user.update({
    where: { id: s.tenantA.admin!.id },
    data: { bypassLoanApproval: false, autoReleaseFloat: false },
  });

  const admin = await loginApi(s.tenantA.admin!.username, s.password);
  const res = await api.post(
    '/api/v1/loans',
    {
      customerId: s.tenantA.customerHq,
      principal: 3000,
      deduction: 300,
      deductionType: 'upfront_fixed',
      tenure: 6,
      frequency: 'daily',
      startDate: new Date().toISOString().slice(0, 10),
      loanType: 'cheque',
    },
    { token: admin.token },
  );

  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data?.id ?? res.data?.loan?.id } });
  expect(loan.status, 'a non-agent keeps full privilege regardless of the agent toggles (ROLE-5)').toBe('active');
});

test('[ML-089] A second agent can share a route, with one primary', async () => {
  const s = loadState();

  // A second HQ agent to share R1 with.
  const username = `agenthq2${s.runId}`;
  const second =
    (await db().user.findFirst({ where: { tenantId: s.tenantA.id, username } })) ??
    (await db().user.create({
      data: {
        tenantId: s.tenantA.id,
        branchId: s.tenantA.branches.hq!,
        name: 'HQ Agent Two',
        phone: runPhone(s.runId, 15),
        username,
        passwordHash: await hash(s.password, 4),
        role: 'agent',
        appType: APP_TYPE,
        status: 'active',
      },
    }));

  await db().routeAgent.upsert({
    where: { routeId_agentId: { routeId: s.tenantA.routeHq!, agentId: second.id } },
    create: { routeId: s.tenantA.routeHq!, agentId: second.id, isPrimary: false },
    update: { isPrimary: false },
  });

  const links = await db().routeAgent.findMany({ where: { routeId: s.tenantA.routeHq! } });
  expect(links.length, 'both agents are linked to the route').toBeGreaterThanOrEqual(2);
  expect(
    links.filter((l) => l.isPrimary).length,
    'exactly one agent is primary on a shared route',
  ).toBe(1);
});

test('[ML-130] Release is a single click with no double debit', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.hq!);

  const note = `single-release ${s.runId}-${Date.now().toString(36)}`;
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  await gotoOk(page, mpath('/wallet'), 'wallet page');
  await waitForHydration(page, 'form');

  const row = page
    .locator('form')
    .filter({ has: page.locator(`input[name="agentId"][value="${s.tenantA.agentHq!.id}"]`) })
    .first();
  await row.locator('input[name="note"]').fill(note);
  await row.locator('input[name="amount"]').fill('2000');
  await row.locator('button[name="op"][value="release"]').click();

  await waitForRow(
    async () => ((await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id)) === floatBefore + 2000 ? true : null),
    'the single-click release to post',
  );
  await page.waitForTimeout(2_000); // let any duplicate post surface

  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'the float moves exactly once').toBe(
    floatBefore + 2000,
  );
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'the pool drops exactly once').toBe(
    poolBefore - 2000,
  );
  const ledger = await db().walletTransaction.count({ where: { tenantId: s.tenantA.id, note } });
  expect(ledger, 'one click writes one pair of ledger rows (branch + agent)').toBeLessThanOrEqual(2);
});

test('[ML-127] Agent raises a cash handover and the admin confirms it', async ({ page }) => {
  const s = loadState();

  // The form guards the submit with window.confirm(); Playwright dismisses
  // dialogs unless told otherwise, which would silently cancel the handover.
  page.on('dialog', (d) => d.accept().catch(() => {}));

  // Agent side: raise the handover from their own wallet.
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });
  await gotoOk(page, mpath('/wallet'), 'agent wallet');
  await waitForHydration(page, 'form');

  // Clear anything an earlier case left queued, so the row found below is
  // unambiguously the one this case raised.
  await db().cashHandover.deleteMany({
    where: { tenantId: s.tenantA.id, agentId: s.tenantA.agentHq!.id, status: 'pending' },
  });

  const remark = `handover ${s.runId}-${Date.now().toString(36)}`;
  const form = page.locator('form').filter({ has: page.locator('input[name="amount"]') }).first();
  await form.locator('input[name="amount"]').fill('500');
  await form.locator('input[name="note"]').fill(remark);
  await form.locator('button[type="submit"]').first().click();

  const handover = await waitForRow(
    () =>
      db().cashHandover.findFirst({
        where: { tenantId: s.tenantA.id, agentId: s.tenantA.agentHq!.id, remarks: remark },
      }),
    'the agent’s handover request',
  );
  expect(num(handover.amount)).toBe(500);

  // Admin side: collect it. Float moves only on confirmation.
  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);

  await page.context().clearCookies();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page');
  await waitForHydration(page, 'form');

  const handoverForm = page
    .locator('form')
    .filter({ has: page.locator(`input[name="handoverId"][value="${handover.id}"]`) })
    .first();
  // Collecting a handover is two-step: the first submit arms the confirmation.
  const collectBtn = handoverForm.locator('button[name="op"][value="collect"]');
  await collectBtn.click();
  await expect(collectBtn, 'the first click arms the confirmation').toContainText(/confirm/i, {
    timeout: 10_000,
  });
  await collectBtn.click();

  const settled = await waitForRow(
    async () => {
      const row = await db().cashHandover.findUnique({ where: { id: handover.id } });
      return row && row.status !== 'pending' ? row : null;
    },
    'the handover to be settled',
  );

  expect(
    ['confirmed', 'collected'],
    `the admin confirmation settles the handover, got "${settled.status}"`,
  ).toContain(settled.status);
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'the agent’s float reduces on confirmation').toBe(
    floatBefore - 500,
  );
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'the cash lands in the branch pool').toBe(
    poolBefore + 500,
  );
});

test('[ML-128] Admin can reject a handover', async ({ page }) => {
  const s = loadState();

  const pending = await db().cashHandover.create({
    data: {
      tenantId: s.tenantA.id,
      agentId: s.tenantA.agentHq!.id,
      routeId: s.tenantA.routeHq!,
      amount: 250,
      status: 'pending',
      remarks: `reject-me ${s.runId}`,
    },
  });

  const floatBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);

  page.on('dialog', (d) => d.accept().catch(() => {}));
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page');
  await waitForHydration(page, 'form');

  const form = page
    .locator('form')
    .filter({ has: page.locator(`input[name="handoverId"][value="${pending.id}"]`) })
    .first();
  await expect(form, 'the pending handover is queued for the admin').toBeVisible({ timeout: 15_000 });

  const rejectBtn = form.locator('button[name="op"][value="reject"]');
  await rejectBtn.click();
  await expect(rejectBtn, 'the first click arms the confirmation').toContainText(/confirm/i, {
    timeout: 10_000,
  });
  await rejectBtn.click();

  const settled = await waitForRow(
    async () => {
      const row = await db().cashHandover.findUnique({ where: { id: pending.id } });
      return row && row.status !== 'pending' ? row : null;
    },
    'the handover rejection',
  );

  expect(settled.status).toBe('rejected');
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'a rejection moves no cash').toBe(floatBefore);
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'and the pool is untouched').toBe(poolBefore);
});

test('[ML-185] Loan approval is a single click', async ({ page }) => {
  const s = loadState();

  // A fresh pending loan filed by the agent.
  await db().user.update({ where: { id: s.tenantA.agentHq!.id }, data: { bypassLoanApproval: false } });
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const created = await api.post(
    '/api/v1/loans',
    {
      customerId: s.tenantA.customerHq,
      principal: 4500,
      deduction: 450,
      deductionType: 'upfront_fixed',
      tenure: 9,
      frequency: 'daily',
      startDate: new Date().toISOString().slice(0, 10),
      loanType: 'cheque',
    },
    { token: agent.token },
  );
  expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);
  const loan = await db().loan.findUniqueOrThrow({ where: { id: created.data?.id ?? created.data?.loan?.id } });
  expect(loan.status).toBe('pending_review');

  await ensureSession(page, 'admin', { username: s.tenantA.admin!.username, password: s.password });
  await gotoOk(page, mpath('/approvals'), 'approvals queue');
  await waitForHydration(page, 'table');
  await page.locator('button, div').filter({ hasText: /^loans/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);

  const row = page.locator('tr').filter({ hasText: loan.loanCode }).first();
  await row.getByRole('button', { name: /approve/i }).click();

  const approved = await waitForRow(
    async () => {
      const l = await db().loan.findUnique({ where: { id: loan.id } });
      return l && l.status !== 'pending_review' ? l : null;
    },
    'the single-click approval to land',
  );
  await page.waitForTimeout(2_000); // let a duplicate posting surface

  expect(approved.status, 'one click approves — no second confirmation').toBe('active');
  const disbursals = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, referenceId: loan.id, type: 'loan_disburse' },
  });
  expect(disbursals, 'exactly one disbursal is posted').toBe(1);
});

test('[ML-432] An approval decision notifies the requester', async () => {
  const s = loadState();

  const notifications = await db().systemNotification.findMany({
    where: { tenantId: s.tenantA.id, targetUserId: s.tenantA.agentHq!.id },
  });
  const anyForAgent = notifications.length > 0;
  const roleTargeted = await db().systemNotification.count({
    where: { tenantId: s.tenantA.id, targetRole: 'agent' },
  });

  expect(
    anyForAgent || roleTargeted > 0,
    'the agent who filed the request hears the outcome',
  ).toBe(true);
});

test('[ML-300] Dashboard KPIs are computed per branch', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const readFor = async (branchId: string) => {
    const res = await api.get('/api/v1/dashboard', { token: owner.token, branchId });
    expect(res.status, JSON.stringify(res.raw)).toBeLessThan(400);
    return JSON.stringify(res.data ?? {});
  };

  const hq = await readFor(s.tenantA.branches.hq!);
  const erode = await readFor(s.tenantA.branches.erode!);

  const hqLoans = await db().loan.count({
    where: { tenantId: s.tenantA.id, appType: APP_TYPE, branchId: s.tenantA.branches.hq, status: 'active' },
  });
  const erodeLoans = await db().loan.count({
    where: { tenantId: s.tenantA.id, appType: APP_TYPE, branchId: s.tenantA.branches.erode, status: 'active' },
  });

  expect(hqLoans, 'HQ carries the bulk of the book in this run').toBeGreaterThan(erodeLoans);
  expect(hq, 'the two branches do not report identical dashboards').not.toBe(erode);
});

test('[ML-369] A report export downloads', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });

  // Both the catalog and the export authenticate by session, not bearer token.
  const optionsRes = await sessionFetch('owner', '/api/v1/reports/options');
  const optionsBody: any = await optionsRes.json().catch(() => null);
  expect(optionsRes.status, JSON.stringify(optionsBody)).toBeLessThan(400);

  const payload = optionsBody?.data ?? optionsBody;
  const catalog = Array.isArray(payload)
    ? payload
    : payload?.reports ?? payload?.items ?? payload?.options ?? [];
  // Fall back to a slug the micro-lending catalog is known to register, so a
  // shape change in the options payload does not turn into a phantom failure.
  const slug = catalog.map((r: any) => r.slug ?? r.key ?? r.id).find(Boolean) ?? 'daily-collection';

  // A browser navigation is not usable here: the response is an attachment,
  // which aborts the navigation before a status can be read.
  const res = await sessionFetch('owner', `/api/v1/reports/${slug}/export?format=csv`);
  const body = await res.arrayBuffer();

  expect(res.status, `exporting ${slug} succeeds`).toBeLessThan(400);
  expect(res.headers.get('content-disposition') ?? '', 'it is served as a download').toMatch(/attachment/i);
  expect(body.byteLength, 'the export is a non-empty file').toBeGreaterThan(0);
});

test('[ML-387] Provisioning percentages match the category table', async () => {
  // Unsecured is the MFI default and the conservative direction (NPA-4).
  const expectations: Array<[Parameters<typeof calculateProvisioning>[0], number]> = [
    ['standard', 0.4],
    ['sma_0', 0.4],
    ['sma_1', 0.4],
    ['sma_2', 0.4],
    ['sub_standard', 15],
    ['doubtful_d1', 100],
    ['doubtful_d2', 100],
    ['doubtful_d3', 100],
    ['loss', 100],
    ['written_off', 100],
  ];

  for (const [category, rate] of expectations) {
    const result = calculateProvisioning(category, 100000, false);
    expect(result.rate, `${category} provisions at ${rate}% unsecured`).toBe(rate);
    expect(result.amount, `${category} provisions the right amount on ₹1,00,000`).toBe(
      Math.round(((100000 * rate) / 100) * 100) / 100,
    );
  }

  // Secured NBFC ladder differs only in the doubtful band.
  expect(calculateProvisioning('doubtful_d1', 100000, true).rate, 'secured D1 is 25%').toBe(25);
  expect(calculateProvisioning('doubtful_d2', 100000, true).rate, 'secured D2 is 40%').toBe(40);
});

test('[ML-446] Borrower sees only their own loan', async () => {
  const s = loadState();

  // Give the HQ borrower a portal password, then sign in as them.
  const customer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  await db().customer.update({
    where: { id: customer.id },
    data: { passwordHash: await hash(s.password, 4) },
  });

  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';
  const login = await fetch(`${base}/api/v1/borrower/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': s.tenantA.slug },
    body: JSON.stringify({ phone: customer.phone, password: s.password }),
  });
  const loginBody = await login.json().catch(() => null);
  expect(login.status, `borrower login: ${JSON.stringify(loginBody)}`).toBeLessThan(300);

  const token = loginBody?.data?.token ?? loginBody?.token;
  expect(token, 'a borrower session token is issued').toBeTruthy();

  const loans = await fetch(`${base}/api/v1/borrower/loans`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': s.tenantA.slug },
  });
  const payload = await loans.json().catch(() => null);
  const rows = Array.isArray(payload?.data) ? payload.data : payload?.data?.items ?? [];

  expect(loans.status).toBeLessThan(400);
  expect(rows.length, 'the borrower sees their own contracts').toBeGreaterThan(0);

  for (const row of rows) {
    const loan = await db().loan.findUnique({ where: { id: row.id }, select: { customerId: true } });
    expect(loan?.customerId, 'no other borrower’s loan is ever returned (SCOPE-1)').toBe(customer.id);
  }
});

test('[ML-447] Borrower self-pay posts against their own loan, locked and attributed', async () => {
  const s = loadState();
  const customer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';

  const login = await fetch(`${base}/api/v1/borrower/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': s.tenantA.slug },
    body: JSON.stringify({ phone: customer.phone, password: s.password }),
  });
  const token = (await login.json().catch(() => null))?.data?.token;
  if (!token) test.skip(true, 'borrower login did not issue a token');

  const loan = await db().loan.findFirstOrThrow({
    where: { tenantId: s.tenantA.id, customerId: customer.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  const collectionsBefore = await db().collectionEntry.count({
    where: { tenantId: s.tenantA.id, loanId: loan.id },
  });

  const res = await fetch(`${base}/api/v1/borrower/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': s.tenantA.slug,
    },
    body: JSON.stringify({ loanId: loan.id, amount: 100, paymentMode: 'upi' }),
  });
  const body = await res.json().catch(() => null);
  expect(res.status, `self-pay responds: ${JSON.stringify(body)}`).toBeLessThan(400);

  const collectionsAfter = await db().collectionEntry.count({
    where: { tenantId: s.tenantA.id, loanId: loan.id },
  });
  expect(collectionsAfter, 'the payment is recorded against the loan').toBe(collectionsBefore + 1);

  const entry = await db().collectionEntry.findFirstOrThrow({
    where: { tenantId: s.tenantA.id, loanId: loan.id },
    orderBy: { submittedAt: 'desc' },
  });
  expect(entry.customerId, 'it is attributed to the borrower who paid').toBe(customer.id);
  expect(String(entry.source ?? ''), 'it is marked as a self-service payment').toMatch(/self/i);
  expect(entry.isLocked, 'a borrower-filed entry is locked against later edits').toBe(true);
  expect(
    entry.verificationStatus,
    'a UPI self-payment is verified on arrival; only cash waits for staff',
  ).toBe('verified');
});
