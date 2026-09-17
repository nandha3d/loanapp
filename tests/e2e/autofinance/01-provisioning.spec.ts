import { expect, test } from '@playwright/test';
import { hash } from 'bcryptjs';
import { api, db, closeDb, loginApi, registerTenant, makeRunId, runPhone } from './support/harness';
import { signVerifyToken } from '../microlending/support/verifyToken';
import { saveState, loadState, patchState, type AutoRunState } from './support/state';
import { apath, gotoOk, bodyText } from './support/ui';
import { resetSessions, ensureSession } from './support/session';

/**
 * Provisioning for the Auto Finance journey.
 *
 * Ordering comes from the runner (workers: 1, fullyParallel: false) rather than
 * serial mode: serial SKIPS every later case once one fails, and the tracker
 * needs a real verdict per case.
 *
 * Branches and staff accounts are created directly against the QA database —
 * they are FIXTURE, and branch creation and staff RBAC each have their own
 * coverage in the micro-lending suite. Customers and routes go through the API,
 * because an agent's ability to file a vehicle depends on the route linkage and
 * that is worth exercising for real.
 */

const PLAN = 'business';
const PASSWORD = 'ZoloAuto@2026';
const runId = makeRunId();

resetSessions();

function ownerFor(prefix: string, offset: number, modules: string[]) {
  return {
    businessName: `${prefix} ${runId.toUpperCase()}`,
    ownerName: `${prefix} Owner`,
    ownerPhone: runPhone(runId, offset),
    ownerEmail: `${prefix.toLowerCase()}.${runId}@zolo.test`,
    ownerUsername: `${prefix.toLowerCase()}${runId}`,
    ownerPassword: PASSWORD,
    selectedPlan: PLAN,
    selectedModules: modules,
    selectedAddons: [],
  };
}

const tenantAInput = ownerFor('Wheels', 1, ['autofinance']);
const tenantBInput = ownerFor('Nowheel', 2, ['microlending']);

test.afterAll(async () => {
  await closeDb();
});

test('[AUTO-001] Registering with autofinance selected entitles the tenant to the module', async () => {
  const res = await registerTenant(tenantAInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);

  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: res.raw.tenantId } });
  const owner = await db().user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'superadmin' } });
  const hq = await db().branch.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });

  expect(String(sub.enabledModules), 'the plan carries autofinance').toContain('autofinance');
  expect(owner.appType, 'the owner is provisioned on the module they bought').toBe('autofinance');

  const state: AutoRunState = {
    runId,
    password: PASSWORD,
    tenantA: {
      id: tenant.id,
      slug: tenant.slug,
      owner: {
        id: owner.id,
        username: tenantAInput.ownerUsername,
        password: PASSWORD,
        name: tenantAInput.ownerName,
        phone: tenantAInput.ownerPhone,
      },
      branches: { hq: hq.id },
      branchCodes: { hq: hq.code ?? 'HQ' },
      customers: { hq: [], erode: [] },
      routes: {},
      partners: {},
      vehicles: {},
      loans: {},
    },
    tenantB: { id: '', slug: '', owner: { id: '', username: '', password: PASSWORD, name: '', phone: '' } },
  };
  saveState(state);
});

test('[AUTO-009] The verification link activates the auto-finance owner', async ({ page }) => {
  const s = loadState();
  const res = await page.goto(
    `/api/auth/verify-email?token=${encodeURIComponent(signVerifyToken(s.tenantA.owner.id))}`,
    { waitUntil: 'domcontentloaded' },
  );
  expect(res?.status() ?? 200).toBeLessThan(500);
  expect(page.url()).not.toMatch(/verifyError/);
  expect((await db().user.findUniqueOrThrow({ where: { id: s.tenantA.owner.id } })).status).toBe('active');
});

test('[AUTO-010] A second branch, an admin and two agents are seeded for the journey', async () => {
  const s = loadState();
  const passwordHash = await hash(PASSWORD, 10);

  const erode = await db().branch.create({
    data: {
      tenantId: s.tenantA.id,
      name: 'Erode',
      code: `ER${runId.slice(0, 3).toUpperCase()}`,
      status: 'active',
      enabledModules: JSON.stringify(['autofinance']),
    },
  });

  const staff = await Promise.all(
    (
      [
        ['admin', 'Auto Admin', `aadm${runId}`, 11, s.tenantA.branches.hq!],
        ['agent', 'Auto Agent HQ', `aagt${runId}`, 12, s.tenantA.branches.hq!],
        ['agent', 'Auto Agent ER', `aagr${runId}`, 13, erode.id],
      ] as const
    ).map(([role, name, username, offset, branchId]) =>
      db().user.create({
        data: {
          tenantId: s.tenantA.id,
          branchId,
          name,
          username,
          phone: runPhone(runId, offset),
          passwordHash,
          role,
          status: 'active',
          appType: 'autofinance',
        },
      }),
    ),
  );

  patchState((state) => {
    state.tenantA.branches.erode = erode.id;
    state.tenantA.branchCodes.erode = erode.code ?? 'ER';
    const [admin, agentHq, agentErode] = staff;
    state.tenantA.admin = {
      id: admin.id, username: admin.username!, password: PASSWORD, name: admin.name, phone: admin.phone ?? '',
    };
    state.tenantA.agentHq = {
      id: agentHq.id, username: agentHq.username!, password: PASSWORD, name: agentHq.name, phone: agentHq.phone ?? '',
    };
    state.tenantA.agentErode = {
      id: agentErode.id, username: agentErode.username!, password: PASSWORD, name: agentErode.name, phone: agentErode.phone ?? '',
    };
  });
});

test('[AUTO-011] A route per branch is created and assigned to its agent', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  for (const [key, branchId, agentId] of [
    ['hq', s.tenantA.branches.hq!, s.tenantA.agentHq!.id],
    ['erode', s.tenantA.branches.erode!, s.tenantA.agentErode!.id],
  ] as const) {
    const res = await api.post(
      '/api/v1/routes',
      { name: `R-${key}-${runId}`, assignedAgentId: agentId },
      { token: owner.token, appType: 'autofinance', branchId },
    );
    expect(res.status, `${key} route → ${JSON.stringify(res.raw)}`).toBeLessThan(300);

    patchState((state) => {
      state.tenantA.routes[key] = res.data.id;
    });
  }

  const routes = await db().route.findMany({ where: { tenantId: s.tenantA.id, appType: 'autofinance' } });
  expect(routes, 'one route per branch').toHaveLength(2);
  for (const route of routes) {
    expect(route.assignedAgentId, 'each route names its collecting agent').toBeTruthy();
  }
});

test('[AUTO-012] Customers are onboarded on both branch routes', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const made: { hq: string[]; erode: string[] } = { hq: [], erode: [] };

  for (const [key, branchId, routeId, count, offset] of [
    ['hq', s.tenantA.branches.hq!, s.tenantA.routes.hq!, 8, 100],
    ['erode', s.tenantA.branches.erode!, s.tenantA.routes.erode!, 2, 150],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const res = await api.post(
        '/api/v1/customers',
        {
          name: `${key === 'hq' ? 'HQ' : 'ER'} Buyer ${i + 1} ${runId}`,
          phone: runPhone(runId, offset + i),
          address: `${key} forecourt`,
          routeId,
        },
        { token: owner.token, appType: 'autofinance', branchId },
      );
      expect(res.status, `${key} customer ${i} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
      made[key].push(res.data.id);
    }
  }

  expect(made.hq).toHaveLength(8);
  expect(made.erode).toHaveLength(2);

  const rows = await db().customer.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance' },
    select: { branchId: true, agentId: true },
  });
  for (const row of rows) {
    expect(row.agentId, 'the route’s primary agent becomes the collecting agent').toBeTruthy();
  }

  patchState((state) => {
    state.tenantA.customers = made;
  });
});

test('[AUTO-013] A tenant registered without autofinance carries no entitlement', async ({ page }) => {
  const res = await registerTenant(tenantBInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);

  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: res.raw.tenantId } });
  const owner = await db().user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'superadmin' } });
  const branch = await db().branch.findFirstOrThrow({ where: { tenantId: tenant.id } });

  await page.goto(`/api/auth/verify-email?token=${encodeURIComponent(signVerifyToken(owner.id))}`, {
    waitUntil: 'domcontentloaded',
  });

  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  expect(String(sub.enabledModules), 'tenant B must not carry autofinance').not.toContain('autofinance');

  const customer = await api.post(
    '/api/v1/customers',
    { name: `Foreign Buyer ${runId}`, phone: runPhone(runId, 200), address: 'other tenant' },
    {
      token: (await loginApi(tenantBInput.ownerUsername, PASSWORD)).token,
      appType: 'microlending',
      branchId: branch.id,
    },
  );

  patchState((state) => {
    state.tenantB = {
      id: tenant.id,
      slug: tenant.slug,
      branchHq: branch.id,
      customerId: customer.status < 300 ? customer.data.id : undefined,
      owner: {
        id: owner.id,
        username: tenantBInput.ownerUsername,
        password: PASSWORD,
        name: tenantBInput.ownerName,
        phone: tenantBInput.ownerPhone,
      },
    };
  });
});

test('[AUTO-002] Auto Finance pages load for an entitled tenant', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await gotoOk(page, apath('/vehicles'), 'vehicle registry');
  expect(page.url(), 'the operator stays on the registry').toContain('/autofinance/vehicles');
});

test('[AUTO-003] A tenant without the module is refused the vehicle pages', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'ownerB', { username: s.tenantB.owner.username, password: s.password });
  await page.goto(apath('/vehicles'), { waitUntil: 'domcontentloaded' });

  const settled = page.url();
  const text = await bodyText(page);
  const refused = !settled.includes('/autofinance/vehicles') || /not enabled|no access|request .*module|upgrade/i.test(text);
  expect(refused, `tenant B must not reach the registry — landed on ${settled}`).toBe(true);
});

test('[AUTO-004] The vehicles API refuses a tenant without the module', async () => {
  const s = loadState();
  const ownerB = await loginApi(s.tenantB.owner.username, s.password);
  const res = await api.get('/api/v1/vehicles', { token: ownerB.token, appType: 'autofinance' });

  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  expect(rows, 'no vehicle from any tenant may be returned').toHaveLength(0);
});

test('[AUTO-007] Vehicle endpoints refuse an unauthenticated caller', async () => {
  const list = await api.get('/api/v1/vehicles');
  expect(list.status).toBe(401);

  const create = await api.post('/api/v1/vehicles', { registrationNo: 'TN00XX0000' });
  expect(create.status).toBe(401);

  for (const res of [list, create]) {
    expect(JSON.stringify(res.raw ?? {}), 'no registry data leaks to an anonymous caller').not.toMatch(
      /registrationNo|customerId/i,
    );
  }
});

test('[AUTO-006] The bare /vehicles path resolves to the auto-finance module', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await page.goto('/vehicles', { waitUntil: 'domcontentloaded' });

  expect(
    page.url(),
    'a typed URL or a stale link lands on the module that owns the page, not a 404',
  ).toContain('/autofinance/vehicles');
});
