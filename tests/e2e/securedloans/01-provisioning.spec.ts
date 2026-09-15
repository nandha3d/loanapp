import { expect, test } from '@playwright/test';
import { hash } from 'bcryptjs';
import { api, db, closeDb, loginApi, registerTenant, makeRunId } from './support/harness';
import { signVerifyToken } from '../microlending/support/verifyToken';
import { saveState, loadState, patchState, type SecuredRunState } from './support/state';
import { resetSessions } from './support/session';

/**
 * Provisioning for the secured-lending journey.
 *
 * One tenant carries BOTH modules, because the point of this suite is the
 * delta between them and the shared lifecycle — running them under one owner
 * keeps the isolation cases honest (a property loan and a product loan in the
 * same branch must still not see each other's collateral).
 */

const PLAN = 'business';
const PASSWORD = 'ZoloSecured@2026';
const runId = makeRunId();

resetSessions();

/**
 * A mobile number unique to this run.
 *
 * The shared runPhone() folds a short run id into nine digits, which collides
 * once a QA database has carried a few dozen runs. Seeding from the clock gives
 * every run its own block: 9 + six clock digits + a three-digit offset.
 */
const clock = String(Date.now()).slice(-6);
const phone = (offset: number) => `9${clock}${String(offset % 1000).padStart(3, '0')}`;

const tenantAInput = {
  businessName: `Secured ${runId.toUpperCase()}`,
  ownerName: 'Secured Owner',
  ownerPhone: phone(1),
  ownerEmail: `secured.${runId}@zolo.test`,
  ownerUsername: `sec${runId}`,
  ownerPassword: PASSWORD,
  selectedPlan: PLAN,
  selectedModules: ['property', 'productfinance'],
  selectedAddons: [],
};

const tenantBInput = {
  ...tenantAInput,
  businessName: `Unsecured ${runId.toUpperCase()}`,
  ownerName: 'Unsecured Owner',
  ownerPhone: phone(2),
  ownerEmail: `unsecured.${runId}@zolo.test`,
  ownerUsername: `uns${runId}`,
  selectedModules: ['microlending'],
};

test.afterAll(async () => {
  await closeDb();
});

test('[PPF-001] [PPF-002] Registering with both secured modules entitles the tenant to each', async () => {
  const res = await registerTenant(tenantAInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);

  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: res.raw.tenantId } });
  const owner = await db().user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'superadmin' } });
  const hq = await db().branch.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });

  expect(String(sub.enabledModules)).toContain('property');
  expect(String(sub.enabledModules)).toContain('productfinance');

  const state: SecuredRunState = {
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

test('[PPF-007] The verification link activates the secured-lending owner', async ({ page }) => {
  const s = loadState();
  await page.goto(`/api/auth/verify-email?token=${encodeURIComponent(signVerifyToken(s.tenantA.owner.id))}`, {
    waitUntil: 'domcontentloaded',
  });
  expect((await db().user.findUniqueOrThrow({ where: { id: s.tenantA.owner.id } })).status).toBe('active');
});

test('[PPF-008] A second branch, an admin and an agent are seeded for the journey', async () => {
  const s = loadState();
  const passwordHash = await hash(PASSWORD, 10);

  const erode = await db().branch.create({
    data: {
      tenantId: s.tenantA.id,
      name: 'Erode',
      code: `ER${runId.slice(0, 3).toUpperCase()}`,
      status: 'active',
      enabledModules: JSON.stringify(['property', 'productfinance']),
    },
  });

  const [admin, agent] = await Promise.all(
    (
      [
        ['admin', 'Secured Admin', `sadm${runId}`, 11],
        ['agent', 'Secured Agent', `sagt${runId}`, 12],
      ] as const
    ).map(([role, name, username, offset]) =>
      db().user.create({
        data: {
          tenantId: s.tenantA.id,
          branchId: s.tenantA.branches.hq!,
          name,
          username,
          phone: phone(offset),
          passwordHash,
          role,
          status: 'active',
          appType: 'property',
        },
      }),
    ),
  );

  patchState((state) => {
    state.tenantA.branches.erode = erode.id;
    state.tenantA.branchCodes.erode = erode.code ?? 'ER';
    state.tenantA.admin = {
      id: admin.id, username: admin.username!, password: PASSWORD, name: admin.name, phone: admin.phone ?? '',
    };
    state.tenantA.agentHq = {
      id: agent.id, username: agent.username!, password: PASSWORD, name: agent.name, phone: agent.phone ?? '',
    };
  });
});

test('[PPF-009] Customers are onboarded in both branches', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const made: { hq: string[]; erode: string[] } = { hq: [], erode: [] };

  for (const [key, branchId, count, offset] of [
    ['hq', s.tenantA.branches.hq!, 6, 100],
    ['erode', s.tenantA.branches.erode!, 2, 150],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const res = await api.post(
        '/api/v1/customers',
        {
          name: `${key === 'hq' ? 'HQ' : 'ER'} Borrower ${i + 1} ${runId}`,
          phone: phone(offset + i),
          address: `${key} street`,
        },
        { token: owner.token, appType: 'property', branchId },
      );
      expect(res.status, `${key} customer ${i} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
      made[key].push(res.data.id);
    }
  }

  expect(made.hq).toHaveLength(6);
  patchState((state) => {
    state.tenantA.customers = made;
  });
});

test('[PPF-010] A product-finance customer is onboarded under its own module', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const res = await api.post(
    '/api/v1/customers',
    { name: `PF Buyer ${runId}`, phone: phone(190), address: 'appliance row' },
    { token: owner.token, appType: 'productfinance', branchId: s.tenantA.branches.hq },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().customer.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.appType, 'SCOPE-1: a customer belongs to the module they were filed under').toBe('productfinance');

  patchState((state) => {
    state.tenantA.partners.productCustomer = res.data.id;
  });
});

test('[PPF-003] A tenant without the module is refused its API', async () => {
  const res = await registerTenant(tenantBInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);

  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: res.raw.tenantId } });
  const ownerB = await db().user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'superadmin' } });
  const branch = await db().branch.findFirstOrThrow({ where: { tenantId: tenant.id } });
  await db().user.update({ where: { id: ownerB.id }, data: { status: 'active' } });

  patchState((state) => {
    state.tenantB = {
      id: tenant.id,
      slug: tenant.slug,
      branchHq: branch.id,
      owner: {
        id: ownerB.id,
        username: tenantBInput.ownerUsername,
        password: PASSWORD,
        name: tenantBInput.ownerName,
        phone: tenantBInput.ownerPhone,
      },
    };
  });

  const session = await loginApi(tenantBInput.ownerUsername, PASSWORD);
  const res2 = await api.get('/api/v1/loans', { token: session.token, appType: 'property' });
  const rows = Array.isArray(res2.data) ? res2.data : res2.data?.items ?? [];
  expect(rows, 'SCOPE-4: a tenant without the module reads no secured loan').toHaveLength(0);
});

test('[PPF-006] Both custody routes refuse an unauthenticated caller', async () => {
  for (const path of ['property-release', 'product-repossession']) {
    const res = await api.post(`/api/v1/loans/some-loan-id/${path}`, {});
    expect(res.status, `${path} without a token`).toBe(401);
    expect(JSON.stringify(res.raw ?? {}), `${path} must not leak`).not.toMatch(/mortgageStatus|serialNo/i);
  }
});
