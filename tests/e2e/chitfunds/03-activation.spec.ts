import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, type Session } from './support/harness';
import { loadState, patchState, type ChitRunState } from './support/state';

/**
 * The activation gate and the schedule it generates.
 *
 * Activation is the point where a chit group stops being a draft and becomes a
 * set of obligations: totalMembers × totalMembers subscriptions and one auction
 * per period. For a registered chit the preconditions are statutory (CHIT-27),
 * so every one of them is asserted individually — a gate that only reports the
 * first missing field makes an operator fix seven things in seven round trips.
 */

let owner: Session;
let admin: Session;
let agent: Session;
let s: ChitRunState;

const opts = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

async function activate(session: Session, groupId: string, branchId?: string) {
  return api.post(`/api/v1/chits/${groupId}/activate`, {}, {
    token: session.token,
    appType: 'chitfunds',
    branchId: branchId ?? s.tenantA.branches.hq,
  });
}

/** Sign every agreement so only the condition under test is outstanding. */
async function signAllAgreements(groupId: string) {
  await db().chitMember.updateMany({ where: { chitGroupId: groupId }, data: { agreementStatus: 'signed' } });
}

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agent = await loginApi(s.tenantA.agentHq!.username, s.password);
});

test.afterAll(async () => {
  await closeDb();
});

// ── Refusals ────────────────────────────────────────────────────────────────
test('[CF-114] A group with zero members cannot activate', async () => {
  const created = await api.post(
    '/api/v1/chits',
    { name: `Empty ${s.runId}`, chitValue: 100000, monthlyContrib: 5000, totalMembers: 5, commissionPct: 5 },
    opts(),
  );
  expect(created.status).toBeLessThan(300);

  const res = await activate(admin, created.data.id);
  expect(res.status, JSON.stringify(res.raw)).toBe(400);
  expect(String(res.error ?? '')).toMatch(/at least one member/i);
});

test('[CF-113] Fewer members than totalMembers blocks activation', async () => {
  const customers = s.tenantA.customers!.hq.slice(0, 3);
  const created = await api.post(
    '/api/v1/chits',
    { name: `Short ${s.runId}`, chitValue: 100000, monthlyContrib: 5000, totalMembers: 5, commissionPct: 5, memberIds: customers },
    opts(),
  );
  expect(created.status).toBeLessThan(300);
  await signAllAgreements(created.data.id);

  const res = await activate(admin, created.data.id);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/all member slots/i);
});

test('[CF-115] A missing ticket number blocks activation', async () => {
  const g = loadState().tenantA.groups.sealed!;
  await signAllAgreements(g.id);
  const victim = g.membersByTicket['3'];
  const before = await db().chitMember.findUniqueOrThrow({ where: { id: victim } });
  await db().chitMember.update({ where: { id: victim }, data: { ticketNo: null } });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/ticket number|distinct ticket/i);

  await db().chitMember.update({ where: { id: victim }, data: { ticketNo: before.ticketNo } });
});

test('[CF-083] Duplicate ticket numbers block activation unless shares balance', async () => {
  const g = loadState().tenantA.groups.sealed!;
  await signAllAgreements(g.id);
  const victim = g.membersByTicket['4'];
  await db().chitMember.update({ where: { id: victim }, data: { ticketNo: '3' } });

  const res = await activate(admin, g.id);
  expect(res.status, JSON.stringify(res.raw)).toBe(400);
  expect(String(res.error ?? ''), 'the share sum is what catches a duplicated ticket').toMatch(/share total must equal/i);

  await db().chitMember.update({ where: { id: victim }, data: { ticketNo: '4' } });
});

test('[CF-085] A ticket whose shares total more than 1.00 is refused', async () => {
  const g = loadState().tenantA.groups.sealed!;
  const a = g.membersByTicket['5'];
  const b = g.membersByTicket['6'];
  await db().chitMember.update({ where: { id: a }, data: { ticketNo: '5', ticketShare: 0.6 } });
  await db().chitMember.update({ where: { id: b }, data: { ticketNo: '5', ticketShare: 0.5 } });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/share total must equal 1\.00/i);

  await db().chitMember.update({ where: { id: a }, data: { ticketNo: '5', ticketShare: 1 } });
  await db().chitMember.update({ where: { id: b }, data: { ticketNo: '6', ticketShare: 1 } });
});

test('[CF-086] A ticket whose shares total less than 1.00 is refused', async () => {
  const g = loadState().tenantA.groups.sealed!;
  const victim = g.membersByTicket['7'];
  await db().chitMember.update({ where: { id: victim }, data: { ticketShare: 0.5 } });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/share total must equal 1\.00/i);

  await db().chitMember.update({ where: { id: victim }, data: { ticketShare: 1 } });
});

test('[CF-089] Pending agreements block activation', async () => {
  const g = loadState().tenantA.groups.sealed!;
  await signAllAgreements(g.id);
  await db().chitMember.update({ where: { id: g.membersByTicket['8'] }, data: { agreementStatus: 'pending' } });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/agreements must be signed or verified/i);
});

test('[CF-090] A rejected agreement also blocks activation', async () => {
  const g = loadState().tenantA.groups.sealed!;
  await signAllAgreements(g.id);
  await db().chitMember.update({ where: { id: g.membersByTicket['8'] }, data: { agreementStatus: 'rejected' } });

  const res = await activate(admin, g.id);
  expect(res.status, 'only signed or verified satisfy the gate').toBe(400);
  expect(String(res.error ?? '')).toMatch(/agreements must be signed or verified/i);

  await signAllAgreements(g.id);
});

test('[CF-087] Exactly one foreman ticket is required when the group has one', async () => {
  const g = loadState().tenantA.groups.sealed!;
  await signAllAgreements(g.id);
  await db().chitGroup.update({ where: { id: g.id }, data: { hasForemanTicket: true } });
  await db().chitMember.updateMany({
    where: { id: { in: [g.membersByTicket['1'], g.membersByTicket['2']] } },
    data: { isForemanTicket: true },
  });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/exactly one foreman ticket/i);

  await db().chitMember.updateMany({ where: { chitGroupId: g.id }, data: { isForemanTicket: false } });
  await db().chitGroup.update({ where: { id: g.id }, data: { hasForemanTicket: false } });
});

test('[CF-116] Commission above the cap blocks activation', async () => {
  const g = loadState().tenantA.groups.sealed!;
  await signAllAgreements(g.id);
  await db().chitGroup.update({ where: { id: g.id }, data: { commissionPct: 7, foremanCommissionCapPct: 5 } });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/commission percentage exceeds cap/i);

  await db().chitGroup.update({ where: { id: g.id }, data: { commissionPct: 5, foremanCommissionCapPct: null } });
});

test('[CF-111] A registered chit demands all seven statutory fields', async () => {
  const g = loadState().tenantA.groups.registered!;
  await signAllAgreements(g.id);

  const res = await activate(admin, g.id);
  expect(res.status, JSON.stringify(res.raw)).toBe(400);
  const message = String(res.error ?? '');
  for (const field of [
    /registration number/i,
    /registration date/i,
    /registrar office/i,
    /by-?law number/i,
    /commencement certificate/i,
    /approved bank name/i,
    /foreman name/i,
  ]) {
    expect(message, `every statutory field is reported at once — ${field}`).toMatch(field);
  }
});

test('[CF-112] Each statutory field is checked individually', async () => {
  const g = loadState().tenantA.groups.registered!;
  await db().chitGroup.update({
    where: { id: g.id },
    data: {
      registrationNo: `REG-${s.runId}`,
      registrationDate: new Date('2026-01-05'),
      registrarOffice: null,
      bylawNo: `BL-${s.runId}`,
      commencementCertificate: `CC-${s.runId}`,
      approvedBankName: 'Test Approved Bank',
      foremanName: 'QA Foreman',
    },
  });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(400);
  const message = String(res.error ?? '');
  expect(message).toMatch(/registrar office/i);
  expect(message, 'the six satisfied fields are not reported as missing').not.toMatch(/registration number|by-?law number|commencement certificate/i);
});

test('[CF-121] An agent cannot activate a group', async () => {
  const g = loadState().tenantA.groups.manual!;
  const res = await activate(agent, g.id);
  expect(res.status).toBe(403);
  expect((await db().chitGroup.findUniqueOrThrow({ where: { id: g.id } })).status).toBe('draft');
});

test('[CF-122] Activating a group in another branch is refused', async () => {
  const g = loadState().tenantA.groups.erode!;
  const res = await activate(admin, g.id, s.tenantA.branches.hq);
  expect(res.status, 'SCOPE-3: out of the active branch is 404, not 403').toBe(404);
});

// ── The happy path and what it generates ────────────────────────────────────
test('[CF-110] An unregistered group activates once tickets and agreements are complete', async () => {
  const g = loadState().tenantA.groups.manual!;
  await signAllAgreements(g.id);

  const res = await activate(admin, g.id);
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: g.id } });
  expect(row.status).toBe('active');
  expect(row.complianceStatus).toBe('active');
});

test('[CF-118] Activation generates exactly totalMembers periods per member', async () => {
  const g = loadState().tenantA.groups.manual!;
  const subs = await db().chitSubscription.findMany({
    where: { member: { chitGroupId: g.id } },
    select: { periodNumber: true, dueAmount: true, status: true, memberId: true },
  });

  expect(subs, `${g.totalMembers} members × ${g.totalMembers} periods`).toHaveLength(g.totalMembers * g.totalMembers);
  expect(new Set(subs.map((x) => x.memberId)).size).toBe(g.totalMembers);
  expect(new Set(subs.map((x) => x.periodNumber)).size).toBe(g.totalMembers);
  for (const sub of subs) {
    expect(Number(sub.dueAmount), 'a full ticket owes the whole contribution').toBe(g.monthlyContrib);
    expect(sub.status).toBe('upcoming');
  }
});

test('[CF-119] Activation also generates one auction row per period', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auctions = await db().chitAuction.findMany({
    where: { chitGroupId: g.id },
    orderBy: { periodNumber: 'asc' },
  });

  expect(auctions).toHaveLength(g.totalMembers);
  expect(auctions.map((a) => a.periodNumber)).toEqual(
    Array.from({ length: g.totalMembers }, (_, i) => i + 1),
  );
  for (const auction of auctions) {
    expect(auction.status).toBe('pending');
    expect(auction.payoutStatus).toBe('not_ready');
    expect(auction.winnerMemberId).toBeNull();
  }

  patchState((state) => {
    state.tenantA.auctions.manual = auctions[0].id;
    state.tenantA.auctions.manualPeriod2 = auctions[1].id;
  });
});

test('[CF-117] Re-activating an already active group is refused', async () => {
  const g = loadState().tenantA.groups.manual!;
  const before = await db().chitSubscription.count({ where: { member: { chitGroupId: g.id } } });

  const res = await activate(admin, g.id);
  expect(res.status).toBe(409);
  expect(String(res.error ?? '')).toMatch(/already active/i);
  expect(await db().chitSubscription.count({ where: { member: { chitGroupId: g.id } } }), 'no duplicate schedule').toBe(before);
});

test('[CF-084] A ticket split into halves is accepted when the shares total 1.00', async () => {
  const customers = s.tenantA.customers!.hq.slice(0, 4);
  const created = await api.post(
    '/api/v1/chits',
    { name: `Half Ticket ${s.runId}`, chitValue: 40000, monthlyContrib: 1000, totalMembers: 3, commissionPct: 5, memberIds: customers },
    opts(),
  );
  expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);

  const members = await db().chitMember.findMany({ where: { chitGroupId: created.data.id }, orderBy: { memberNumber: 'asc' } });
  // Tickets 1 and 2 stay whole; members 3 and 4 share ticket 3 as halves.
  await db().chitMember.update({ where: { id: members[2].id }, data: { ticketNo: '3', ticketShare: 0.5 } });
  await db().chitMember.update({ where: { id: members[3].id }, data: { ticketNo: '3', ticketShare: 0.5 } });
  await signAllAgreements(created.data.id);

  const res = await activate(admin, created.data.id);
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const halfSubs = await db().chitSubscription.findMany({ where: { memberId: members[2].id } });
  expect(halfSubs.length).toBeGreaterThan(0);
  expect(Number(halfSubs[0].dueAmount), 'a half ticket owes half the contribution').toBe(500);

  const finalMembers = await db().chitMember.findMany({ where: { chitGroupId: created.data.id } });
  patchState((state) => {
    state.tenantA.groups.halfTicket = {
      id: created.data.id,
      name: `Half Ticket ${s.runId}`,
      chitValue: 40000,
      totalMembers: 3,
      monthlyContrib: 1000,
      branchId: s.tenantA.branches.hq!,
      // Two members share ticket 3, so the map keeps the last of the pair —
      // the half-share assertions address members directly, not by ticket.
      membersByTicket: Object.fromEntries(finalMembers.map((m) => [m.ticketNo ?? '', m.id])),
      customersByTicket: Object.fromEntries(finalMembers.map((m) => [m.ticketNo ?? '', m.customerId])),
    };
  });
});

// ── Frequency and the dates it produces ─────────────────────────────────────
type FreqCase = { id: string; title: string; body: Record<string, unknown>; expect: (dates: Date[]) => void };

const iso = (d: Date) => d.toISOString().slice(0, 10);

const FREQ_CASES: FreqCase[] = [
  {
    id: 'CF-140',
    title: 'Monthly periods step one calendar month at a time',
    body: { startDate: '2026-01-15', auctionFrequency: 'monthly' },
    expect: (d) => expect([iso(d[0]), iso(d[1]), iso(d[2])]).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']),
  },
  {
    id: 'CF-141',
    title: 'A month-end start clamps instead of overflowing',
    body: { startDate: '2026-01-31', auctionFrequency: 'monthly' },
    expect: (d) =>
      expect([iso(d[0]), iso(d[1]), iso(d[2]), iso(d[3])]).toEqual([
        '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
      ]),
  },
  {
    id: 'CF-142',
    title: 'A leap-year February clamps to the 29th',
    body: { startDate: '2028-01-31', auctionFrequency: 'monthly' },
    expect: (d) => expect(iso(d[1])).toBe('2028-02-29'),
  },
  {
    id: 'CF-143',
    title: 'Daily frequency steps one day per period',
    body: { startDate: '2026-03-01', frequencyUnit: 'day', frequencyInterval: 1 },
    expect: (d) => expect(iso(d[4])).toBe('2026-03-05'),
  },
  {
    id: 'CF-144',
    title: 'Weekly and fortnightly intervals step 7 and 14 days',
    body: { startDate: '2026-03-02', frequencyUnit: 'week', frequencyInterval: 2 },
    expect: (d) => expect(iso(d[2]), 'period 3 of a fortnightly chit is start + 28 days').toBe('2026-03-30'),
  },
];

for (const c of FREQ_CASES) {
  test(`[${c.id}] ${c.title}`, async () => {
    const customers = s.tenantA.customers!.hq.slice(0, 5);
    const created = await api.post(
      '/api/v1/chits',
      {
        name: `Freq ${c.id} ${s.runId}`,
        chitValue: 50000,
        monthlyContrib: 1000,
        totalMembers: 5,
        commissionPct: 5,
        memberIds: customers,
        ...c.body,
      },
      opts(),
    );
    expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);
    await signAllAgreements(created.data.id);

    const activated = await activate(admin, created.data.id);
    expect(activated.status, JSON.stringify(activated.raw)).toBeLessThan(300);

    const auctions = await db().chitAuction.findMany({
      where: { chitGroupId: created.data.id },
      orderBy: { periodNumber: 'asc' },
      select: { auctionDate: true },
    });
    c.expect(auctions.map((a) => a.auctionDate));
  });
}

test('[CF-145] Weekday-driven frequency counts only matching days', async () => {
  const customers = s.tenantA.customers!.hq.slice(0, 5);
  // 2026-03-01 is a Sunday; weekdays 1,3,5 are Mon/Wed/Fri.
  const created = await api.post(
    '/api/v1/chits',
    {
      name: `Weekdays ${s.runId}`,
      chitValue: 50000, monthlyContrib: 1000, totalMembers: 5, commissionPct: 5,
      memberIds: customers, startDate: '2026-03-01',
      frequencyUnit: 'day', frequencyInterval: 1, frequencyWeekdays: '1,3,5',
    },
    opts(),
  );
  expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);
  await signAllAgreements(created.data.id);
  expect((await activate(admin, created.data.id)).status).toBeLessThan(300);

  const dates = (
    await db().chitAuction.findMany({
      where: { chitGroupId: created.data.id },
      orderBy: { periodNumber: 'asc' },
      select: { auctionDate: true },
    })
  ).map((a) => a.auctionDate);

  expect([iso(dates[0]), iso(dates[1]), iso(dates[2])], 'Mon, Wed, Fri — Sunday and Tuesday are skipped').toEqual([
    '2026-03-02', '2026-03-04', '2026-03-06',
  ]);
});

test('[CF-063] Frequency cannot change after activation', async () => {
  const g = loadState().tenantA.groups.manual!;
  const before = await db().chitAuction.findFirstOrThrow({
    where: { chitGroupId: g.id, periodNumber: 2 },
    select: { auctionDate: true },
  });

  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';
  const res = await fetch(`${base}/api/v1/chits/${g.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.token}`,
      'X-App-Type': 'chitfunds',
      'X-Branch-Id': s.tenantA.branches.hq!,
    },
    body: JSON.stringify({ frequencyUnit: 'week', frequencyInterval: 1 }),
  });
  const raw = await res.json().catch(() => null);
  expect(res.status, JSON.stringify(raw)).toBe(409);
  expect(String(raw?.error ?? '')).toMatch(/frequency cannot be changed/i);

  const after = await db().chitAuction.findFirstOrThrow({
    where: { chitGroupId: g.id, periodNumber: 2 },
    select: { auctionDate: true },
  });
  expect(after.auctionDate.toISOString(), 'the generated dates are untouched').toBe(before.auctionDate.toISOString());
});
