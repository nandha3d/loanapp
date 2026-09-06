import { expect, test } from '@playwright/test';
import { hash } from 'bcryptjs';
import { signVerifyToken } from './support/verifyToken';
import { db, closeDb } from './support/db';
import { api } from './support/api';
import { loadState, runPhone } from './support/state';
import { login, loginExpectingSuccess, mpath } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false), not from
// serial mode: serial would SKIP every later case once one fails, and the
// tracker needs a real verdict for each case, not a blank.

test.afterAll(async () => {
  await closeDb();
});

test('[ML-020] Login is blocked before email verification', async ({ page }) => {
  const s = loadState();

  // Registration leaves the owner `pending` (asserted by ML-008). This case
  // uses its own pending account so it stays truthful on a partial re-run,
  // where the owner has already been activated by ML-021.
  const username = `pending${s.runId}`;
  const existing = await db().user.findFirst({ where: { username } });
  if (!existing) {
    await db().user.create({
      data: {
        tenantId: s.tenantA.id,
        branchId: s.tenantA.branches.hq!,
        name: 'Pending Probe',
        phone: runPhone(s.runId, 78),
        username,
        passwordHash: await hash(s.password, 4),
        role: 'agent',
        appType: 'microlending',
        status: 'pending',
      },
    });
  }

  const settled = await login(page, username, s.password, { expect: 'failure' });
  expect(settled, 'an unverified account must not reach the app').toContain('/login');
  await expect(page.locator('body')).toContainText(/verify|invalid credentials/i);
});

test('[ML-022] A tampered verification token is rejected', async ({ page }) => {
  const s = loadState();
  const probe = await db().user.findFirstOrThrow({ where: { username: `pending${s.runId}` } });
  const token = signVerifyToken(probe.id);
  const [payload, sig] = token.split('.');
  const forged = `${payload}.${sig.slice(0, -2)}${sig.slice(-2) === 'ff' ? 'aa' : 'ff'}`;

  await page.goto(`/api/auth/verify-email?token=${encodeURIComponent(forged)}`, {
    waitUntil: 'domcontentloaded',
  });
  expect(page.url()).toMatch(/verifyError/);

  const after = await db().user.findUnique({ where: { id: probe.id } });
  expect(after!.status, 'a forged token must not activate the account').toBe('pending');
});

test('[ML-021] Verification link activates a pending account', async ({ page }) => {
  const s = loadState();

  // The pending probe gives a real pending → active transition on every run.
  const probe = await db().user.findFirstOrThrow({ where: { username: `pending${s.runId}` } });
  const res = await page.goto(`/api/auth/verify-email?token=${encodeURIComponent(signVerifyToken(probe.id))}`, {
    waitUntil: 'domcontentloaded',
  });
  expect(res?.status() ?? 200).toBeLessThan(500);
  expect(page.url()).not.toMatch(/verifyError/);
  expect((await db().user.findUnique({ where: { id: probe.id } }))!.status).toBe('active');

  // Both tenant owners are activated the same way — the journey logs in as them.
  for (const ownerId of [s.tenantA.owner.id, s.tenantB.owner.id]) {
    await page.goto(`/api/auth/verify-email?token=${encodeURIComponent(signVerifyToken(ownerId))}`, {
      waitUntil: 'domcontentloaded',
    });
    expect((await db().user.findUnique({ where: { id: ownerId } }))!.status).toBe('active');
  }
});

test('[ML-023] Superadmin logs in with username and lands in the app', async ({ page }) => {
  const s = loadState();
  await loginExpectingSuccess(page, s.tenantA.owner.username, s.password);
  expect(page.url()).toMatch(/\/portal|\/microlending\//);
});

test('[ML-024] Login also accepts the phone number as the identifier', async ({ page }) => {
  const s = loadState();
  await loginExpectingSuccess(page, s.tenantA.owner.phone, s.password);
});

test('[ML-025] Wrong password is refused', async ({ page }) => {
  const s = loadState();
  const settled = await login(page, s.tenantA.owner.username, 'definitely-not-the-password', { expect: 'failure' });
  expect(settled).toContain('/login');
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.includes('session-token'));
  expect(session?.value ?? '', 'no session token on a failed login').toBe('');
});

test('[ML-026] A protected route redirects an anonymous visitor to /login', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(mpath('/dashboard'), { waitUntil: 'domcontentloaded' });
  expect(page.url()).toContain('/login');
  expect(page.url()).toContain('callbackUrl');
});

test('[ML-027] /api/v1/* without a bearer token returns 401', async () => {
  const res = await api.get('/api/v1/customers');
  expect(res.status).toBe(401);
  expect(res.raw).toHaveProperty('error');
  expect(res.raw?.data ?? null).toBeNull();
});

test('[ML-028] A deactivated user cannot log in', async ({ page }) => {
  const s = loadState();
  const username = `inactive${s.runId}`;
  await db().user.create({
    data: {
      tenantId: s.tenantA.id,
      branchId: s.tenantA.branches.hq!,
      name: 'Inactive Probe',
      phone: runPhone(s.runId, 77),
      username,
      passwordHash: await hash(s.password, 4),
      role: 'agent',
      appType: 'microlending',
      status: 'inactive',
    },
  });

  const settled = await login(page, username, s.password, { expect: 'failure' });
  expect(settled, 'an inactive account must not reach the app').toContain('/login');

  const apiRes = await api.post('/api/v1/auth/login', { username, password: s.password });
  expect(apiRes.status, 'the API must refuse an inactive account too').toBe(401);
});
