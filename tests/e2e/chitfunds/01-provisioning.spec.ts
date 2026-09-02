import { expect, test } from '@playwright/test';
import { hash } from 'bcryptjs';
import { api, db, closeDb, loginApi, registerTenant, makeRunId, runPhone } from './support/harness';
import { signVerifyToken } from '../microlending/support/verifyToken';
import { saveState, loadState, patchState, type ChitRunState } from './support/state';
import { cpath, gotoOk, bodyText } from './support/ui';
import { resetSessions, ensureSession } from './support/session';

/**
 * Provisioning for the chit journey.
 *
 * Ordering comes from the runner (workers: 1, fullyParallel: false) rather than
 * serial mode: serial SKIPS every later case once one fails, and the tracker
 * needs a real verdict per case, not a blank.
 *
 * Branches, staff accounts and customers are created directly against the QA
 * database here. They are FIXTURE, not the behaviour under test — branch
 * creation, staff RBAC and customer onboarding each have their own coverage in
 * the micro-lending suite (ML-036.., ML-060.., ML-150..). Re-driving those
 * modals through the browser would add several minutes per run and would fail
 * this suite for a defect that belongs to another one.
 */

const PLAN = 'business';
const PASSWORD = 'ZoloChit@2026';
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

// Tenant A runs chit funds. Tenant B deliberately does NOT — it is the fixture
// for every module-gating assertion (CF-002, CF-003).
const tenantAInput = ownerFor('Chitra', 1, ['chitfunds']);
const tenantBInput = ownerFor('Nomod', 2, ['microlending']);

test.afterAll(async () => {
  await closeDb();
});

test('[CF-011] Registering with chitfunds selected entitles the tenant to the module', async () => {
  const res = await registerTenant(tenantAInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);

  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: res.raw.tenantId } });
  const owner = await db().user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'superadmin' } });
  const hq = await db().branch.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });

  expect(String(sub.enabledModules), 'the plan carries chitfunds').toContain('chitfunds');

  const state: ChitRunState = {
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
      groups: {},
      auctions: {},
    },
    tenantB: { id: '', slug: '', owner: { id: '', username: '', password: PASSWORD, name: '', phone: '' } },
  };
  saveState(state);
});

test('[CF-012] The verification link activates the chit owner', async ({ page }) => {
  const s = loadState();
  const res = await page.goto(`/api/auth/verify-email?token=${encodeURIComponent(signVerifyToken(s.tenantA.owner.id))}`, {
    waitUntil: 'domcontentloaded',
  });
  expect(res?.status() ?? 200).toBeLessThan(500);
  expect(page.url()).not.toMatch(/verifyError/);

  const owner = await db().user.findUniqueOrThrow({ where: { id: s.tenantA.owner.id } });
  expect(owner.status, 'a verified owner is active').toBe('active');
});

test('[CF-013] A second branch, an admin and an agent are seeded for the journey', async () => {
  const s = loadState();
  const passwordHash = await hash(PASSWORD, 10);

  const erode = await db().branch.create({
    data: {
      tenantId: s.tenantA.id,
      name: 'Erode',
      code: `ER${runId.slice(0, 3).toUpperCase()}`,
      status: 'active',
      enabledModules: JSON.stringify(['chitfunds']),
    },
  });

  const admin = await db().user.create({
    data: {
      tenantId: s.tenantA.id,
      branchId: s.tenantA.branches.hq!,
      name: 'Chit Admin',
      username: `cadm${runId}`,
      phone: runPhone(runId, 11),
      passwordHash,
      role: 'admin',
      status: 'active',
      appType: 'chitfunds',
    },
  });

  const agent = await db().user.create({
    data: {
      tenantId: s.tenantA.id,
      branchId: s.tenantA.branches.hq!,
      name: 'Chit Agent',
      username: `cagt${runId}`,
      phone: runPhone(runId, 12),
      passwordHash,
      role: 'agent',
      status: 'active',
      appType: 'chitfunds',
    },
  });

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

test('[CF-014] A tenant registered without chitfunds carries no chit entitlement', async ({ page }) => {
  const res = await registerTenant(tenantBInput);
  expect([200, 201], JSON.stringify(res.raw)).toContain(res.status);

  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: res.raw.tenantId } });
  const owner = await db().user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'superadmin' } });
  const branch = await db().branch.findFirstOrThrow({ where: { tenantId: tenant.id } });

  await page.goto(`/api/auth/verify-email?token=${encodeURIComponent(signVerifyToken(owner.id))}`, {
    waitUntil: 'domcontentloaded',
  });

  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  expect(String(sub.enabledModules), 'tenant B must not carry chitfunds').not.toContain('chitfunds');

  patchState((state) => {
    state.tenantB = {
      id: tenant.id,
      slug: tenant.slug,
      branchHq: branch.id,
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

test('[CF-001] Chit Funds pages load for a tenant with the module enabled', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await gotoOk(page, cpath('/chits'), 'chit group list');
  expect(page.url(), 'the operator stays on the chit list').toContain('/chitfunds/chits');
});

test('[CF-002] A tenant without the chitfunds module is refused the pages', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'ownerB', { username: s.tenantB.owner.username, password: s.password });
  await page.goto(cpath('/chits'), { waitUntil: 'domcontentloaded' });

  const settled = page.url();
  const text = await bodyText(page);
  const refused =
    !settled.includes('/chitfunds/chits') || /not enabled|no access|request .*module|upgrade/i.test(text);
  expect(refused, `tenant B must not reach the chit list — landed on ${settled}`).toBe(true);
});

test('[CF-003] The chits API refuses a tenant without the module', async () => {
  const s = loadState();
  const ownerB = await loginApi(s.tenantB.owner.username, s.password);
  const res = await api.get('/api/v1/chits', { token: ownerB.token, appType: 'chitfunds' });

  expect(res.status, `module gating must refuse, got ${res.status}`).toBeGreaterThanOrEqual(400);
  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  expect(rows, 'no chit rows may be returned to a tenant without the module').toHaveLength(0);
});

test('[CF-008] Chit endpoints refuse an unauthenticated caller', async () => {
  const paths = [
    '/api/v1/chits',
    '/api/v1/chits/payment-intents',
  ];
  for (const path of paths) {
    const res = await api.get(path);
    expect(res.status, `${path} without a token`).toBe(401);
    expect(JSON.stringify(res.data ?? {}), `${path} must not leak data`).not.toMatch(/chitValue|ticketNo/i);
  }
});

test('[CF-009] A tampered staff token is refused', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const forged = `${owner.token.slice(0, -2)}${owner.token.slice(-2) === 'aa' ? 'bb' : 'aa'}`;

  const res = await api.get('/api/v1/chits', { token: forged });
  expect(res.status).toBe(401);
  expect(JSON.stringify(res.raw ?? {}), 'no stack trace or key material').not.toMatch(/secret|jwt|at .*\.ts:/i);
});

test('[CF-005] An agent cannot create a chit group', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const res = await api.post(
    '/api/v1/chits',
    { name: `Agent Attempt ${runId}`, chitValue: 100000, monthlyContrib: 5000, totalMembers: 20, commissionPct: 5 },
    { token: agent.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq },
  );
  expect(res.status, 'canAdminChits excludes agent').toBe(403);
  expect(await db().chitGroup.count({ where: { tenantId: s.tenantA.id } }), 'nothing was created').toBe(0);
});
