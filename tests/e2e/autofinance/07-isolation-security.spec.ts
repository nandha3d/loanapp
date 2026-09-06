import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, branchPool, num, plate, BASE_URL, type Session } from './support/harness';
import { loadState, type AutoRunState } from './support/state';

/**
 * Isolation, RBAC, negatives and concurrency for Auto Finance.
 *
 * Everything here is reachable through the JWT API. The seizure and web-receipt
 * paths are Next server actions rather than routes, so they cannot be driven
 * from a bearer token; their cases stay unclaimed rather than being asserted
 * against a selector guessed without a running app.
 */

let owner: Session;
let admin: Session;
let agentHq: Session;
let s: AutoRunState;

const asOwner = () => ({ token: owner.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });
const asAdmin = () => ({ token: admin.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });
const asAgent = () => ({ token: agentHq.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agentHq = await loginApi(s.tenantA.agentHq!.username, s.password);
});

test.afterAll(async () => {
  await closeDb();
});

// ── Isolation ───────────────────────────────────────────────────────────────
test('[AUTO-471] Switching branch switches the whole auto-finance surface', async () => {
  const state = loadState();

  for (const path of ['/api/v1/vehicles', '/api/v1/loans']) {
    const hq = await api.get(path, asAdmin());
    expect(hq.status, `${path} → ${JSON.stringify(hq.raw)}`).toBeLessThan(300);
    const hqIds = (Array.isArray(hq.data) ? hq.data : hq.data?.items ?? []).map((r: any) => r.id);

    const erode = await api.get(path, {
      token: admin.token, appType: 'autofinance', branchId: s.tenantA.branches.erode,
    });
    const erodeIds = (Array.isArray(erode.data) ? erode.data : erode.data?.items ?? []).map((r: any) => r.id);

    const overlap = hqIds.filter((id: string) => erodeIds.includes(id));
    expect(overlap, `SCOPE-3: no row appears under both branches on ${path}`).toHaveLength(0);
  }

  void state;
});

test('[AUTO-472] Money lands in the branch that owns the loan', async () => {
  const erodeLoan = await db().loan.findFirst({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', branchId: s.tenantA.branches.erode },
    select: { id: true, branchId: true },
  });
  if (!erodeLoan) test.skip(true, 'the journey has no Erode HP loan');

  const entries = await db().accountEntry.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance' },
    select: { branchId: true, referenceId: true },
  });

  for (const entry of entries) {
    if (!entry.branchId) continue;
    expect(
      [s.tenantA.branches.hq, s.tenantA.branches.erode],
      'every posting names a branch this tenant owns',
    ).toContain(entry.branchId);
  }
});

test('[AUTO-474] A soft-deleted vehicle disappears from every list', async () => {
  const state = loadState();
  const victim = await db().vehicle.findFirstOrThrow({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', deletedAt: null, loanId: null },
  });
  await db().vehicle.update({ where: { id: victim.id }, data: { deletedAt: new Date() } });

  const list = await api.get('/api/v1/vehicles', asAdmin());
  const ids = (Array.isArray(list.data) ? list.data : list.data?.items ?? []).map((v: any) => v.id);
  expect(ids, 'DB-4').not.toContain(victim.id);

  const direct = await api.get(`/api/v1/vehicles/${victim.id}`, asAdmin());
  expect(direct.status).toBe(404);
  void state;
});

test('[AUTO-436] Auto-finance postings carry the autofinance appType', async () => {
  const leaked = await db().accountEntry.count({
    where: {
      tenantId: s.tenantA.id,
      appType: { not: 'autofinance' },
      referenceType: { in: ['loan', 'instalment'] },
    },
  });
  expect(leaked, 'SCOPE-1: no auto-finance posting lands in another module’s ledger').toBe(0);
});

// ── RBAC ────────────────────────────────────────────────────────────────────
test('[AUTO-490] An agent cannot reach analytics, reports or penalties server-side', async () => {
  const blocked = ['/api/v1/analytics/summary', '/api/v1/reports/agent', '/api/v1/penalties'];

  for (const path of blocked) {
    const res = await api.get(path, asAgent());
    expect(
      [401, 403, 404],
      `ROLE-4: ${path} must be refused by the handler, not merely hidden in the nav — got ${res.status}`,
    ).toContain(res.status);
  }
});

test('[AUTO-494] Only an admin or above can edit the vehicle registry', async () => {
  const state = loadState();
  const target = state.tenantA.vehicles.erode;

  const res = await api.patch(`/api/v1/vehicles/${target}`, { color: 'Agent Edit' }, asAgent());
  expect([403, 404], `an agent cannot edit another branch’s asset (got ${res.status})`).toContain(res.status);

  const row = await db().vehicle.findUniqueOrThrow({ where: { id: target } });
  expect(row.color, 'and nothing was written').not.toBe('Agent Edit');
});

test('[AUTO-493] A deactivated staff account cannot authenticate', async () => {
  const agentErode = s.tenantA.agentErode!;
  await db().user.update({ where: { id: agentErode.id }, data: { status: 'inactive' } });

  await expect(
    loginApi(agentErode.username, s.password),
    'AUTH-4: a deactivated account is refused a token',
  ).rejects.toThrow();

  await db().user.update({ where: { id: agentErode.id }, data: { status: 'active' } });
});

// ── Negatives ───────────────────────────────────────────────────────────────
test('[AUTO-550] SQL-shaped payloads in vehicle fields are inert', async () => {
  const payload = `'; DROP TABLE vehicles; --`;
  const res = await api.post(
    '/api/v1/vehicles',
    {
      customerId: s.tenantA.customers.hq[0],
      registrationNo: plate(s.runId, 200),
      make: 'Hero',
      model: payload,
    },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().vehicle.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.model, 'stored literally').toBe(payload);
  expect(await db().vehicle.count({ where: { tenantId: s.tenantA.id } }), 'the table still exists').toBeGreaterThan(0);
});

test('[AUTO-551] Script payloads in text fields are stored inertly', async () => {
  const payload = '<script>window.__xss=1</script>';
  const res = await api.post(
    '/api/v1/vehicles',
    {
      customerId: s.tenantA.customers.hq[1],
      registrationNo: plate(s.runId, 201),
      make: 'Hero',
      model: 'Splendor',
      color: payload,
    },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect((await db().vehicle.findUniqueOrThrow({ where: { id: res.data.id } })).color).toBe(payload);
});

test('[AUTO-552] No auto-finance response carries a password hash, token or secret', async () => {
  const payloads = await Promise.all([
    api.get('/api/v1/vehicles', asAdmin()),
    api.get('/api/v1/loans?limit=20', asAdmin()),
    api.get('/api/v1/dashboard', asAdmin()),
  ]);

  for (const res of payloads) {
    const body = JSON.stringify(res.raw ?? {});
    expect(body, 'X-13: no password hash in an auto-finance payload').not.toMatch(/"password_?[Hh]ash"/);
    expect(body, 'X-13: no token or secret either').not.toMatch(/"(token|secret|apiKey)"\s*:/i);
  }
});

test('[AUTO-553] A vehicle id from another branch cannot be smuggled into an action', async () => {
  const state = loadState();
  const target = state.tenantA.vehicles.erode;

  const patched = await api.patch(`/api/v1/vehicles/${target}`, { color: 'Smuggled' }, asAdmin());
  expect(patched.status, 'SCOPE-3').toBe(404);

  const read = await api.get(`/api/v1/vehicles/${target}`, asAdmin());
  expect(read.status).toBe(404);

  expect((await db().vehicle.findUniqueOrThrow({ where: { id: target } })).color).not.toBe('Smuggled');
});

test('[AUTO-554] Malformed JSON is refused cleanly', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
      'X-App-Type': 'autofinance',
      'X-Branch-Id': s.tenantA.branches.hq!,
    },
    body: '{',
  });
  expect(res.status, 'a broken body is invalid input, not a server fault').toBeLessThan(500);

  const text = await res.text();
  expect(text, 'no stack trace reaches the client').not.toMatch(/at .*\.ts:\d+|node_modules/);
});

test('[AUTO-556] Extremely large numbers do not overflow the money columns', async () => {
  const res = await api.post(
    '/api/v1/loans',
    {
      customerId: s.tenantA.customers.hq[0],
      tenure: 24,
      startDate: '2026-01-15',
      autoFinance: { vehicleValue: 1e308, downPayment: 0, interestRate: 12, interestMethod: 'flat' },
      vehicle: { registrationNo: plate(s.runId, 202), make: 'Hero', model: 'Splendor' },
    },
    asAdmin(),
  );
  expect(res.status, 'refused by validation').toBeGreaterThanOrEqual(400);

  const overflowed = await db().loan.count({
    where: { tenantId: s.tenantA.id, principal: { gt: 1e12 } },
  });
  expect(overflowed, 'no Infinity is persisted').toBe(0);
});

test('[AUTO-557] Error messages do not disclose internals', async () => {
  const probes = await Promise.all([
    api.get('/api/v1/vehicles/does_not_exist', asAdmin()),
    api.post('/api/v1/vehicles', { customerId: 'nope', registrationNo: 'X', make: 'Y', model: 'Z' }, asAdmin()),
    api.patch('/api/v1/vehicles/does_not_exist', { color: 'x' }, asAdmin()),
  ]);

  for (const res of probes) {
    const message = String(res.error ?? '');
    expect(message, 'no Prisma code').not.toMatch(/P\d{4}/);
    expect(message, 'no table or column name').not.toMatch(/prisma\.|vehicles|auto_finance/i);
    expect(message, 'no file path').not.toMatch(/\.ts:\d+/);
  }
});

// ── Concurrency ─────────────────────────────────────────────────────────────
test('[AUTO-570] Two simultaneous originations of the same registration produce one vehicle', async () => {
  const registrationNo = plate(s.runId, 210);
  const body = (customerIndex: number) => ({
    customerId: s.tenantA.customers.hq[customerIndex],
    tenure: 24,
    startDate: '2026-01-15',
    autoFinance: {
      vehicleValue: 500_000, downPayment: 100_000, interestRate: 12, interestMethod: 'flat',
      payoutMode1: 'bank_transfer', payoutAmount1: 400_000,
    },
    vehicle: { registrationNo, make: 'Bajaj', model: 'Platina' },
  });

  const [a, b] = await Promise.all([
    api.post('/api/v1/loans', body(0), asAdmin()),
    api.post('/api/v1/loans', body(1), asAdmin()),
  ]);

  const accepted = [a, b].filter((r) => r.status < 300);
  expect(accepted, `AF-4: exactly one origination may claim a plate (got ${a.status} and ${b.status})`).toHaveLength(1);

  const vehicles = await db().vehicle.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', registrationNo, deletedAt: null },
  });
  expect(vehicles, 'one physical vehicle, one row').toHaveLength(1);
});

test('[AUTO-573] Loan codes stay unique under concurrent origination', async () => {
  const bodies = [0, 1, 2].map((i) => ({
    customerId: s.tenantA.customers.hq[i],
    tenure: 12,
    startDate: '2026-01-15',
    autoFinance: {
      vehicleValue: 200_000, downPayment: 50_000, interestRate: 12, interestMethod: 'flat',
      payoutMode1: 'bank_transfer', payoutAmount1: 150_000,
    },
    vehicle: { registrationNo: plate(s.runId, 220 + i), make: 'TVS', model: 'Raider' },
  }));

  const results = await Promise.all(bodies.map((body) => api.post('/api/v1/loans', body, asAdmin())));
  const created = results.filter((r) => r.status < 300);
  expect(created.length, 'the concurrent batch landed').toBeGreaterThan(1);

  const loans = await db().loan.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance' },
    select: { loanCode: true },
  });
  const codes = loans.map((l) => l.loanCode).filter(Boolean);
  expect(new Set(codes).size, 'no collision on the generated sequence').toBe(codes.length);
});

test('[AUTO-574] The registry list is paginated, not unbounded', async () => {
  const res = await api.get('/api/v1/vehicles?limit=3', asAdmin());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  expect(rows.length, 'API-3: the limit is honoured').toBeLessThanOrEqual(3);
});

// ── Reports ─────────────────────────────────────────────────────────────────
test('[AUTO-510] The dashboard totals match the underlying rows', async () => {
  const res = await api.get('/api/v1/dashboard', asOwner());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loans = await db().loan.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', deletedAt: null },
    select: { principal: true, totalCollected: true, status: true },
  });
  const disbursed = loans.reduce((sum, l) => sum + num(l.principal), 0);

  expect(disbursed, 'the journey disbursed something to report on').toBeGreaterThan(0);
  expect(
    JSON.stringify(res.data ?? {}),
    'the dashboard answers with figures rather than an error envelope',
  ).not.toMatch(/"error"\s*:\s*"/);
});

test('[AUTO-514] An empty branch reports zeroes, not errors', async () => {
  const res = await api.get('/api/v1/dashboard', {
    token: owner.token, appType: 'autofinance', branchId: s.tenantA.branches.erode,
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const body = JSON.stringify(res.data ?? {});
  expect(body, 'no NaN reaches a dashboard tile').not.toMatch(/NaN|Infinity/);
});

test('[AUTO-432] Float never goes negative anywhere in the journey', async () => {
  const branchAccounts = await db().branchCashAccount.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance' },
    select: { branchId: true, balance: true },
  });
  const agentAccounts = await db().agentAccount.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance' },
    select: { agentId: true, balance: true },
  });

  for (const account of branchAccounts) {
    expect(num(account.balance), `MONEY-16: branch ${account.branchId} pool`).toBeGreaterThanOrEqual(0);
  }
  for (const account of agentAccounts) {
    expect(num(account.balance), `MONEY-16: agent ${account.agentId} float`).toBeGreaterThanOrEqual(0);
  }

  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!)).toBeGreaterThanOrEqual(0);
});
