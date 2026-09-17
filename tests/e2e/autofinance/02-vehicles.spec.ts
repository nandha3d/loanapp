import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, plate, type Session } from './support/harness';
import { loadState, patchState, type AutoRunState } from './support/state';

/**
 * The vehicle registry and its approval path.
 *
 * AF-4 is the rule under test through most of this file: a registration number
 * is unique per (tenantId, appType) and normalised to trimmed uppercase before
 * comparison or insert. The origination route does that; the standalone
 * registry route only trims — so the same plate entered through the two
 * surfaces can store two different values, and the registry's own duplicate
 * check can miss a case variant. Each of those is asserted separately so a
 * failure names which half is wrong.
 */

let owner: Session;
let admin: Session;
let agentHq: Session;
let s: AutoRunState;

const asAdmin = () => ({ token: admin.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });
const asOwner = () => ({ token: owner.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });
const asAgent = () => ({ token: agentHq.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });

function vehicleBody(overrides: Record<string, unknown> = {}) {
  return {
    customerId: s.tenantA.customers.hq[0],
    registrationNo: plate(s.runId, 1),
    make: 'Hero',
    model: 'Splendor Plus',
    ...overrides,
  };
}

async function createVehicle(session: Session, body: Record<string, unknown>, branchId?: string) {
  return api.post('/api/v1/vehicles', body, {
    token: session.token,
    appType: 'autofinance',
    branchId: branchId ?? s.tenantA.branches.hq,
  });
}

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agentHq = await loginApi(s.tenantA.agentHq!.username, s.password);
});

test.afterAll(async () => {
  await closeDb();
});

// ── Creation ────────────────────────────────────────────────────────────────
test('[AUTO-020] A vehicle is created with the minimum valid payload', async () => {
  const res = await createVehicle(admin, vehicleBody({ registrationNo: plate(s.runId, 1) }));
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().vehicle.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.tenantId).toBe(s.tenantA.id);
  expect(row.appType, 'stamped with the module that owns the registry').toBe('autofinance');
  expect(row.customerId).toBe(s.tenantA.customers.hq[0]);
  expect(row.status, 'an admin’s vehicle needs no review').toBe('active');

  patchState((state) => {
    state.tenantA.vehicles.first = res.data.id;
  });
});

test('[AUTO-005] Vehicles are stamped with appType autofinance', async () => {
  const wrongModule = await db().vehicle.count({
    where: { tenantId: s.tenantA.id, appType: { not: 'autofinance' } },
  });
  expect(wrongModule, 'SCOPE-1: no vehicle leaks into another module').toBe(0);
});

test('[AUTO-021] customerId, registrationNo, make and model are all required', async () => {
  const before = await db().vehicle.count({ where: { tenantId: s.tenantA.id } });

  for (const field of ['customerId', 'registrationNo', 'make', 'model'] as const) {
    const body: Record<string, unknown> = vehicleBody({ registrationNo: plate(s.runId, 90) });
    delete body[field];
    const res = await createVehicle(admin, body);
    expect(res.status, `missing ${field} → ${JSON.stringify(res.raw)}`).toBe(400);
    expect(String(res.error ?? ''), `missing ${field}`).toMatch(/are required/i);
  }

  expect(await db().vehicle.count({ where: { tenantId: s.tenantA.id } }), 'nothing created').toBe(before);
});

test('[AUTO-022] A duplicate registration number is refused', async () => {
  const registrationNo = plate(s.runId, 2);
  const first = await createVehicle(admin, vehicleBody({ registrationNo }));
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);

  const second = await createVehicle(admin, vehicleBody({ registrationNo, customerId: s.tenantA.customers.hq[1] }));
  expect(second.status).toBe(409);
  expect(String(second.error ?? '')).toContain(registrationNo);

  expect(
    await db().vehicle.count({ where: { tenantId: s.tenantA.id, registrationNo, deletedAt: null } }),
    'one plate, one row',
  ).toBe(1);
});

test('[AUTO-023] A registration number is normalised to trimmed uppercase before it is stored', async () => {
  const canonical = plate(s.runId, 3);
  const res = await createVehicle(admin, vehicleBody({ registrationNo: `  ${canonical.toLowerCase()}  ` }));
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().vehicle.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(
    row.registrationNo,
    'AF-4: the registry must normalise the way the origination route does (.trim().toUpperCase()), or the same plate is stored two ways',
  ).toBe(canonical);
});

test('[AUTO-024] A case variant of an existing registration is treated as the same vehicle', async () => {
  const canonical = plate(s.runId, 4);
  const first = await createVehicle(admin, vehicleBody({ registrationNo: canonical }));
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);

  const variant = await createVehicle(
    admin,
    vehicleBody({ registrationNo: canonical.toLowerCase(), customerId: s.tenantA.customers.hq[1] }),
  );

  expect(
    variant.status,
    `AF-4: "${canonical.toLowerCase()}" and "${canonical}" are one physical vehicle — the duplicate check must compare the normalised value`,
  ).toBe(409);

  const rows = await db().vehicle.findMany({
    where: { tenantId: s.tenantA.id, deletedAt: null, registrationNo: { in: [canonical, canonical.toLowerCase()] } },
  });
  expect(rows, 'one registry row').toHaveLength(1);
});

test('[AUTO-025] The same registration may exist in a different tenant', async () => {
  const shared = plate(s.runId, 5);
  const mine = await createVehicle(admin, vehicleBody({ registrationNo: shared }));
  expect(mine.status, JSON.stringify(mine.raw)).toBeLessThan(300);

  if (!s.tenantB.customerId) test.skip(true, 'tenant B has no customer to file a vehicle against');

  const ownerB = await loginApi(s.tenantB.owner.username, s.password);
  const theirs = await api.post(
    '/api/v1/vehicles',
    { customerId: s.tenantB.customerId, registrationNo: shared, make: 'Bajaj', model: 'CT100' },
    { token: ownerB.token, appType: 'microlending', branchId: s.tenantB.branchHq },
  );

  expect(
    theirs.status < 300 || theirs.status === 403,
    `the uniqueness is per (tenantId, appType), so tenant B is not blocked by tenant A's plate (got ${theirs.status})`,
  ).toBe(true);
});

test('[AUTO-026] A soft-deleted vehicle frees its registration number', async () => {
  const registrationNo = plate(s.runId, 6);
  const created = await createVehicle(admin, vehicleBody({ registrationNo }));
  expect(created.status).toBeLessThan(300);
  await db().vehicle.update({ where: { id: created.data.id }, data: { deletedAt: new Date() } });

  const again = await createVehicle(admin, vehicleBody({ registrationNo, customerId: s.tenantA.customers.hq[2] }));
  expect(again.status, JSON.stringify(again.raw)).toBeLessThan(300);

  const rows = await db().vehicle.findMany({ where: { tenantId: s.tenantA.id, registrationNo } });
  expect(rows, 'the deleted row stays in the table').toHaveLength(2);
  expect(rows.filter((r) => r.deletedAt === null), 'only one is live').toHaveLength(1);
});

test('[AUTO-027] A vehicle cannot be filed against another tenant’s customer', async () => {
  if (!s.tenantB.customerId) test.skip(true, 'tenant B has no customer');

  const res = await createVehicle(
    admin,
    vehicleBody({ registrationNo: plate(s.runId, 7), customerId: s.tenantB.customerId }),
  );
  expect(res.status, 'API-5: existence is not confirmed').toBe(404);
  expect(String(res.error ?? '')).toMatch(/customer not found/i);
});

test('[AUTO-028] An agent may only file a vehicle against a customer they hold', async () => {
  const erodeCustomer = s.tenantA.customers.erode[0];

  const foreign = await createVehicle(
    agentHq,
    vehicleBody({ registrationNo: plate(s.runId, 8), customerId: erodeCustomer }),
  );
  expect(foreign.status, 'another agent’s book is not visible, so the customer is not found').toBe(404);

  const own = await createVehicle(
    agentHq,
    vehicleBody({ registrationNo: plate(s.runId, 9), customerId: s.tenantA.customers.hq[3] }),
  );
  expect(own.status, `the agent’s own customer succeeds: ${JSON.stringify(own.raw)}`).toBeLessThan(300);

  patchState((state) => {
    state.tenantA.vehicles.agentSubmitted = own.data.id;
  });
});

// ── Reading ─────────────────────────────────────────────────────────────────
test('[AUTO-029] The registry list is branch-scoped', async () => {
  const erodeVehicle = await createVehicle(
    owner,
    { customerId: s.tenantA.customers.erode[0], registrationNo: plate(s.runId, 10), make: 'TVS', model: 'Jupiter' },
    s.tenantA.branches.erode,
  );
  expect(erodeVehicle.status, JSON.stringify(erodeVehicle.raw)).toBeLessThan(300);
  patchState((state) => {
    state.tenantA.vehicles.erode = erodeVehicle.data.id;
  });

  const hqList = await api.get('/api/v1/vehicles', asAdmin());
  expect(hqList.status, JSON.stringify(hqList.raw)).toBeLessThan(300);
  const hqIds = (Array.isArray(hqList.data) ? hqList.data : hqList.data?.items ?? []).map((v: any) => v.id);
  expect(hqIds, 'SCOPE-3: the Erode vehicle is out of scope').not.toContain(erodeVehicle.data.id);

  const across = await api.get('/api/v1/vehicles', { token: owner.token, appType: 'autofinance', branchId: null });
  const allIds = (Array.isArray(across.data) ? across.data : across.data?.items ?? []).map((v: any) => v.id);
  expect(allIds, 'a superadmin across branches sees it').toContain(erodeVehicle.data.id);
});

test('[AUTO-030] An agent sees only vehicles of customers they hold', async () => {
  const list = await api.get('/api/v1/vehicles', asAgent());
  expect(list.status, JSON.stringify(list.raw)).toBeLessThan(300);

  const rows = Array.isArray(list.data) ? list.data : list.data?.items ?? [];
  const state = loadState();
  const ids = rows.map((v: any) => v.id);
  expect(ids, 'the vehicle the agent filed is theirs').toContain(state.tenantA.vehicles.agentSubmitted);
  expect(ids, 'the Erode vehicle is not').not.toContain(state.tenantA.vehicles.erode);
});

test('[AUTO-031] Partial registration search finds the vehicle', async () => {
  const fragment = plate(s.runId, 1).slice(4);
  const res = await api.get(`/api/v1/vehicles?q=${encodeURIComponent(fragment)}`, asAdmin());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  expect(
    rows.length,
    'field staff type a fragment of the plate, not the whole thing',
  ).toBeGreaterThan(0);
});

test('[AUTO-470] A vehicle id from another tenant returns 404, not 403', async () => {
  const foreign = await db().vehicle.findFirst({ where: { tenantId: s.tenantB.id } });
  const probe = foreign?.id ?? 'vehicle_that_does_not_exist';

  const res = await api.get(`/api/v1/vehicles/${probe}`, asAdmin());
  expect(res.status).toBe(404);
});

// ── Updating ────────────────────────────────────────────────────────────────
test('[AUTO-032] A vehicle update changes only the fields supplied', async () => {
  const state = loadState();
  const before = await db().vehicle.findUniqueOrThrow({ where: { id: state.tenantA.vehicles.first } });

  const res = await api.patch(`/api/v1/vehicles/${before.id}`, { color: 'Matte Black' }, asAdmin());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const after = await db().vehicle.findUniqueOrThrow({ where: { id: before.id } });
  expect(after.color).toBe('Matte Black');
  expect(after.make, 'untouched fields stay put').toBe(before.make);
  expect(after.model).toBe(before.model);

  const empty = await api.patch(`/api/v1/vehicles/${before.id}`, {}, asAdmin());
  expect(empty.status, 'an empty patch is refused rather than silently accepted').toBe(400);
  expect(String(empty.error ?? '')).toMatch(/no changes/i);
});

test('[AUTO-033] A vehicle from another branch cannot be patched', async () => {
  const state = loadState();
  const res = await api.patch(
    `/api/v1/vehicles/${state.tenantA.vehicles.erode}`,
    { color: 'Red' },
    asAdmin(),
  );
  expect(res.status, 'SCOPE-3').toBe(404);
});

test('[AUTO-034] Engine and chassis numbers are stored as entered', async () => {
  const res = await createVehicle(
    admin,
    vehicleBody({
      registrationNo: plate(s.runId, 11),
      customerId: s.tenantA.customers.hq[4],
      engineNo: 'ENG-9f21-x',
      chassisNo: 'CHS-77aa-b',
    }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().vehicle.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.engineNo, 'shown as saved').toBe('ENG-9f21-x');
  expect(row.chassisNo).toBe('CHS-77aa-b');
});

test('[AUTO-036] vehicleType defaults to two_wheeler and rejects an unknown type', async () => {
  const defaulted = await createVehicle(
    admin,
    vehicleBody({ registrationNo: plate(s.runId, 12), customerId: s.tenantA.customers.hq[5] }),
  );
  expect(defaulted.status).toBeLessThan(300);
  expect((await db().vehicle.findUniqueOrThrow({ where: { id: defaulted.data.id } })).vehicleType).toBe('two_wheeler');

  const unknown = await createVehicle(
    admin,
    vehicleBody({ registrationNo: plate(s.runId, 13), customerId: s.tenantA.customers.hq[6], vehicleType: 'spaceship' }),
  );

  if (unknown.status < 300) {
    const row = await db().vehicle.findUniqueOrThrow({ where: { id: unknown.data.id } });
    expect(
      row.vehicleType,
      'an unknown type must be refused or normalised — never stored raw, because every report groups on it',
    ).not.toBe('spaceship');
  } else {
    expect(unknown.status).toBe(400);
  }
});

// ── Approval and the agent bypass ───────────────────────────────────────────
test('[AUTO-050] An agent’s vehicle lands in pending_review', async () => {
  const state = loadState();
  const row = await db().vehicle.findUniqueOrThrow({ where: { id: state.tenantA.vehicles.agentSubmitted } });
  expect(row.status, 'ROLE-5: an agent submission is reviewed before it becomes an asset').toBe('pending_review');

  const notifications = await db().systemNotification.count({
    where: { tenantId: s.tenantA.id, type: { contains: 'vehicle' } },
  });
  expect(notifications, 'the approvers were told').toBeGreaterThan(0);
});

test('[AUTO-051] An agent holding the bypass creates an active vehicle', async () => {
  await db().user.update({
    where: { id: s.tenantA.agentHq!.id },
    data: { bypassVehicleApproval: true },
  });

  const res = await createVehicle(
    agentHq,
    vehicleBody({ registrationNo: plate(s.runId, 14), customerId: s.tenantA.customers.hq[3] }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect((await db().vehicle.findUniqueOrThrow({ where: { id: res.data.id } })).status).toBe('active');

  await db().user.update({
    where: { id: s.tenantA.agentHq!.id },
    data: { bypassVehicleApproval: false },
  });
});

test('[AUTO-052] An admin’s vehicle is active without review', async () => {
  const res = await createVehicle(
    admin,
    vehicleBody({ registrationNo: plate(s.runId, 15), customerId: s.tenantA.customers.hq[7] }),
  );
  expect(res.status).toBeLessThan(300);
  expect(
    (await db().vehicle.findUniqueOrThrow({ where: { id: res.data.id } })).status,
    'the agent-only flag never gates a non-agent',
  ).toBe('active');
});

test('[AUTO-056] An agent cannot approve their own vehicle', async () => {
  const state = loadState();
  const pending = state.tenantA.vehicles.agentSubmitted;

  const res = await api.patch(`/api/v1/vehicles/${pending}`, { status: 'active' }, asAgent());
  const row = await db().vehicle.findUniqueOrThrow({ where: { id: pending } });

  expect(
    row.status,
    `ROLE-4: an agent must not activate their own submission (patch answered ${res.status})`,
  ).toBe('pending_review');
});

test('[AUTO-054] Approving a pending vehicle activates it', async () => {
  const state = loadState();
  const pending = state.tenantA.vehicles.agentSubmitted;

  const res = await api.patch(`/api/v1/vehicles/${pending}`, { status: 'active' }, asOwner());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  expect((await db().vehicle.findUniqueOrThrow({ where: { id: pending } })).status).toBe('active');

  const audits = await db().auditLog.findMany({
    where: { tenantId: s.tenantA.id, entityType: 'vehicle', entityId: pending },
  });
  expect(audits.length, 'the approval is audited with its actor').toBeGreaterThan(0);
});
