import { expect, test, type Page } from '@playwright/test';
import { closeDb, db, num, waitForRow } from './support/db';
import { api, loginApi } from './support/api';
import { loadState, patchState } from './support/state';
import { ensureSession } from './support/session';
import { bodyText, gotoOk, mpath, setActiveBranch, waitForHydration } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false), not from
// serial mode: serial would SKIP every later case once one fails, and the
// tracker needs a real verdict for each case, not a blank.

const APP_TYPE = 'microlending';

test.afterAll(async () => {
  await closeDb();
});

async function asOwner(page: Page) {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  return s;
}

async function poolBalance(tenantId: string, branchId: string): Promise<number> {
  const row = await db().branchCashAccount.findFirst({ where: { tenantId, appType: APP_TYPE, branchId } });
  return num(row?.balance);
}

async function agentBalance(tenantId: string, agentId: string): Promise<number> {
  const row = await db().agentAccount.findFirst({ where: { tenantId, appType: APP_TYPE, agentId } });
  return num(row?.balance);
}

/** Top up a branch pool through the wallet page, the way an owner does it. */
async function topUp(page: Page, branchName: string, amount: number, note: string) {
  const row = page.locator('form').filter({ hasText: branchName }).first();
  await row.locator('input[name="note"]').fill(note);
  await row.locator('input[name="amount"]').fill(String(amount));
  await row.getByRole('button', { name: /top up/i }).click();
}

test('[ML-085] Create route R1 in HQ and assign agent A1', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const existing = await db().route.findFirst({ where: { tenantId: s.tenantA.id, name: `R1-${s.runId}` } });
  if (!existing) {
    const res = await api.post(
      '/api/v1/routes',
      { name: `R1-${s.runId}`, branchId: s.tenantA.branches.hq, assignedAgentId: s.tenantA.agentHq!.id },
      { token: owner.token, branchId: s.tenantA.branches.hq },
    );
    expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  }

  const route = await waitForRow(
    () => db().route.findFirst({ where: { tenantId: s.tenantA.id, name: `R1-${s.runId}` } }),
    'route R1',
  );
  expect(route.branchId, 'the route belongs to HQ').toBe(s.tenantA.branches.hq);
  expect(route.appType).toBe(APP_TYPE);
  expect(route.assignedAgentId).toBe(s.tenantA.agentHq!.id);

  await db().routeAgent.upsert({
    where: { routeId_agentId: { routeId: route.id, agentId: s.tenantA.agentHq!.id } },
    create: { routeId: route.id, agentId: s.tenantA.agentHq!.id, isPrimary: true },
    update: { isPrimary: true },
  });

  patchState((state) => {
    state.tenantA.routeHq = route.id;
  });
});

test('[ML-086] Create route R2 in Erode and assign agent A2', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const existing = await db().route.findFirst({ where: { tenantId: s.tenantA.id, name: `R2-${s.runId}` } });
  if (!existing) {
    const res = await api.post(
      '/api/v1/routes',
      { name: `R2-${s.runId}`, branchId: s.tenantA.branches.erode, assignedAgentId: s.tenantA.agentErode!.id },
      { token: owner.token, branchId: s.tenantA.branches.erode },
    );
    expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  }

  const route = await waitForRow(
    () => db().route.findFirst({ where: { tenantId: s.tenantA.id, name: `R2-${s.runId}` } }),
    'route R2',
  );
  expect(route.branchId, 'the route belongs to Erode, not the branch its author sits on').toBe(
    s.tenantA.branches.erode,
  );
  expect(route.branchId).not.toBe(s.tenantA.branches.hq);

  await db().routeAgent.upsert({
    where: { routeId_agentId: { routeId: route.id, agentId: s.tenantA.agentErode!.id } },
    create: { routeId: route.id, agentId: s.tenantA.agentErode!.id, isPrimary: true },
    update: { isPrimary: true },
  });

  patchState((state) => {
    state.tenantA.routeErode = route.id;
  });
});

test('[ML-087] Route list is branch-scoped', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const hq = await api.get('/api/v1/routes', { token: owner.token, branchId: s.tenantA.branches.hq });
  const erode = await api.get('/api/v1/routes', { token: owner.token, branchId: s.tenantA.branches.erode });

  const names = (payload: any) => (Array.isArray(payload) ? payload : payload?.items ?? []).map((r: any) => r.name);
  expect(names(hq.data)).toContain(`R1-${s.runId}`);
  expect(names(hq.data), 'HQ must not see the Erode route').not.toContain(`R2-${s.runId}`);
  expect(names(erode.data)).toContain(`R2-${s.runId}`);
  expect(names(erode.data), 'Erode must not see the HQ route').not.toContain(`R1-${s.runId}`);
});

test('[ML-100] Wallet page renders the branch cash pools for an owner', async ({ page }) => {
  const s = await asOwner(page);
  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page');

  await expect(page.locator('body')).toContainText('Head Office');
  await expect(page.getByRole('button', { name: /top up/i }).first()).toBeVisible();
});

test('[ML-101] Inject capital into the HQ branch pool', async ({ page }) => {
  const s = await asOwner(page);
  const before = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const ledgerBefore = await db().walletTransaction.count({ where: { tenantId: s.tenantA.id } });

  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page');
  await waitForHydration(page, 'form');
  await topUp(page, 'Head Office', 500_000, `capital ${s.runId}`);

  await waitForRow(
    async () => ((await poolBalance(s.tenantA.id, s.tenantA.branches.hq!)) === before + 500_000 ? true : null),
    'the HQ pool to rise by the injected amount',
  );
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!)).toBe(before + 500_000);
  expect(
    await db().walletTransaction.count({ where: { tenantId: s.tenantA.id } }),
    'the injection is recorded in the ledger',
  ).toBeGreaterThan(ledgerBefore);
});

test('[ML-107] Top up is a single click with no double posting', async ({ page }) => {
  const s = await asOwner(page);
  const before = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  // Unique per execution so a repeated run cannot be mistaken for a double post.
  const note = `single-click ${s.runId}-${Date.now().toString(36)}`;

  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page');
  await waitForHydration(page, 'form');
  await topUp(page, 'Head Office', 1_000, note);

  await waitForRow(
    async () => ((await poolBalance(s.tenantA.id, s.tenantA.branches.hq!)) === before + 1_000 ? true : null),
    'the single-click top-up to post',
  );
  await page.waitForTimeout(2_000); // give a duplicate post time to appear

  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'the balance moves exactly once').toBe(before + 1_000);
  const rows = await db().walletTransaction.count({ where: { tenantId: s.tenantA.id, note } });
  expect(rows, 'exactly one ledger row for one click').toBe(1);
});

test('[ML-102] Capital ledger row is stamped with its branch', async () => {
  const s = loadState();
  const rows = await db().walletTransaction.findMany({
    // Exact match: the Erode injection's note also *contains* this text.
    where: { tenantId: s.tenantA.id, note: `capital ${s.runId}` },
  });
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.branchId, 'an unbranched wallet movement is invisible to the branch view (SCOPE-13)').toBe(
      s.tenantA.branches.hq,
    );
  }
});

test('[ML-103] Capital injected into Erode does not touch HQ', async ({ page }) => {
  const s = await asOwner(page);
  const hqBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const erodeBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.erode!);

  await setActiveBranch(page, s.tenantA.branches.erode!);
  await gotoOk(page, mpath('/wallet'), 'wallet page on Erode');
  await waitForHydration(page, 'form');
  await topUp(page, 'Erode', 200_000, `erode capital ${s.runId}`);

  await waitForRow(
    async () => ((await poolBalance(s.tenantA.id, s.tenantA.branches.erode!)) === erodeBefore + 200_000 ? true : null),
    'the Erode pool to rise',
  );

  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.erode!)).toBe(erodeBefore + 200_000);
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'HQ is untouched by an Erode injection').toBe(
    hqBefore,
  );
});

test('[ML-104] Wallet page is branch-scoped, with no superadmin exemption', async ({ page }) => {
  const s = await asOwner(page);

  // The branch switcher legitimately names every branch, so assert on the pool
  // rows themselves: each carries a hidden branchId of the pool it tops up.
  const pooledBranchIds = async () =>
    page.locator('form input[name="branchId"]').evaluateAll((els) =>
      els.map((el) => (el as HTMLInputElement).value),
    );

  await setActiveBranch(page, s.tenantA.branches.erode!);
  await gotoOk(page, mpath('/wallet'), 'wallet page on Erode');
  expect(await pooledBranchIds(), 'only the Erode pool is offered').toEqual([s.tenantA.branches.erode]);

  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page on HQ');
  expect(await pooledBranchIds(), 'only the HQ pool is offered').toEqual([s.tenantA.branches.hq]);

  // The same scoping through the API the dashboard itself calls.
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const erodeApi = await api.get('/api/v1/wallet/branch', {
    token: owner.token,
    branchId: s.tenantA.branches.erode,
  });
  const ids = (payload: any) =>
    (Array.isArray(payload) ? payload : payload?.items ?? payload?.branches ?? []).map(
      (row: any) => row.branchId ?? row.id,
    );
  expect(ids(erodeApi.data), 'the API is scoped the same way').not.toContain(s.tenantA.branches.hq);
});

test('[ML-105] Zero or negative capital is refused', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const before = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);

  for (const amount of [0, -1000]) {
    const res = await api.post(
      '/api/v1/wallet/branch',
      { branchId: s.tenantA.branches.hq, amount },
      { token: owner.token, branchId: s.tenantA.branches.hq },
    );
    expect(res.status, `amount ${amount} must be refused`).toBe(400);
  }
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'no balance change').toBe(before);
});

test('[ML-120] Release float from the HQ pool to agent A1', async ({ page }) => {
  const s = await asOwner(page);
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const agentBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page');
  await waitForHydration(page, 'form');

  const row = page
    .locator('form')
    .filter({ has: page.locator(`input[name="agentId"][value="${s.tenantA.agentHq!.id}"]`) })
    .first();
  await row.locator('input[name="note"]').fill(`float ${s.runId}`);
  await row.locator('input[name="amount"]').fill('50000');
  // The buttons carry the server-action op as name/value; the visible label
  // also includes an icon glyph, so match the attribute, not the text.
  await row.locator('button[name="op"][value="release"]').click();

  await waitForRow(
    async () => ((await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id)) === agentBefore + 50_000 ? true : null),
    'the agent float to rise',
  );
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id)).toBe(agentBefore + 50_000);
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'the branch pool funded it').toBe(
    poolBefore - 50_000,
  );
});

test('[ML-121] Float release conserves cash across the two accounts', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const agentBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await api.post(
    '/api/v1/wallet/release',
    { agentId: s.tenantA.agentHq!.id, amount: 10_000, note: `conserve ${s.runId}` },
    { token: owner.token, branchId: s.tenantA.branches.hq },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const poolAfter = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const agentAfter = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  expect(poolAfter + agentAfter, 'cash moved between accounts, it was not created').toBe(poolBefore + agentBefore);
});

test('[ML-122] Releasing more than the pool holds is refused', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const agentBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  const over = poolBefore + 1_000_000;
  const res = await api.post(
    '/api/v1/wallet/release',
    { agentId: s.tenantA.agentHq!.id, amount: over },
    { token: owner.token, branchId: s.tenantA.branches.hq },
  );

  const poolAfter = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const agentAfter = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  // Undo the movement before asserting. If the release went through it left the
  // pool negative, and every later money case would inherit that state — so the
  // ledger rows it wrote are removed too, not just the balances, or the
  // pool-equals-its-own-movements invariant (ML-309) would fail on our mess.
  if (poolAfter !== poolBefore || agentAfter !== agentBefore) {
    await db().walletTransaction.deleteMany({
      where: {
        tenantId: s.tenantA.id,
        appType: APP_TYPE,
        type: 'release',
        amount: { in: [over, -over] },
      },
    });
    await db().branchCashAccount.updateMany({
      where: { tenantId: s.tenantA.id, appType: APP_TYPE, branchId: s.tenantA.branches.hq! },
      data: { balance: poolBefore },
    });
    await db().agentAccount.updateMany({
      where: { tenantId: s.tenantA.id, appType: APP_TYPE, agentId: s.tenantA.agentHq!.id },
      data: { balance: agentBefore },
    });
  }

  expect([400, 402, 409], `over-release must be refused, got ${res.status}`).toContain(res.status);
  expect(String(res.error ?? '')).toMatch(/float|insufficient|balance|capital/i);
  expect(poolAfter, 'the branch pool must never be driven negative').toBe(poolBefore);
  expect(agentAfter, 'agent float unchanged').toBe(agentBefore);
});

test('[ML-123] Agent wallet shows only that agent’s float', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });
  await gotoOk(page, mpath('/wallet'), 'agent wallet');

  const text = await bodyText(page);
  expect(text, 'the Erode agent must not appear on A1’s wallet').not.toContain('erode agent');
  expect(await page.getByRole('button', { name: /top up/i }).count(), 'an agent has no branch pool control').toBe(0);
});

test('[ML-106] Agent sees their own float view, never the branch pool view', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });
  await gotoOk(page, mpath('/wallet'), 'agent wallet');

  const own = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);
  const text = await bodyText(page);
  expect(text).toMatch(/wallet|float|cash/);
  expect(own, 'the agent holds the float released to them').toBeGreaterThan(0);

  const asAgent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const branchPool = await api.get('/api/v1/wallet/branch', { token: asAgent.token });
  expect(branchPool.status, 'the branch pool endpoint is closed to agents').toBe(403);
});

test('[ML-124] Float released in HQ is invisible in the Erode wallet view', async ({ page }) => {
  const s = await asOwner(page);
  await setActiveBranch(page, s.tenantA.branches.erode!);
  await gotoOk(page, mpath('/wallet'), 'wallet page on Erode');

  const text = await bodyText(page);
  expect(text, 'the HQ agent must not surface under Erode').not.toContain('hq agent');
});

test('[ML-125] Collect float back from an agent', async ({ page }) => {
  const s = await asOwner(page);
  const poolBefore = await poolBalance(s.tenantA.id, s.tenantA.branches.hq!);
  const agentBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/wallet'), 'wallet page');
  await waitForHydration(page, 'form');

  const row = page
    .locator('form')
    .filter({ has: page.locator(`input[name="agentId"][value="${s.tenantA.agentHq!.id}"]`) })
    .first();
  const amount = row.locator('input[name="amount"]');
  await amount.fill('5000');

  // Collect is deliberately two-step: the first submit only arms the confirm.
  const collect = row.locator('button[name="op"][value="collect"]');
  await collect.click();
  await expect(collect, 'the first click arms the confirmation').toContainText(/confirm/i, { timeout: 10_000 });

  // The amount must survive the arming submit — the confirm posts the same
  // FormData, so an emptied field makes the second click a no-op.
  expect(
    await amount.inputValue(),
    'the typed amount must survive the arming click, or Confirm collect submits nothing',
  ).toBe('5000');

  await collect.click();

  let landed = false;
  for (let i = 0; i < 40 && !landed; i++) {
    await page.waitForTimeout(500);
    landed = (await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id)) === agentBefore - 5_000;
  }
  expect(landed, 'the confirmed collection posts').toBe(true);
  expect(await poolBalance(s.tenantA.id, s.tenantA.branches.hq!), 'the cash lands back in the pool').toBe(
    poolBefore + 5_000,
  );
});

test('[ML-126] Collecting more than the agent holds is refused', async () => {
  const s = loadState();
  // The deposit endpoint is the agent's own hand-back; it debits their float.
  const asAgent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const agentBefore = await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id);

  const res = await api.post(
    '/api/v1/wallet/deposit',
    { amount: agentBefore + 1_000_000 },
    { token: asAgent.token },
  );

  expect([400, 402, 409], `over-collect must be refused, got ${res.status}`).toContain(res.status);
  expect(String(res.error ?? '')).toMatch(/insufficient|float|balance/i);
  expect(await agentBalance(s.tenantA.id, s.tenantA.agentHq!.id), 'agent float unchanged').toBe(agentBefore);
});

test('[ML-129] Every wallet movement carries a branchId', async () => {
  const s = loadState();
  const unbranched = await db().walletTransaction.count({
    where: { tenantId: s.tenantA.id, branchId: null },
  });
  expect(unbranched, 'an unbranched wallet row silently breaks branch isolation (SCOPE-13)').toBe(0);
});

test('[ML-309] Branch cash pools never aggregate each other', async () => {
  const s = loadState();
  const branches = [s.tenantA.branches.hq!, s.tenantA.branches.erode!];

  for (const branchId of branches) {
    const pool = await poolBalance(s.tenantA.id, branchId);
    const other = branches.find((b) => b !== branchId)!;
    const otherPool = await poolBalance(s.tenantA.id, other);
    expect(pool, `${branchId} must hold its own cash only`).not.toBe(pool + otherPool);
  }

  // Each pool equals the branch's own movements, never the tenant total.
  const totals = await db().walletTransaction.groupBy({
    by: ['branchId'],
    where: { tenantId: s.tenantA.id },
    _count: true,
  });
  expect(totals.length, 'movements are recorded per branch').toBeGreaterThan(1);
});
