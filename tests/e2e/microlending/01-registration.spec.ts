import { expect, test } from '@playwright/test';
import { db, closeDb } from './support/db';
import { registerTenant } from './support/api';
import { makeRunId, runPhone, saveState, loadState, patchState, type RunState } from './support/state';
import { expectRendered, gotoOk } from './support/ui';
import { resetSessions } from './support/session';

// Ordering comes from the runner (workers: 1, fullyParallel: false), not from
// serial mode: serial would SKIP every later case once one fails, and the
// tracker needs a real verdict for each case, not a blank.

const PLAN = 'business'; // 6 branches / 60 agents — enough for the isolation cases
const PASSWORD = 'ZoloE2e@2026';
const runId = makeRunId();

// A run provisions a brand-new tenant, so no cookie jar from a previous run applies.
resetSessions();

function ownerFor(prefix: string, offset: number) {
  return {
    businessName: `${prefix} ${runId.toUpperCase()}`,
    ownerName: `${prefix} Owner`,
    ownerPhone: runPhone(runId, offset),
    ownerEmail: `${prefix.toLowerCase()}.${runId}@zolo.test`,
    ownerUsername: `${prefix.toLowerCase()}${runId}`,
    ownerPassword: PASSWORD,
    selectedPlan: PLAN,
    selectedModules: ['microlending'],
    selectedAddons: [],
  };
}

const tenantAInput = ownerFor('Alpha', 1);
const tenantBInput = ownerFor('Bravo', 2);

test.afterAll(async () => {
  await closeDb();
});

test('[ML-001] Register page renders the signup form', async ({ page }) => {
  await gotoOk(page, '/register', 'register page');
  await expect(page.locator('input[type="text"]').first(), 'business name field').toBeVisible();
  await expect(page.locator('input[type="email"]').first(), 'owner email field').toBeVisible();
  await expect(page.locator('input[type="tel"], input[name="ownerPhone"]').first(), 'owner phone field').toBeVisible();
  const body = await page.locator('body').innerText();
  expect(body.toLowerCase()).toMatch(/register|sign ?up|create.*account|business/);
});

test('[ML-002] Registration rejects a non-Indian mobile number', async () => {
  const res = await registerTenant({ ...ownerFor('Reject', 90), ownerPhone: '12345' });
  expect(res.status).toBe(400);
  expect(String(res.raw?.error ?? '')).toMatch(/mobile|phone/i);
});

test('[ML-003] Registration rejects a malformed email', async () => {
  const res = await registerTenant({ ...ownerFor('Reject', 91), ownerEmail: 'not-an-email' });
  expect(res.status).toBe(400);
  expect(String(res.raw?.error ?? '')).toMatch(/email/i);
});

test('[ML-004] Registration rejects missing required fields', async () => {
  const { businessName, ...rest } = ownerFor('Reject', 92);
  const res = await registerTenant(rest);
  expect(res.status).toBe(400);
  expect(String(res.raw?.error ?? '')).toMatch(/missing required/i);
});

test('[ML-005] Registration rejects an unknown or unpriced plan', async () => {
  const before = await db().tenant.count();
  const res = await registerTenant({ ...ownerFor('Reject', 93), selectedPlan: 'starter' });
  expect(res.status).toBe(400);
  expect(String(res.raw?.error ?? '')).toMatch(/plan/i);
  expect(await db().tenant.count()).toBe(before);
});

test('[ML-006] Successful registration provisions the tenant', async () => {
  const res = await registerTenant(tenantAInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);
  expect(res.raw?.success).toBe(true);
  expect(res.raw?.requiresVerification).toBe(true);

  const tenant = await db().tenant.findUnique({ where: { id: res.raw.tenantId } });
  expect(tenant, 'tenant row must exist').toBeTruthy();
  expect(tenant!.status).toBe('active');
  expect(tenant!.slug).toContain('alpha');

  const owner = await db().user.findFirst({ where: { tenantId: tenant!.id, role: 'superadmin' } });
  expect(owner).toBeTruthy();

  const state: RunState = {
    runId,
    password: PASSWORD,
    tenantA: {
      id: tenant!.id,
      slug: tenant!.slug,
      owner: {
        id: owner!.id,
        username: tenantAInput.ownerUsername,
        password: PASSWORD,
        name: tenantAInput.ownerName,
        phone: tenantAInput.ownerPhone,
      },
      branches: {},
      loans: {},
    },
    tenantB: { id: '', slug: '', owner: { id: '', username: '', password: PASSWORD, name: '', phone: '' } },
  };
  saveState(state);
});

test('[ML-007] Registration creates the Head Office branch', async () => {
  const s = loadState();
  const branches = await db().branch.findMany({ where: { tenantId: s.tenantA.id } });
  expect(branches).toHaveLength(1);
  const hq = branches[0];
  expect(hq.name).toBe('Head Office');
  expect(hq.code).toBe('HQ');
  expect(hq.status).toBe('active');
  expect(String(hq.enabledModules)).toContain('microlending');
  patchState((state) => {
    state.tenantA.branches.hq = hq.id;
  });
});

test('[ML-008] Registration creates the owner as a pending superadmin', async () => {
  const s = loadState();
  const owner = await db().user.findUnique({ where: { id: s.tenantA.owner.id } });
  expect(owner!.role).toBe('superadmin');
  expect(owner!.status, 'account stays pending until the email is verified').toBe('pending');
  expect(owner!.appType).toBe('microlending');
  expect(owner!.branchId).toBe(s.tenantA.branches.hq);
});

test('[ML-009] Registration snapshots the subscription limits', async () => {
  const s = loadState();
  const [sub, catalog] = await Promise.all([
    db().tenantSubscription.findUnique({ where: { tenantId: s.tenantA.id } }),
    db().subscriptionPlanCatalog.findUnique({ where: { plan: PLAN } }),
  ]);
  expect(sub).toBeTruthy();
  expect(sub!.plan).toBe(PLAN);
  expect(sub!.status).toBe('active');
  expect(sub!.maxBranches).toBe(catalog!.maxBranches);
  expect(sub!.maxAgents).toBe(catalog!.maxAgents);
  expect(sub!.maxActiveLoans).toBe(catalog!.maxActiveLoans);
  expect(String(sub!.enabledModules)).toContain('microlending');
});

test('[ML-010] Registration seeds the tenant default AppSettings', async () => {
  const s = loadState();
  const rows = await db().appSetting.findMany({ where: { tenantId: s.tenantA.id } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  expect(map.get('currency_symbol')).toBeTruthy();
  expect(map.get('timezone')).toBe('Asia/Kolkata');
  expect(map.get('default_penalty_per_day')).toBe('50');
  expect(map.get('penalty_grace_period')).toBe('0');
  expect(map.get('penalty_max_cap')).toBe('0');
  expect(map.get('customer_code_prefix')).toBe('CUS');
  expect(map.get('loan_code_prefix')).toBe('LN');
  expect(map.get('customer_code_counter')).toBe('0');
});

test('[ML-011] Registration writes an audit log row', async () => {
  const s = loadState();
  const rows = await db().auditLog.findMany({
    where: { tenantId: s.tenantA.id, entityType: 'tenant', entityId: s.tenantA.id },
  });
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0].action).toBe('create');
  expect(rows[0].userId).toBe(s.tenantA.owner.id);
});

test('[ML-012] Owner is linked to the branch as its superadmin', async () => {
  const s = loadState();
  const branch = await db().branch.findUnique({ where: { id: s.tenantA.branches.hq! } });
  expect(branch!.superadminId).toBe(s.tenantA.owner.id);
  const join = await db().superadminBranch.findFirst({
    where: { superadminId: s.tenantA.owner.id, branchId: s.tenantA.branches.hq! },
  });
  expect(join, 'SuperadminBranch join row must exist').toBeTruthy();
});

test('[ML-013] Duplicate phone / username / email is refused', async () => {
  const before = await db().tenant.count();
  const res = await registerTenant({
    ...ownerFor('Clash', 94),
    ownerPhone: tenantAInput.ownerPhone,
  });
  expect(res.status).toBe(409);
  expect(await db().tenant.count()).toBe(before);
});

test('[ML-014] Two tenants registered back to back stay separate', async () => {
  const res = await registerTenant(tenantBInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);

  const s = loadState();
  const tenantB = await db().tenant.findUnique({ where: { id: res.raw.tenantId } });
  const ownerB = await db().user.findFirst({ where: { tenantId: tenantB!.id, role: 'superadmin' } });
  const branchesB = await db().branch.findMany({ where: { tenantId: tenantB!.id } });

  expect(tenantB!.id).not.toBe(s.tenantA.id);
  expect(tenantB!.slug).not.toBe(s.tenantA.slug);
  expect(branchesB).toHaveLength(1);
  expect(branchesB[0].id).not.toBe(s.tenantA.branches.hq);

  patchState((state) => {
    state.tenantB = {
      id: tenantB!.id,
      slug: tenantB!.slug,
      branchHq: branchesB[0].id,
      owner: {
        id: ownerB!.id,
        username: tenantBInput.ownerUsername,
        password: PASSWORD,
        name: tenantBInput.ownerName,
        phone: tenantBInput.ownerPhone,
      },
    };
  });
});

test('[ML-030] Forgot-password page renders', async ({ page }) => {
  await gotoOk(page, '/forgot-password', 'forgot password page');
  await expectRendered(page, 'forgot password page');
});
