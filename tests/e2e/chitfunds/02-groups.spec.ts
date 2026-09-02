import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, runPhone, type Session } from './support/harness';
import { loadState, patchState, type ChitRunState, type SeededGroup } from './support/state';

/**
 * Group creation, configuration validation, members and editing.
 *
 * Every validation case asserts the STATUS as well as the message: API-4 says
 * 400 means invalid input and 500 means unexpected, and the mobile client
 * branches on that. A validator that throws into a catch-all 500 is a defect
 * even when the message is perfect, because the client cannot tell "you typed
 * it wrong" from "the server fell over".
 */

const CHIT_VALUE = 100_000;
const CONTRIB = 5_000;
const MEMBERS = 20;

// Assigned in beforeAll, never at module scope: Playwright loads every spec
// file before the first test runs, and the state file does not exist until
// 01-provisioning has written it.
let owner: Session;
let admin: Session;
let s: ChitRunState;

/** The payload every creation case starts from, so a case shows only its delta. */
function baseGroup(name: string, extra: Record<string, unknown> = {}) {
  return {
    name: `${name} ${s.runId}`,
    chitValue: CHIT_VALUE,
    monthlyContrib: CONTRIB,
    totalMembers: MEMBERS,
    commissionPct: 5,
    ...extra,
  };
}

async function createGroup(session: Session, body: Record<string, unknown>, branchId?: string) {
  return api.post('/api/v1/chits', body, {
    token: session.token,
    appType: 'chitfunds',
    branchId: branchId ?? s.tenantA.branches.hq,
  });
}

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
});

test.afterAll(async () => {
  await closeDb();
});

// ── Customer fixture ────────────────────────────────────────────────────────
// Members are customers. Onboarding is covered by the micro-lending suite, so
// these are created through the API in one pass rather than re-tested here.
test('[CF-015] Chit member customers are seeded in both branches', async () => {
  const made: Record<string, string[]> = { hq: [], erode: [] };

  for (const [key, branchId] of [['hq', s.tenantA.branches.hq!], ['erode', s.tenantA.branches.erode!]] as const) {
    for (let i = 0; i < (key === 'hq' ? 24 : 4); i++) {
      const res = await api.post(
        '/api/v1/customers',
        {
          name: `${key === 'hq' ? 'HQ' : 'ER'} Subscriber ${i + 1} ${s.runId}`,
          phone: runPhone(s.runId, 100 + (key === 'hq' ? 0 : 50) + i),
          address: `${key} chit bench`,
        },
        { token: owner.token, appType: 'chitfunds', branchId },
      );
      expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
      made[key].push(res.data.id);
    }
  }

  expect(made.hq).toHaveLength(24);
  expect(made.erode).toHaveLength(4);

  const rows = await db().customer.findMany({
    where: { tenantId: s.tenantA.id, appType: 'chitfunds' },
    select: { id: true, branchId: true },
  });
  expect(rows.length, 'every seeded customer persisted with appType chitfunds').toBeGreaterThanOrEqual(28);

  patchState((state) => {
    state.tenantA.customers = { hq: made.hq, erode: made.erode };
  });
});

// ── Creation happy path ─────────────────────────────────────────────────────
test('[CF-020] Create a chit group with the minimum valid payload', async () => {
  const res = await createGroup(admin, baseGroup('QA Manual 1L'));
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.status).toBe('draft');
  expect(row.complianceStatus).toBe('draft');
  expect(row.appType).toBe('chitfunds');
  expect(row.branchId, 'stamped with the caller active branch').toBe(s.tenantA.branches.hq);
  expect(Number(row.chitValue)).toBe(CHIT_VALUE);
  expect(row.groupCode, 'a group code is generated').toMatch(/^CF/);
});

test('[CF-041] A group is created against the caller’s active branch, not a body-supplied one', async () => {
  const res = await createGroup(
    admin,
    baseGroup('Branch Spoof', { branchId: s.tenantA.branches.erode }),
    s.tenantA.branches.hq,
  );
  expect(res.status).toBeLessThan(300);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.branchId, 'SCOPE-7: the body branchId is ignored').toBe(s.tenantA.branches.hq);
});

// ── Required-field validation ───────────────────────────────────────────────
test('[CF-021] A group without a name is rejected', async () => {
  const before = await db().chitGroup.count({ where: { tenantId: s.tenantA.id } });
  const res = await createGroup(admin, { ...baseGroup('Nameless'), name: '' });
  expect(res.status, JSON.stringify(res.raw)).toBe(400);
  expect(String(res.error ?? '')).toMatch(/name/i);
  expect(await db().chitGroup.count({ where: { tenantId: s.tenantA.id } })).toBe(before);
});

test('[CF-022] chitValue must be greater than zero', async () => {
  for (const chitValue of [0, -1, 'abc']) {
    const res = await createGroup(admin, baseGroup('Bad Value', { chitValue }));
    expect(res.status, `chitValue ${chitValue} → ${JSON.stringify(res.raw)}`).toBe(400);
    expect(String(res.error ?? ''), `chitValue ${chitValue}`).toMatch(/chitvalue/i);
  }
});

test('[CF-023] monthlyContrib must be greater than zero', async () => {
  for (const monthlyContrib of [0, -500]) {
    const res = await createGroup(admin, baseGroup('Bad Contrib', { monthlyContrib }));
    expect(res.status, `monthlyContrib ${monthlyContrib}`).toBe(400);
    expect(String(res.error ?? '')).toMatch(/monthlycontrib/i);
  }
});

test('[CF-024] totalMembers must be a positive integer', async () => {
  for (const totalMembers of [0, -5, 12.5]) {
    const res = await createGroup(admin, baseGroup('Bad Members', { totalMembers }));
    expect(res.status, `totalMembers ${totalMembers}`).toBe(400);
    expect(String(res.error ?? '')).toMatch(/totalmembers/i);
  }
});

test('[CF-025] commissionPct may be zero but never negative', async () => {
  const zero = await createGroup(admin, baseGroup('Zero Commission', { commissionPct: 0 }));
  expect(zero.status, JSON.stringify(zero.raw)).toBeLessThan(300);
  expect(Number((await db().chitGroup.findUniqueOrThrow({ where: { id: zero.data.id } })).commissionPct)).toBe(0);

  const negative = await createGroup(admin, baseGroup('Neg Commission', { commissionPct: -1 }));
  expect(negative.status).toBe(400);
  expect(String(negative.error ?? '')).toMatch(/commission/i);
});

test('[CF-026] memberIds cannot exceed totalMembers at creation', async () => {
  const res = await createGroup(admin, baseGroup('Too Many', { totalMembers: 5, memberIds: ['a', 'b', 'c', 'd', 'e', 'f'] }));
  expect(res.status, JSON.stringify(res.raw)).toBe(400);
  expect(String(res.error ?? '')).toMatch(/memberids/i);
});

// ── Enum validation (CHIT-5 + API-4) ────────────────────────────────────────
const ENUM_CASES: Array<{ id: string; title: string; field: string; value: string; match: RegExp }> = [
  { id: 'CF-028', title: 'An unknown auctionType is rejected before persistence', field: 'auctionType', value: 'dutch', match: /auction type/i },
  { id: 'CF-029', title: 'An unknown commissionBasis is rejected', field: 'commissionBasis', value: 'GROSS', match: /commission basis/i },
  { id: 'CF-030', title: 'An unknown dividendPolicy is rejected', field: 'dividendPolicy', value: 'WINNER_ONLY', match: /dividend policy/i },
  { id: 'CF-031', title: 'An unknown dividendDistribution is rejected', field: 'dividendDistribution', value: 'BANK_TRANSFER', match: /dividend distribution/i },
  { id: 'CF-032', title: 'An unknown tieBreakRule is rejected', field: 'tieBreakRule', value: 'HIGHEST_TICKET', match: /tie break/i },
];

for (const c of ENUM_CASES) {
  test(`[${c.id}] ${c.title}`, async () => {
    const before = await db().chitGroup.count({ where: { tenantId: s.tenantA.id } });
    const res = await createGroup(admin, baseGroup('Bad Enum', { [c.field]: c.value }));

    expect(String(res.error ?? ''), 'the validator names the offending setting').toMatch(c.match);
    expect(
      res.status,
      `API-4: invalid input is 400, not ${res.status} — the mobile client branches on the status, not the string`,
    ).toBe(400);
    expect(await db().chitGroup.count({ where: { tenantId: s.tenantA.id } }), 'nothing persisted').toBe(before);
  });
}

test('[CF-027] Every auctionType enum value is accepted', async () => {
  for (const auctionType of ['open_manual', 'open_live', 'sealed', 'lottery', 'fixed_rotation']) {
    const res = await createGroup(admin, baseGroup(`Type ${auctionType}`, { auctionType }));
    expect(res.status, `${auctionType} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
    const row = await db().chitGroup.findUniqueOrThrow({ where: { id: res.data.id } });
    expect(row.auctionType, 'the stored value round-trips unchanged').toBe(auctionType);
  }
});

test('[CF-033] minDiscountPct cannot exceed maxDiscountPct', async () => {
  const res = await createGroup(admin, baseGroup('Bad Range', { minDiscountPct: 30, maxDiscountPct: 20 }));
  expect(String(res.error ?? '')).toMatch(/minimum discount/i);
  expect(res.status, 'API-4: invalid input is 400').toBe(400);
});

test('[CF-034] fixedDiscountPct cannot be negative or exceed the maximum', async () => {
  const negative = await createGroup(admin, baseGroup('Neg Fixed', { fixedDiscountPct: -1 }));
  expect(String(negative.error ?? '')).toMatch(/fixed discount/i);
  expect(negative.status).toBe(400);

  const overCap = await createGroup(admin, baseGroup('Over Fixed', { fixedDiscountPct: 40, maxDiscountPct: 30 }));
  expect(String(overCap.error ?? '')).toMatch(/fixed discount/i);
  expect(overCap.status).toBe(400);
});

test('[CF-040] Commission above the foreman cap is refused', async () => {
  const res = await createGroup(admin, baseGroup('Over Cap', { foremanCommissionCapPct: 5, commissionPct: 7 }));
  expect(
    res.status,
    `CHIT-28 caps the foreman commission — a 7% commission under a 5% cap must not persist (${JSON.stringify(res.raw)})`,
  ).toBe(400);
});

test('[CF-046] The API create route and the web form configure the same group', async () => {
  const res = await createGroup(
    admin,
    baseGroup('Parity', { auctionTime: '18:30', winnerInterestType: 'FIXED', winnerInterestValue: 500, winnerInterestPeriods: 3 }),
  );

  if (res.status >= 400) return; // refusing the unsupported fields is an acceptable answer

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(
    { auctionTime: row.auctionTime, winnerInterestType: row.winnerInterestType },
    'a field the caller supplied must not be silently dropped (API-7)',
  ).toEqual({ auctionTime: '18:30', winnerInterestType: 'FIXED' });
});

test('[CF-043] Very large chit values do not lose precision', async () => {
  const res = await createGroup(admin, baseGroup('Big Money', { chitValue: 99999999.99, monthlyContrib: 4999999.99 }));
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(Number(row.chitValue)).toBe(99999999.99);
  expect(Number(row.monthlyContrib)).toBe(4999999.99);
});

// ── Fixture groups the rest of the journey runs on ──────────────────────────
async function seedGroup(
  key: 'manual' | 'live' | 'lottery' | 'sealed' | 'rotation' | 'registered' | 'erode',
  body: Record<string, unknown>,
  branchKey: 'hq' | 'erode' = 'hq',
): Promise<SeededGroup> {
  const branchId = branchKey === 'hq' ? s.tenantA.branches.hq! : s.tenantA.branches.erode!;
  const customers: string[] = ((await db().customer.findMany({
    where: { tenantId: s.tenantA.id, appType: 'chitfunds', branchId },
    orderBy: { customerCode: 'asc' },
    select: { id: true },
  })) as Array<{ id: string }>).map((c) => c.id);

  const total = Number(body.totalMembers ?? MEMBERS);
  const memberIds = customers.slice(0, Math.min(total, customers.length));

  const res = await createGroup(owner, { ...body, memberIds }, branchId);
  expect(res.status, `seeding ${key}: ${JSON.stringify(res.raw)}`).toBeLessThan(300);

  const members = await db().chitMember.findMany({
    where: { chitGroupId: res.data.id },
    select: { id: true, ticketNo: true, customerId: true },
  });

  const seeded: SeededGroup = {
    id: res.data.id,
    name: String(body.name),
    chitValue: Number(body.chitValue ?? CHIT_VALUE),
    totalMembers: total,
    monthlyContrib: Number(body.monthlyContrib ?? CONTRIB),
    branchId,
    membersByTicket: Object.fromEntries(members.map((m) => [m.ticketNo, m.id])),
    customersByTicket: Object.fromEntries(members.map((m) => [m.ticketNo, m.customerId])),
  };
  patchState((state) => {
    state.tenantA.groups[key] = seeded;
  });
  return seeded;
}

test('[CF-016] The fixture groups for the journey are seeded', async () => {
  const manual = await seedGroup('manual', baseGroup('Fixture Manual', {
    auctionType: 'open_manual', gstPct: 18, dividendRounding: 5, maxDiscountPct: 30,
  }));
  expect(Object.keys(manual.membersByTicket)).toHaveLength(MEMBERS);

  await seedGroup('live', baseGroup('Fixture Live', {
    auctionType: 'open_live', gstPct: 18, maxDiscountPct: 30, bidIncrement: 500,
    bellEnabled: true, bellIntervalSeconds: 10, bellCount: 3, bellAutoClose: false,
  }));

  await seedGroup('sealed', baseGroup('Fixture Sealed', { auctionType: 'sealed', maxDiscountPct: 30 }));

  await seedGroup('lottery', baseGroup('Fixture Lottery', {
    auctionType: 'lottery', tieBreakRule: 'LOTTERY_AMONG_TIED',
  }));

  await seedGroup('rotation', baseGroup('Fixture Rotation', { auctionType: 'fixed_rotation' }));

  await seedGroup('registered', baseGroup('Fixture Registered', {
    chitType: 'registered', foremanCommissionCapPct: 5,
  }));

  await seedGroup('erode', baseGroup('Fixture Erode', { totalMembers: 4, monthlyContrib: 1000, chitValue: 4000 }), 'erode');

  const state = loadState();
  for (const key of ['manual', 'live', 'sealed', 'lottery', 'rotation', 'registered', 'erode'] as const) {
    expect(state.tenantA.groups[key], `${key} fixture must exist`).toBeTruthy();
  }
});

// ── Members, tickets and agreements ─────────────────────────────────────────
test('[CF-080] Members are listed for a group the caller can see', async () => {
  const state = loadState();
  const res = await api.get(`/api/v1/chits/${state.tenantA.groups.manual!.id}/members`, {
    token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq,
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  expect(rows).toHaveLength(MEMBERS);
  for (const row of rows) {
    expect(row.ticketNo, 'every member carries a ticket').toBeTruthy();
    expect(row).toHaveProperty('hasWon');
    expect(row).toHaveProperty('subscriberStatus');
  }
});

test('[CF-081] A member can be updated by an admin only', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const memberId = g.membersByTicket['1'];
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);

  const asAgent = await api.patch(
    `/api/v1/chits/${g.id}/members/${memberId}`,
    { remarks: 'agent edit' },
    { token: agent.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq },
  );
  expect(asAgent.status, 'ROLE-4: the handler refuses an agent').toBe(403);

  const asAdmin = await api.patch(
    `/api/v1/chits/${g.id}/members/${memberId}`,
    { remarks: 'admin edit' },
    { token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq },
  );
  expect(asAdmin.status, JSON.stringify(asAdmin.raw)).toBeLessThan(300);
});

test('[CF-088] Agreement status transitions are constrained to the enum', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const memberId = g.membersByTicket['1'];
  const opts = { token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq };

  for (const status of ['signed', 'verified']) {
    const res = await api.post(`/api/v1/chits/${g.id}/members/${memberId}/agreement`, { status }, opts);
    expect(res.status, `${status} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
  }

  const bad = await api.post(`/api/v1/chits/${g.id}/members/${memberId}/agreement`, { status: 'banana' }, opts);
  expect(bad.status).toBe(400);
  expect(String(bad.error ?? '')).toMatch(/agreement status/i);
});

test('[CF-096] A member from another tenant cannot be attached', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const foreign = await db().customer.findFirst({ where: { tenantId: s.tenantB.id } });
  const res = await api.patch(
    `/api/v1/chits/${g.id}/members/${g.membersByTicket['2']}`,
    { customerId: foreign?.id ?? 'cust_does_not_exist' },
    { token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq },
  );
  expect([400, 404], 'API-5: never confirm another tenant’s data').toContain(res.status);
});

// ── Editing and compliance ──────────────────────────────────────────────────
test('[CF-060] A draft group can be edited by an admin', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const put = await fetchPut(g.id, { name: `${g.name} edited` }, admin);
  expect(put.status, JSON.stringify(put.raw)).toBeLessThan(300);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: g.id } });
  expect(row.name).toContain('edited');
});

test('[CF-061] An agent cannot edit a group', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const res = await fetchPut(g.id, { name: 'agent rename' }, agent);
  expect(res.status).toBe(403);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: g.id } });
  expect(row.name, 'the name is untouched').not.toContain('agent rename');
});

test('[CF-064] Editing re-runs config validation', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const before = await db().chitGroup.findUniqueOrThrow({ where: { id: g.id } });

  const res = await fetchPut(g.id, { dividendDistribution: 'SOMETHING_ELSE' }, admin);
  expect(String(res.error ?? '')).toMatch(/dividend distribution/i);
  expect(res.status, 'API-4: invalid input is 400').toBe(400);

  const after = await db().chitGroup.findUniqueOrThrow({ where: { id: g.id } });
  expect(after.dividendDistribution).toBe(before.dividendDistribution);
});

test('[CF-066] Editing a soft-deleted group returns 404', async () => {
  const res = await createGroup(admin, baseGroup('To Delete'));
  expect(res.status).toBeLessThan(300);
  await db().chitGroup.update({ where: { id: res.data.id }, data: { deletedAt: new Date() } });

  const edit = await fetchPut(res.data.id, { name: 'ghost' }, admin);
  expect(edit.status, 'DB-4: soft-deleted rows are invisible').toBe(404);
});

/** PUT is not on the shared client, and this route is PUT rather than PATCH. */
async function fetchPut(groupId: string, body: Record<string, unknown>, session: Session) {
  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';
  const res = await fetch(`${base}/api/v1/chits/${groupId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'X-App-Type': 'chitfunds',
      'X-Branch-Id': s.tenantA.branches.hq!,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, data: raw?.data ?? null, error: raw?.error ?? null, raw };
}
