import { expect, test, type Page } from '@playwright/test';
import { db, closeDb, waitForRow } from './support/db';
import { loadState, patchState, runPhone } from './support/state';
import { ensureSession } from './support/session';
import { createStaffUser, ensureStaffUser } from './support/staff';
import { activeBranchCookie, bodyText, expectRendered, gotoOk, mpath, setActiveBranch, waitForHydration } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false), not from
// serial mode: serial would SKIP every later case once one fails, and the
// tracker needs a real verdict for each case, not a blank.

test.afterAll(async () => {
  await closeDb();
});

async function asOwner(page: Page) {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  return s;
}

/** The branch modal reports failures through window.alert; capture the text. */
function captureAlerts(page: Page): string[] {
  const seen: string[] = [];
  page.on('dialog', async (d) => {
    seen.push(d.message());
    await d.dismiss().catch(() => {});
  });
  return seen;
}

async function createBranch(page: Page, name: string, code: string, phone = '') {
  await page.getByRole('button', { name: /new branch/i }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="code"]').fill(code);
  if (phone) await page.locator('input[name="phone"]').fill(phone);
  const owner = page.locator('select[name="superadminId"]');
  const value = await owner.locator('option').nth(1).getAttribute('value');
  await owner.selectOption(String(value ?? ''));
  await page.getByRole('button', { name: /save branch/i }).click();
  await page.waitForTimeout(2500);
}

test('[ML-040] Superadmin opens the branch admin page', async ({ page }) => {
  const s = await asOwner(page);
  await gotoOk(page, '/admin/branches', 'branch admin page');
  expect(page.url(), 'a superadmin must not be bounced to the portal').toContain('/admin/branches');
  await expect(page.locator('body')).toContainText(/branch/i);

  const branches = await db().branch.findMany({ where: { tenantId: s.tenantA.id } });
  expect(branches.length).toBeGreaterThanOrEqual(1);
  await expect(page.locator('body')).toContainText('Head Office');
});

test('[ML-041] Superadmin creates a second branch (Erode)', async ({ page }) => {
  const s = await asOwner(page);
  captureAlerts(page);
  await gotoOk(page, '/admin/branches', 'branch admin page');
  await waitForHydration(page, 'table');
  await createBranch(page, 'Erode', `ERD${s.runId.slice(0, 3).toUpperCase()}`, '9876500011');

  const erode = await waitForRow(
    () => db().branch.findFirst({ where: { tenantId: s.tenantA.id, name: 'Erode' } }),
    'the Erode branch',
  );
  expect(erode.status).toBe('active');
  expect(erode.superadminId).toBe(s.tenantA.owner.id);
  patchState((state) => {
    state.tenantA.branches.erode = erode.id;
  });
});

test('[ML-042] Superadmin creates a third branch (Salem)', async ({ page }) => {
  const s = await asOwner(page);
  captureAlerts(page);
  await gotoOk(page, '/admin/branches', 'branch admin page');
  await waitForHydration(page, 'table');
  await createBranch(page, 'Salem', `SLM${s.runId.slice(0, 3).toUpperCase()}`);

  await waitForRow(
    () => db().branch.findFirst({ where: { tenantId: s.tenantA.id, name: 'Salem' } }),
    'the Salem branch',
  );
  const branches = await db().branch.findMany({ where: { tenantId: s.tenantA.id }, orderBy: { name: 'asc' } });
  const names = branches.map((b) => b.name);
  for (const expected of ['Head Office', 'Erode', 'Salem']) {
    expect(names, `${expected} must exist as its own branch`).toContain(expected);
  }
  expect(new Set(branches.map((b) => b.code)).size, 'each branch keeps its own code').toBe(branches.length);
  expect(new Set(branches.map((b) => b.id)).size).toBe(branches.length);

  const salem = branches.find((b) => b.name === 'Salem')!;
  patchState((state) => {
    state.tenantA.branches.salem = salem.id;
  });
});

test('[ML-043] Duplicate branch code within a tenant is refused', async ({ page }) => {
  const s = await asOwner(page);
  const alerts = captureAlerts(page);
  const before = await db().branch.count({ where: { tenantId: s.tenantA.id } });

  await gotoOk(page, '/admin/branches', 'branch admin page');
  await waitForHydration(page, 'table');
  const erode = await db().branch.findFirstOrThrow({ where: { tenantId: s.tenantA.id, name: 'Erode' } });
  await createBranch(page, 'Erode Copy', erode.code ?? '');

  expect(await db().branch.count({ where: { tenantId: s.tenantA.id } }), 'no branch created').toBe(before);
  expect(alerts.join(' '), 'the duplicate is reported to the operator').toMatch(/code already exists|duplicate|unique/i);
});

test('[ML-044] Branch creation respects the subscription maxBranches limit', async ({ page }) => {
  const s = await asOwner(page);
  const alerts = captureAlerts(page);
  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: s.tenantA.id } });

  // Fill the plan up to its ceiling directly, then try to cross it through the UI.
  // Any filler left by an earlier run is removed first so its code cannot clash.
  await db().branch.deleteMany({ where: { tenantId: s.tenantA.id, name: { startsWith: 'Filler ' } } });
  const active = await db().branch.count({ where: { tenantId: s.tenantA.id, status: 'active' } });
  for (let i = active; i < sub.maxBranches; i++) {
    await db().branch.create({
      data: {
        tenantId: s.tenantA.id,
        superadminId: s.tenantA.owner.id,
        name: `Filler ${i}`,
        code: `FIL${i}${s.runId.slice(0, 2).toUpperCase()}`,
        enabledModules: sub.enabledModules,
      },
    });
  }
  const atLimit = await db().branch.count({ where: { tenantId: s.tenantA.id, status: 'active' } });
  expect(atLimit).toBe(sub.maxBranches);

  await gotoOk(page, '/admin/branches', 'branch admin page');
  await waitForHydration(page, 'table');
  await createBranch(page, 'Over Limit', `OVR${s.runId.slice(0, 2).toUpperCase()}`);

  expect(await db().branch.count({ where: { tenantId: s.tenantA.id, status: 'active' } })).toBe(atLimit);
  expect(alerts.join(' ')).toMatch(/limit reached|upgrade/i);

  // Remove the fillers so they cannot pollute the branch-isolation cases.
  await db().branch.deleteMany({ where: { tenantId: s.tenantA.id, name: { startsWith: 'Filler ' } } });
});

test('[ML-045] Each branch carries its own enabledModules', async () => {
  const s = loadState();
  const branches = await db().branch.findMany({
    where: { tenantId: s.tenantA.id, status: 'active' },
  });
  for (const branch of branches) {
    expect(String(branch.enabledModules), `${branch.name} must carry its own module list`).toContain('microlending');
  }
  // The column is per-branch, not a tenant-level pointer.
  expect(branches.every((b) => b.enabledModules !== null)).toBe(true);
});

test('[ML-060] Superadmin creates a branch admin for HQ', async ({ page }) => {
  const s = await asOwner(page);
  await gotoOk(page, '/admin/users', 'user admin page');
  await waitForHydration(page, 'table');

  const username = `admin${s.runId}`;
  const admin = await ensureStaffUser(page, s.tenantA.id, {
    name: 'HQ Admin',
    username,
    phone: runPhone(s.runId, 11),
    password: s.password,
    role: 'admin',
    branchId: s.tenantA.branches.hq!,
  });

  expect(admin.role).toBe('admin');
  expect(admin.status).toBe('active');
  expect(admin.branchId, 'staff rows are stamped with their branch (SCOPE-13)').toBe(s.tenantA.branches.hq);

  patchState((state) => {
    state.tenantA.admin = {
      id: admin.id,
      username,
      password: s.password,
      name: 'HQ Admin',
      phone: admin.phone ?? '',
    };
  });
});

test('[ML-061] Superadmin creates agent A1 in HQ', async ({ page }) => {
  const s = await asOwner(page);
  await gotoOk(page, '/admin/users', 'user admin page');
  await waitForHydration(page, 'table');

  const username = `agenthq${s.runId}`;
  const agent = await ensureStaffUser(page, s.tenantA.id, {
    name: 'HQ Agent',
    username,
    phone: runPhone(s.runId, 12),
    password: s.password,
    role: 'agent',
    branchId: s.tenantA.branches.hq!,
  });

  expect(agent.role).toBe('agent');
  expect(agent.branchId).toBe(s.tenantA.branches.hq);
  expect(agent.appType).toBe('microlending');

  patchState((state) => {
    state.tenantA.agentHq = {
      id: agent.id,
      username,
      password: s.password,
      name: 'HQ Agent',
      phone: agent.phone ?? '',
    };
  });
});

test('[ML-062] Superadmin creates agent A2 in Erode', async ({ page }) => {
  const s = await asOwner(page);
  await gotoOk(page, '/admin/users', 'user admin page');
  await waitForHydration(page, 'table');

  const username = `agented${s.runId}`;
  const agent = await ensureStaffUser(page, s.tenantA.id, {
    name: 'Erode Agent',
    username,
    phone: runPhone(s.runId, 13),
    password: s.password,
    role: 'agent',
    branchId: s.tenantA.branches.erode!,
  });

  expect(agent.branchId, 'A2 belongs to Erode, not the branch its author sits on').toBe(s.tenantA.branches.erode);
  expect(agent.branchId).not.toBe(s.tenantA.branches.hq);

  patchState((state) => {
    state.tenantA.agentErode = {
      id: agent.id,
      username,
      password: s.password,
      name: 'Erode Agent',
      phone: agent.phone ?? '',
    };
  });
});

test('[ML-063] Duplicate staff username is refused', async ({ page }) => {
  const s = await asOwner(page);
  const before = await db().user.count({ where: { tenantId: s.tenantA.id } });

  const outcome = await createStaffUser(page, {
    name: 'Clashing Agent',
    username: s.tenantA.agentHq!.username,
    phone: runPhone(s.runId, 14),
    password: s.password,
    role: 'agent',
    branchId: s.tenantA.branches.hq!,
  });

  expect(outcome.saved, 'a duplicate username must not be accepted').toBe(false);
  expect(outcome.reason, 'the clash is reported to the operator').toMatch(/exists|taken|already|duplicate|unique/i);
  expect(await db().user.count({ where: { tenantId: s.tenantA.id } }), 'no duplicate user row').toBe(before);
});

test('[ML-064] Agent list is branch-scoped', async ({ page }) => {
  const s = await asOwner(page);

  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, `${mpath('/settings')}?tab=users`, 'settings agents (HQ)');
  const hqText = await bodyText(page);
  expect(hqText, 'HQ lists its own agent').toContain(s.tenantA.agentHq!.username.toLowerCase());
  expect(hqText, 'HQ must not list the Erode agent').not.toContain(s.tenantA.agentErode!.username.toLowerCase());

  await setActiveBranch(page, s.tenantA.branches.erode!);
  await gotoOk(page, `${mpath('/settings')}?tab=users`, 'settings agents (Erode)');
  const erodeText = await bodyText(page);
  expect(erodeText, 'Erode lists its own agent').toContain(s.tenantA.agentErode!.username.toLowerCase());
  expect(erodeText, 'Erode must not list the HQ agent').not.toContain(s.tenantA.agentHq!.username.toLowerCase());
});

test('[ML-047] Selecting a branch pins the active branch for later reads', async ({ page }) => {
  const s = await asOwner(page);

  // Drive the real switcher, then confirm the app kept the selection.
  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/dashboard'), 'dashboard on HQ');

  const switcher = page
    .locator('select')
    .filter({ has: page.locator(`option[value="${s.tenantA.branches.erode}"]`) })
    .first();
  expect(await switcher.count(), 'the branch switcher should be on the page').toBeGreaterThan(0);
  // Selecting before hydration changes the DOM without running the change
  // handler, so no server action fires and the branch never actually switches.
  await waitForHydration(page, 'select');
  await switcher.selectOption(s.tenantA.branches.erode!);

  // switchActiveBranch is a server action; wait for the cookie it writes.
  let cookieValue: string | null = null;
  for (let i = 0; i < 30 && cookieValue !== s.tenantA.branches.erode; i++) {
    await page.waitForTimeout(500);
    cookieValue = await activeBranchCookie(page);
  }
  expect(cookieValue, 'the selection is persisted as the active branch').toBe(s.tenantA.branches.erode);

  await gotoOk(page, `${mpath('/settings')}?tab=users`, 'settings agents after switching');
  const text = await bodyText(page);
  expect(text, 'reads follow the newly selected branch').toContain(s.tenantA.agentErode!.username.toLowerCase());
  expect(text).not.toContain(s.tenantA.agentHq!.username.toLowerCase());
});

test('[ML-049] Branch edits persist', async ({ page }) => {
  const s = await asOwner(page);
  captureAlerts(page);
  await gotoOk(page, '/admin/branches', 'branch admin page');
  await waitForHydration(page, 'table');

  const row = page.locator('tr', { hasText: 'Salem' }).first();
  await row.getByRole('button', { name: /edit/i }).click();
  await page.locator('input[name="phone"]').fill('9876500099');
  await page.getByRole('button', { name: /save branch/i }).click();
  await page.waitForTimeout(2500);

  const salem = await db().branch.findUniqueOrThrow({ where: { id: s.tenantA.branches.salem! } });
  expect(salem.phone).toBe('9876500099');
});

test('[ML-046] Branch switcher lists every branch the superadmin owns', async ({ page }) => {
  const s = await asOwner(page);
  await gotoOk(page, mpath('/dashboard'), 'module dashboard');
  await expectRendered(page, 'module dashboard');

  const text = await bodyText(page);
  const switcherHasAll = /all branches/i.test(text);
  const namesPresent = ['head office', 'erode', 'salem'].filter((n) => text.includes(n));

  // The switcher may render collapsed; open any control that mentions a branch.
  if (!switcherHasAll || namesPresent.length < 3) {
    const trigger = page.locator('select, [role="combobox"], button').filter({ hasText: /branch|head office/i }).first();
    if (await trigger.count()) {
      await trigger.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  const after = await bodyText(page);
  for (const name of ['head office', 'erode', 'salem']) {
    expect(after, `branch switcher should offer ${name}`).toContain(name);
  }
  expect(after).toMatch(/all branches/i);
});
