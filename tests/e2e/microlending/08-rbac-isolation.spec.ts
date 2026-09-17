import { expect, test, type Page } from '@playwright/test';
import { closeDb, db, num } from './support/db';
import { api, loginApi } from './support/api';
import { loadState } from './support/state';
import { ensureSession } from './support/session';
import { bodyText, gotoOk, mpath, setActiveBranch } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false).

const APP_TYPE = 'microlending';

test.afterAll(async () => {
  await closeDb();
});

/** A page is "refused" when it never renders its own content for this role. */
async function pageIsRefused(page: Page, path: string, marker: RegExp): Promise<boolean> {
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  if ((res?.status() ?? 200) >= 400) return true;
  if (!page.url().includes(path.split('?')[0])) return true; // redirected away
  const text = await bodyText(page);
  return !marker.test(text);
}

test('[ML-065] Agent is refused the settings page server-side', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });

  const refused = await pageIsRefused(page, mpath('/settings'), /penalty settings|loan packages|add agent|bulk import/i);
  expect(refused, 'the settings UI must never render for an agent (ROLE-4)').toBe(true);
});

test('[ML-066] Agent is refused reports, analytics, penalties and accounting', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });

  const checks: Array<[string, RegExp]> = [
    ['/reports', /run report|report catalog|export/i],
    ['/analytics', /portfolio|analytics dashboard|collection efficiency/i],
    ['/penalties', /waive|penalty ledger|accrued/i],
    ['/accounting', /trial balance|journal|ledger/i],
  ];

  for (const [path, marker] of checks) {
    const refused = await pageIsRefused(page, mpath(path), marker);
    expect(refused, `${path} must not render for an agent`).toBe(true);
  }
});

test('[ML-067] Agent cannot reach the module/branch selector portal', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });
  await page.goto('/portal', { waitUntil: 'domcontentloaded' });
  expect(page.url(), 'an agent is sent back to their own workspace').not.toMatch(/\/portal$/);
});

test('[ML-069] Agent count is capped by the subscription', async () => {
  const s = loadState();
  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: s.tenantA.id } });
  const agents = await db().user.count({ where: { tenantId: s.tenantA.id, role: 'agent' } });

  expect(sub.maxAgents, 'the plan carries an agent ceiling').toBeGreaterThan(0);
  expect(agents, 'the tenant is inside its agent ceiling').toBeLessThanOrEqual(sub.maxAgents);
});

test('[ML-070] A role change takes effect on the next request', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });

  // Promote in the database while the session cookie stays the same.
  await db().user.update({ where: { id: s.tenantA.agentHq!.id }, data: { role: 'admin' } });
  try {
    await page.goto(mpath('/approvals'), { waitUntil: 'domcontentloaded' });
    const text = await bodyText(page);
    expect(text, 'the promoted user reaches an admin-only page immediately').toMatch(/approval|pending|review/i);
  } finally {
    await db().user.update({ where: { id: s.tenantA.agentHq!.id }, data: { role: 'agent' } });
  }
});

test('[ML-048] "All Branches" is a null scope, not a role exemption', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const listOf = async (branchId: string | null) => {
    const res = await api.get('/api/v1/customers?limit=100', { token: owner.token, branchId });
    const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
    return rows.map((c: any) => c.id);
  };

  const all = await listOf(null);
  expect(all, 'All Branches shows the HQ customer').toContain(s.tenantA.customerHq);
  expect(all, 'All Branches shows the Erode customer').toContain(s.tenantA.customerErode);

  const hqOnly = await listOf(s.tenantA.branches.hq!);
  expect(hqOnly, 'picking one branch narrows the same list again').not.toContain(s.tenantA.customerErode);
});

test('[ML-301] Loans list never mixes branches', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const listOf = async (branchId: string) => {
    const res = await api.get('/api/v1/loans?limit=200', { token: owner.token, branchId });
    const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
    return rows.map((l: any) => l.id);
  };

  const hqApi = await listOf(s.tenantA.branches.hq!);
  const erodeApi = await listOf(s.tenantA.branches.erode!);

  const hqDb = (
    await db().loan.findMany({ where: { tenantId: s.tenantA.id, branchId: s.tenantA.branches.hq } })
  ).map((l) => l.id);

  for (const id of hqApi) {
    expect(hqDb, 'every row the HQ list returns is an HQ loan').toContain(id);
  }
  for (const id of erodeApi) {
    expect(hqDb, 'no HQ loan leaks into the Erode list').not.toContain(id);
  }
});

test('[ML-302] A loan detail page from another branch is not reachable', async ({ page }) => {
  const s = loadState();
  const erodeLoan = await db().loan.findFirst({
    where: { tenantId: s.tenantA.id, branchId: s.tenantA.branches.erode },
  });
  if (!erodeLoan) {
    // Give Erode a loan of its own so the case has something to reach for.
    const admin = await loginApi(s.tenantA.owner.username, s.password);
    await api.post(
      '/api/v1/loans',
      {
        customerId: s.tenantA.customerErode,
        principal: 6000,
        deduction: 600,
        deductionType: 'upfront_fixed',
        tenure: 6,
        frequency: 'daily',
        startDate: new Date().toISOString().slice(0, 10),
        loanType: 'cheque',
      },
      { token: admin.token, branchId: s.tenantA.branches.erode },
    );
  }
  const target = await db().loan.findFirstOrThrow({
    where: { tenantId: s.tenantA.id, branchId: s.tenantA.branches.erode },
  });

  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.hq!);
  const res = await page.goto(mpath(`/loans/${target.id}`), { waitUntil: 'domcontentloaded' });

  const text = await bodyText(page);
  const notFound = (res?.status() ?? 200) === 404 || /not found|could not be found/i.test(text);
  const leaked = text.includes(target.loanCode.toLowerCase());
  expect(leaked, 'another branch’s contract must never render here (SCOPE-3)').toBe(false);
  expect(notFound || !leaked).toBe(true);
});

test('[ML-303] Approvals queue is branch-scoped', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const queueOf = async (branchId: string) => {
    const res = await api.get('/api/v1/approvals', { token: owner.token, branchId });
    const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
    return rows.map((r: any) => r.entityId ?? r.id);
  };

  const hq = await queueOf(s.tenantA.branches.hq!);
  const erode = await queueOf(s.tenantA.branches.erode!);
  const overlap = hq.filter((id: string) => erode.includes(id));
  expect(overlap, 'no pending item belongs to two branches at once').toHaveLength(0);
});

test('[ML-304] Superadmin gets no branch-scope exemption', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  for (const endpoint of ['/api/v1/customers?limit=100', '/api/v1/loans?limit=100', '/api/v1/routes']) {
    const res = await api.get(endpoint, { token: owner.token, branchId: s.tenantA.branches.erode });
    const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
    for (const row of rows) {
      if (!row.branchId) continue;
      expect(row.branchId, `${endpoint} is limited to the selected branch (SCOPE-15)`).toBe(
        s.tenantA.branches.erode,
      );
    }
  }
});

test('[ML-305] Branch admin cannot reach another branch’s data', async () => {
  const s = loadState();
  const admin = await loginApi(s.tenantA.admin!.username, s.password);

  // The admin's branch is pinned in their token; the header must not steer it.
  const res = await api.get('/api/v1/customers?limit=100', {
    token: admin.token,
    branchId: s.tenantA.branches.erode,
  });
  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  const ids = rows.map((c: any) => c.id);

  expect(ids, 'an HQ admin never sees an Erode customer').not.toContain(s.tenantA.customerErode);
});

test('[ML-306] Every customer, loan and wallet row carries a branchId', async () => {
  const s = loadState();
  const [customers, loans, wallet] = await Promise.all([
    db().customer.count({ where: { tenantId: s.tenantA.id, branchId: null } }),
    db().loan.count({ where: { tenantId: s.tenantA.id, branchId: null } }),
    db().walletTransaction.count({ where: { tenantId: s.tenantA.id, branchId: null } }),
  ]);

  expect(customers, 'unbranched customers are a data defect (SCOPE-4)').toBe(0);
  expect(loans, 'unbranched loans are a data defect (SCOPE-4)').toBe(0);
  expect(wallet, 'unbranched wallet rows break isolation (SCOPE-13)').toBe(0);
});

test('[ML-307] Pickers and modals are branch-scoped too', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.erode!);
  await gotoOk(page, mpath('/loans/new'), 'new loan form on Erode');

  const options = await page
    .locator('select[name="customerId"] option')
    .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));

  expect(options, 'the Erode borrower is offered').toContain(s.tenantA.customerErode);
  expect(options, 'an HQ borrower must not be attachable from Erode (SCOPE-16)').not.toContain(
    s.tenantA.customerHq,
  );
});

test('[ML-308] Tenant isolation holds across the two registered tenants', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const foreignCustomer = await db().customer.findFirst({ where: { tenantId: s.tenantB.id } });
  const foreignLoan = await db().loan.findFirst({ where: { tenantId: s.tenantB.id } });
  const foreignBranch = s.tenantB.branchHq!;

  if (foreignCustomer) {
    const res = await api.get(`/api/v1/customers/${foreignCustomer.id}`, { token: owner.token });
    expect(res.status, 'another tenant’s customer is 404').toBe(404);
  }
  if (foreignLoan) {
    const res = await api.get(`/api/v1/loans/${foreignLoan.id}`, { token: owner.token });
    expect(res.status, 'another tenant’s loan is 404').toBe(404);
  }

  // A forged branch header cannot reach into tenant B either.
  const res = await api.get('/api/v1/customers?limit=100', { token: owner.token, branchId: foreignBranch });
  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  for (const row of rows) {
    const customer = await db().customer.findUnique({ where: { id: row.id }, select: { tenantId: true } });
    expect(customer?.tenantId, 'no row from another tenant is ever returned (SCOPE-1)').toBe(s.tenantA.id);
  }
});

test('[ML-310] Agent list served to mobile is branch-scoped', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const res = await api.get('/api/v1/agents', { token: owner.token, branchId: s.tenantA.branches.erode });
  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  const ids = rows.map((a: any) => a.id);

  expect(ids, 'the Erode agent is listed').toContain(s.tenantA.agentErode!.id);
  expect(ids, 'the HQ agent must not be (SCOPE-12)').not.toContain(s.tenantA.agentHq!.id);
});

test('[ML-400] Out-of-scope records return 404, never 403', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  for (const path of [
    '/api/v1/customers/cl00000000000000000000000',
    '/api/v1/loans/cl00000000000000000000000',
  ]) {
    const res = await api.get(path, { token: owner.token });
    expect(res.status, `${path} answers 404 for an unknown id (API-5, X-12)`).toBe(404);
  }
});

test('[ML-401] Agent token is refused on admin-only endpoints', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);

  const checks: Array<[string, () => Promise<any>]> = [
    ['wallet/branch', () => api.get('/api/v1/wallet/branch', { token: agent.token })],
    ['wallet/release', () =>
      api.post('/api/v1/wallet/release', { agentId: s.tenantA.agentHq!.id, amount: 100 }, { token: agent.token })],
    ['settings', () => api.get('/api/v1/settings', { token: agent.token })],
  ];

  for (const [label, call] of checks) {
    const res = await call();
    expect([401, 403], `${label} must refuse an agent token, got ${res.status}`).toContain(res.status);
  }
});

test('[ML-402] A forged x-zolofund-* header is ignored', async () => {
  const s = loadState();
  const admin = await loginApi(s.tenantA.admin!.username, s.password);

  const res = await api.get('/api/v1/customers?limit=100', {
    token: admin.token,
    headers: {
      'x-zolofund-active-branch': s.tenantA.branches.erode!,
      'x-zolofund-tenant-slug': s.tenantB.slug,
    },
  });
  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  const ids = rows.map((c: any) => c.id);

  expect(ids, 'a hand-set proxy header must not widen scope (REQ-2)').not.toContain(s.tenantA.customerErode);
});

test('[ML-403] Password hashes and tokens never appear in responses', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  for (const path of ['/api/v1/agents', '/api/v1/customers?limit=20', '/api/v1/auth/me']) {
    const res = await api.get(path, { token: owner.token });
    const body = JSON.stringify(res.raw ?? {});
    // Not "is the value null today" — the field must not be in the payload at
    // all, or the day a borrower sets a portal password it ships their hash.
    expect(body, `${path} must not carry a password-hash field (X-13)`).not.toMatch(
      /"password_?[Hh]ash"/,
    );
    expect(body, `${path} leaks no bcrypt digest`).not.toMatch(/\$2[aby]\$/);
    expect(body, `${path} leaks no secret`).not.toMatch(/NEXTAUTH_SECRET|MOBILE_JWT_SECRET/);
  }
});

test('[ML-407] Agents cannot switch module via X-App-Type', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);

  const res = await api.get('/api/v1/customers?limit=20', { token: agent.token, appType: 'goldloan' });
  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];

  for (const row of rows) {
    const customer = await db().customer.findUnique({ where: { id: row.id }, select: { appType: true } });
    expect(customer?.appType, 'an agent stays pinned to their own module (AUTH-3)').toBe(APP_TYPE);
  }
});

test('[ML-365] Dashboard renders for superadmin, admin and agent', async ({ page }) => {
  const s = loadState();
  const roles: Array<['owner' | 'admin' | 'agentHq', string]> = [
    ['owner', s.tenantA.owner.username],
    ['admin', s.tenantA.admin!.username],
    ['agentHq', s.tenantA.agentHq!.username],
  ];

  for (const [role, username] of roles) {
    await page.context().clearCookies();
    await ensureSession(page, role, { username, password: s.password });
    await gotoOk(page, mpath('/dashboard'), `${role} dashboard`);
    const text = await bodyText(page);
    expect(text.length, `${role} dashboard renders content`).toBeGreaterThan(50);
  }
});

test('[ML-366] Dashboard KPI figures match the underlying rows', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const res = await api.get('/api/v1/dashboard', { token: owner.token, branchId: s.tenantA.branches.hq });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(400);

  const dbActive = await db().loan.count({
    where: { tenantId: s.tenantA.id, appType: APP_TYPE, branchId: s.tenantA.branches.hq, status: 'active' },
  });

  const payload = res.data ?? {};
  const reported =
    payload.activeLoans ?? payload.totals?.activeLoans ?? payload.kpis?.activeLoans ?? payload.summary?.activeLoans;

  if (reported === undefined) {
    test.skip(true, 'the dashboard payload does not expose an active-loan count to compare');
  }
  expect(Number(reported), 'the KPI equals the branch-scoped query').toBe(dbActive);
});

test('[ML-367] Reports index lists the micro-lending reports', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'admin', { username: s.tenantA.admin!.username, password: s.password });
  await gotoOk(page, mpath('/reports'), 'reports index');

  const text = await bodyText(page);
  expect(text, 'the report catalog renders').toMatch(/report/i);
});

test('[ML-368] Agent performance report is branch-scoped', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const reportFor = async (branchId: string) => {
    const res = await api.get('/api/v1/reports/agent', { token: owner.token, branchId });
    const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? res.data?.rows ?? [];
    return rows.map((r: any) => r.agentId ?? r.id ?? r.name);
  };

  const hq = await reportFor(s.tenantA.branches.hq!);
  const erode = await reportFor(s.tenantA.branches.erode!);

  expect(hq, 'the Erode agent must not appear in the HQ report (SCOPE-12)').not.toContain(s.tenantA.agentErode!.id);
  expect(erode, 'and vice versa').not.toContain(s.tenantA.agentHq!.id);
});

test('[ML-370] Analytics is closed to agents', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const res = await api.get('/api/v1/analytics/summary', { token: agent.token });
  expect([401, 403], `analytics must refuse an agent, got ${res.status}`).toContain(res.status);
});

test('[ML-430] Every approval request pairs with an approver notification', async () => {
  const s = loadState();
  const requests = await db().approvalRequest.count({ where: { tenantId: s.tenantA.id } });
  const notifications = await db().systemNotification.count({ where: { tenantId: s.tenantA.id } });

  expect(requests, 'the run raised approval requests').toBeGreaterThan(0);
  expect(notifications, 'each of them reached an approver (X-23)').toBeGreaterThanOrEqual(requests);
});

test('[ML-431] Notifications page lists staff notifications', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'admin', { username: s.tenantA.admin!.username, password: s.password });
  await gotoOk(page, mpath('/notifications'), 'notifications page');
  const text = await bodyText(page);
  expect(text, 'the notification centre renders').toMatch(/notification|approval|request|no notifications/i);
});

test('[ML-445] Borrower login page renders', async ({ page }) => {
  await page.context().clearCookies();
  await gotoOk(page, '/borrower/login', 'borrower login');
  const inputs = await page.locator('input').count();
  expect(inputs, 'the borrower login form has fields').toBeGreaterThan(0);
});

test('[ML-406] A suspended tenant is walled off but can still reach billing', async ({ page }) => {
  const s = loadState();
  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: s.tenantA.id } });

  await db().tenantSubscription.update({ where: { tenantId: s.tenantA.id }, data: { status: 'suspended' } });
  try {
    await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
    await page.goto(mpath('/dashboard'), { waitUntil: 'domcontentloaded' });
    const walled = await bodyText(page);
    expect(walled, 'a suspended tenant meets the payment wall').toMatch(
      /subscription|payment|billing|suspended|renew/i,
    );

    await page.goto('/portal/billing', { waitUntil: 'domcontentloaded' });
    const billing = await bodyText(page);
    expect(billing.length, 'billing stays reachable so they can pay').toBeGreaterThan(20);
  } finally {
    await db().tenantSubscription.update({
      where: { tenantId: s.tenantA.id },
      data: { status: sub.status },
    });
  }
});

test('[ML-309] Branch cash pools never aggregate each other', async () => {
  const s = loadState();
  const pools = await db().branchCashAccount.findMany({ where: { tenantId: s.tenantA.id, appType: APP_TYPE } });
  expect(pools.length, 'both branches hold their own pool').toBeGreaterThan(1);

  for (const pool of pools) {
    const movements = await db().walletTransaction.findMany({
      where: { tenantId: s.tenantA.id, appType: APP_TYPE, branchId: pool.branchId, accountKind: 'branch' },
    });
    const sum = movements.reduce((acc, m) => acc + num(m.amount), 0);
    expect(Math.round(num(pool.balance)), `${pool.branchId} equals its own movements only`).toBe(Math.round(sum));
  }
});
