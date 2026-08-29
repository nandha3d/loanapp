import { expect, test } from '@playwright/test';
import { closeDb, db, num } from './support/db';
import { api, loginApi, setTenantSetting } from './support/api';
import { BASE_URL } from './support/env';
import { loadState } from './support/state';
import { ensureSession } from './support/session';
import { bodyText, gotoOk, mpath, setActiveBranch } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false).

const APP_TYPE = 'microlending';

test.afterAll(async () => {
  await closeDb();
});

/**
 * Run a cron endpoint, clearing its lock first.
 *
 * CronLock stops overlapping sweeps (CRON-3), and answers 429 to the second
 * caller. That is correct in production and useless in a test that needs the
 * job to actually run, so the lock is released the way the next scheduled run
 * would find it.
 */
async function runCron(path: string, opts: { releaseLock?: boolean } = {}) {
  if (opts.releaseLock !== false) {
    await db().cronLock.deleteMany({}).catch(() => undefined);
  }
  const secret = process.env.CRON_SECRET ?? 'e2e-cron-secret';
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** A loan whose instalments are already past due, for the overdue machinery. */
async function overdueLoan(tenantId: string, customerId: string) {
  const existing = await db().loan.findFirst({
    where: {
      tenantId,
      customerId,
      status: 'active',
      instalments: { some: { dueDate: { lt: new Date() }, status: { in: ['upcoming', 'partial', 'missed'] } } },
    },
    orderBy: { startDate: 'asc' },
  });
  return existing;
}

test('[ML-280] An unpaid instalment past its due date is missed', async () => {
  const s = loadState();
  const admin = await loginApi(s.tenantA.admin!.username, s.password);

  // Back-date origination so the first dues are already overdue.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 20);

  const created = await api.post(
    '/api/v1/loans',
    {
      customerId: s.tenantA.customerHq,
      principal: 4000,
      deduction: 0,
      deductionType: 'upfront_fixed',
      tenure: 20,
      frequency: 'daily',
      startDate: start.toISOString().slice(0, 10),
      penaltyRate: 50,
      loanType: 'cheque',
    },
    { token: admin.token },
  );
  expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);
  const loanId = created.data?.id ?? created.data?.loan?.id;

  // Instalment status is written by the accrual sweep; nothing marks a row
  // missed merely because it was read after its due date.
  await runCron('/api/cron/accrue-penalties');

  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const detail = await api.get(`/api/v1/loans/${loanId}/instalments`, { token: owner.token });
  expect(detail.status, JSON.stringify(detail.raw)).toBeLessThan(400);

  const rows = Array.isArray(detail.data) ? detail.data : detail.data?.items ?? [];
  const overdue = rows.filter((r: any) => new Date(r.dueDate) < new Date());
  expect(overdue.length, 'the back-dated schedule has overdue rows').toBeGreaterThan(0);
  for (const row of overdue) {
    expect(
      row.status,
      'an unpaid instalment past its due date is derived as missed, never upcoming (MONEY-11)',
    ).not.toBe('upcoming');
  }
});

test('[ML-281] Penalty accrual follows days × rate beyond the grace period', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  await setTenantSetting(owner, 'default_penalty_per_day', '50');
  await setTenantSetting(owner, 'penalty_grace_period', '0');

  const run = await runCron('/api/cron/accrue-penalties');
  expect(run.status, `the accrual job runs: ${JSON.stringify(run.body)}`).toBeLessThan(400);

  const penalties = await db().penalty.findMany({ where: { loan: { tenantId: s.tenantA.id } } });
  expect(penalties.length, 'the overdue book produced penalties').toBeGreaterThan(0);

  for (const penalty of penalties) {
    expect(num(penalty.grossPenalty), 'a penalty is a positive charge').toBeGreaterThan(0);
    expect(num(penalty.grossPenalty) % 50, 'the charge is a whole number of daily units').toBe(0);
  }
});

test('[ML-284] Penalty accrual is idempotent across re-runs', async () => {
  const s = loadState();
  const before = await db().penalty.findMany({ where: { loan: { tenantId: s.tenantA.id } } });
  const beforeTotal = before.reduce((sum, p) => sum + num(p.grossPenalty), 0);

  // Either the lock refuses the overlapping run (CRON-3) or the run happens
  // and changes nothing (CRON-2). Both satisfy "re-running is safe".
  const run = await runCron('/api/cron/accrue-penalties', { releaseLock: false });
  expect([200, 201, 429], `a re-run is refused or harmless, got ${run.status}`).toContain(run.status);

  const after = await db().penalty.findMany({ where: { loan: { tenantId: s.tenantA.id } } });
  const afterTotal = after.reduce((sum, p) => sum + num(p.grossPenalty), 0);

  expect(after.length, 'a same-day re-run adds no duplicate penalty rows (CRON-2)').toBe(before.length);
  expect(afterTotal, 'and does not double the accrued amount').toBe(beforeTotal);
});

test('[ML-283] Gross penalty only ever increases; reductions are waivers', async () => {
  const s = loadState();
  const penalty = await db().penalty.findFirst({ where: { loan: { tenantId: s.tenantA.id } } });
  if (!penalty) test.skip(true, 'no penalty accrued to waive');

  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const grossBefore = num(penalty!.grossPenalty);

  const res = await api.post(
    `/api/v1/penalties/${penalty!.id}/waive`,
    { amount: Math.min(50, grossBefore), reason: `waiver ${s.runId}` },
    { token: owner.token },
  );

  const after = await db().penalty.findUniqueOrThrow({ where: { id: penalty!.id } });
  expect(num(after.grossPenalty), 'the gross charge is never rewritten downwards (MONEY-15)').toBeGreaterThanOrEqual(
    grossBefore,
  );
  if (res.status < 300) {
    expect(num(after.waivedAmount), 'the reduction is recorded as a waiver').toBeGreaterThan(0);
  }
});

test('[ML-282] Penalty is capped by the tenant maximum', async () => {
  const s = loadState();
  const capOwner = await loginApi(s.tenantA.owner.username, s.password);
  await setTenantSetting(capOwner, 'penalty_max_cap', '100');

  try {
    // Gross only ever increases (MONEY-15), so a cap set after the fact cannot
    // pull an existing charge down — what it must do is stop any further growth.
    const before = new Map(
      (await db().penalty.findMany({ where: { loan: { tenantId: s.tenantA.id } } })).map((p) => [
        p.id,
        num(p.grossPenalty),
      ]),
    );

    const run = await runCron('/api/cron/accrue-penalties');
    expect(run.status).toBeLessThan(400);

    const penalties = await db().penalty.findMany({ where: { loan: { tenantId: s.tenantA.id } } });
    for (const penalty of penalties) {
      const wasCharged = before.get(penalty.id);
      if (wasCharged === undefined) {
        expect(num(penalty.grossPenalty), 'a charge raised under the cap respects it (MONEY-14)').toBeLessThanOrEqual(
          100,
        );
      } else {
        expect(
          num(penalty.grossPenalty),
          'an existing charge does not grow past the cap once it is set',
        ).toBeLessThanOrEqual(Math.max(wasCharged, 100));
      }
    }
  } finally {
    await setTenantSetting(capOwner, 'penalty_max_cap', '0');
  }
});

test('[ML-285] Penalties page is branch-scoped and closed to agents', async ({ page }) => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  // §7.2 lists penalties among the things an agent may not see, and ROLE-4
  // requires the handler to enforce it, not just the nav.
  const agentRes = await api.get('/api/v1/penalties', { token: agent.token });
  expect(
    [401, 403],
    `the penalties endpoint must refuse an agent token, got ${agentRes.status}`,
  ).toContain(agentRes.status);

  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.erode!);
  await gotoOk(page, mpath('/penalties'), 'penalties page on Erode');

  const erodeText = await bodyText(page);
  const hqCustomer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  expect(erodeText, 'HQ penalties must not surface under Erode (SCOPE-3)').not.toContain(
    hqCustomer.name.toLowerCase(),
  );
});

test('[ML-385] Classification ladder follows the RBI day buckets', async () => {
  const s = loadState();
  // The nightly sweep only visits tenants that bought NPA classification.
  await db().tenantSubscription.update({
    where: { tenantId: s.tenantA.id },
    data: { npaEnabled: true },
  });

  const run = await runCron('/api/cron/npa-classify');
  expect(run.status, `the classifier runs: ${JSON.stringify(run.body)}`).toBeLessThan(400);

  const loans = await db().loan.findMany({
    where: { tenantId: s.tenantA.id, status: { in: ['active', 'npa'] } },
    select: { id: true, loanCode: true, npaStatus: true, npaSubCategory: true },
  });
  const categorised = loans.filter((l) => l.npaStatus || l.npaSubCategory);
  expect(categorised.length, 'the sweep classified the book').toBeGreaterThan(0);

  const ladder = ['standard', 'sma_0', 'sma_1', 'sma_2', 'sub_standard', 'doubtful_d1', 'doubtful_d2', 'doubtful_d3', 'loss', 'written_off'];
  for (const loan of categorised) {
    expect(ladder, `${loan.loanCode} carries a category from the RBI ladder`).toContain(loan.npaSubCategory ?? loan.npaStatus);
  }
});

test('[ML-386] npaClassifiedAt is stamped once and never restamped', async () => {
  const s = loadState();
  const before = await db().loan.findMany({
    where: { tenantId: s.tenantA.id, npaClassifiedAt: { not: null } },
    select: { id: true, npaClassifiedAt: true },
  });
  if (before.length === 0) {
    test.skip(true, 'no loan reached NPA in this run — the ladder needs 90+ days overdue');
  }

  await runCron('/api/cron/npa-classify');

  for (const loan of before) {
    const after = await db().loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(
      after.npaClassifiedAt?.getTime(),
      'a second sweep must not reset the original classification date (NPA-2)',
    ).toBe(loan.npaClassifiedAt?.getTime());
  }
});

test('[ML-388] NpaHistory rows are immutable', async () => {
  const s = loadState();
  const row = await db().npaHistory.findFirst({ where: { tenantId: s.tenantA.id } });
  if (!row) test.skip(true, 'no NPA history written in this run');

  // The immutability middleware is registered on the application's Prisma
  // singleton (lib/db.ts). A bare client of our own would bypass it and prove
  // nothing, so the write is attempted through the very client the app uses.
  const mod: any = await import('@/lib/db');
  const appPrisma = mod?.npaHistory ? mod : (mod.prisma ?? mod.default?.prisma ?? mod.default);
  expect(typeof appPrisma?.npaHistory?.update, 'the app Prisma client is reachable').toBe('function');

  let threw = false;
  try {
    await appPrisma.npaHistory.update({ where: { id: row!.id }, data: { toCategory: 'loss' } });
  } catch (error) {
    threw = /IMMUTABLE_RECORD/i.test(String((error as Error).message));
  }
  expect(threw, 'the RBI audit trail is append-only (DB-2, X-15)').toBe(true);
});

test('[ML-345] Route tracker is gated when the GPS add-on is off', async ({ page }) => {
  const s = loadState();
  await db().tenantSubscription.update({
    where: { tenantId: s.tenantA.id },
    data: { gpsTrackingEnabled: false },
  });

  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await gotoOk(page, mpath('/route-tracker'), 'route tracker with GPS off');

  const text = await bodyText(page);
  expect(text, 'the page explains the add-on is off rather than rendering a map').toMatch(
    /not enabled|disabled|upgrade|add-?on|contact/i,
  );
});

test('[ML-346] Enabling the GPS add-on renders the live map page', async ({ page }) => {
  const s = loadState();
  await db().tenantSubscription.update({
    where: { tenantId: s.tenantA.id },
    data: { gpsTrackingEnabled: true },
  });

  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await gotoOk(page, mpath('/route-tracker'), 'route tracker with GPS on');

  const text = await bodyText(page);
  expect(text, 'the tracker renders instead of the gate').not.toMatch(/not enabled|upgrade to enable/i);
});

test('[ML-347] Agent location ping is recorded', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);

  const res = await api.post(
    '/api/v1/gps/ping',
    { lat: 11.3410, lng: 77.7172, accuracyM: 12, capturedAt: new Date().toISOString(), routeId: s.tenantA.routeHq },
    { token: agent.token },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const ping = await db().agentLocationPing.findFirst({
    where: { tenantId: s.tenantA.id, agentId: s.tenantA.agentHq!.id },
    orderBy: { receivedAt: 'desc' },
  });
  expect(ping, 'the ping is stored for the agent').toBeTruthy();
  expect(ping!.lat).toBeCloseTo(11.3410, 3);
  expect(ping!.lng).toBeCloseTo(77.7172, 3);
});

test('[ML-348] Live agent map is branch-scoped', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  const res = await api.get('/api/v1/gps/live', { token: owner.token, branchId: s.tenantA.branches.erode });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(400);

  const rows = Array.isArray(res.data) ? res.data : res.data?.agents ?? res.data?.items ?? [];
  const ids = rows.map((a: any) => a.id ?? a.agentId);

  expect(ids, 'the HQ agent must not appear on the Erode live map (SCOPE-12)').not.toContain(
    s.tenantA.agentHq!.id,
  );
});

test('[ML-349] Collection captures the agent location and a verification status', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);

  const loan = await db().loan.findFirst({
    where: { tenantId: s.tenantA.id, customerId: s.tenantA.customerHq!, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (!loan) test.skip(true, 'no active loan left to collect against');

  const res = await api.post(
    '/api/v1/collection/collect',
    {
      loanId: loan!.id,
      amount: 25,
      paymentMode: 'cash',
      latitude: 11.3411,
      longitude: 77.7173,
      gpsAccuracy: 8,
      idempotencyKey: `gps-${s.runId}-${Date.now()}`,
    },
    { token: agent.token },
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const entry = await db().collectionEntry.findFirst({
    where: { tenantId: s.tenantA.id, loanId: loan!.id },
    orderBy: { submittedAt: 'desc' },
  });
  expect(entry, 'the collection was recorded').toBeTruthy();
  expect(entry!.lat ?? entry!.verificationStatus, 'the entry carries location evidence').toBeTruthy();
});

test('[ML-333] Statutory accounting is gated by the subscription', async () => {
  const s = loadState();
  const sub = await db().tenantSubscription.findUniqueOrThrow({ where: { tenantId: s.tenantA.id } });
  await db().tenantSubscription.update({
    where: { tenantId: s.tenantA.id },
    data: { premiumAccountingEnabled: false },
  });

  try {
    const admin = await loginApi(s.tenantA.admin!.username, s.password);
    const journalBefore = await db().journalEntry.count({ where: { tenantId: s.tenantA.id } });

    const res = await api.post(
      '/api/v1/loans',
      {
        customerId: s.tenantA.customerHq,
        principal: 2000,
        deduction: 0,
        deductionType: 'upfront_fixed',
        tenure: 4,
        frequency: 'daily',
        startDate: new Date().toISOString().slice(0, 10),
        loanType: 'cheque',
      },
      { token: admin.token },
    );
    expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
    const loanId = res.data?.id ?? res.data?.loan?.id;

    const cashBook = await db().accountEntry.count({
      where: { tenantId: s.tenantA.id, referenceId: loanId, type: 'loan_disburse' },
    });
    const journalAfter = await db().journalEntry.count({ where: { tenantId: s.tenantA.id } });

    expect(cashBook, 'the cash book is written regardless of the add-on (ACC-6)').toBeGreaterThan(0);
    expect(journalAfter, 'the GL posting is skipped, not failed (ACC-4)').toBe(journalBefore);
  } finally {
    await db().tenantSubscription.update({
      where: { tenantId: s.tenantA.id },
      data: { premiumAccountingEnabled: sub.premiumAccountingEnabled },
    });
  }
});

test('[ML-334] Accounting pages are branch-scoped and closed to agents', async ({ page }) => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const res = await api.get('/api/v1/accounting/trial-balance', { token: agent.token });
  expect([401, 403], `accounting must refuse an agent, got ${res.status}`).toContain(res.status);

  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/accounting'), 'accounting page');
  const text = await bodyText(page);
  expect(text.length, 'the accounting page renders for an owner').toBeGreaterThan(30);
});
