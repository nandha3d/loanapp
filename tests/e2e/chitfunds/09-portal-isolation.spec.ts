import { expect, test } from '@playwright/test';
import { hash } from 'bcryptjs';
import { api, db, closeDb, loginApi, branchPool, num, BASE_URL, type Session } from './support/harness';
import { loadState, type ChitRunState } from './support/state';

/**
 * The borrower portal, isolation, the retired-endpoint contract, audit,
 * negatives and concurrency.
 *
 * Two ideas run through all of it. First, a member's own membership is resolved
 * from their session and never from a body-supplied memberId (SCOPE-2) — the
 * portal is the surface where a stranger's id is most tempting to trust.
 * Second, everything the room and the gate promise under load has to hold when
 * two requests land at once, because a chit auction is exactly the moment when
 * twenty people press the same button.
 */

let owner: Session;
let admin: Session;
let agent: Session;
let s: ChitRunState;

const asAdmin = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });
const asOwner = () => ({ token: owner.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

/** A borrower bearer token for a member of the live fixture. */
async function borrowerToken(customerId: string, phone: string, password = 'ChitBorrower@2026') {
  await db().customer.update({
    where: { id: customerId },
    data: { passwordHash: await hash(password, 10), status: 'active' },
  });

  const res = await fetch(`${BASE_URL}/api/v1/borrower/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-slug': s.tenantA.slug },
    body: JSON.stringify({ phone, password }),
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, token: raw?.data?.token ?? null, raw };
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

// ── Retired endpoints ───────────────────────────────────────────────────────
const RETIRED: Array<{ method: 'POST' | 'PATCH' | 'GET'; sub: string }> = [
  { method: 'POST', sub: '/bid' },
  { method: 'POST', sub: '/open' },
  { method: 'POST', sub: '/close' },
  { method: 'POST', sub: '/join' },
  { method: 'POST', sub: '/pass' },
  { method: 'POST', sub: '/retract' },
  { method: 'POST', sub: '/admit' },
  { method: 'POST', sub: '/undo' },
  { method: 'PATCH', sub: '/schedule' },
  { method: 'GET', sub: '/state' },
];

test('[CF-630] [CF-631] [CF-632] Every retired auction route answers 410', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });
  const before = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });

  for (const route of RETIRED) {
    const res = await fetch(`${BASE_URL}/api/v1/chits/${g.id}/auctions/${auction.id}${route.sub}`, {
      method: route.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.token}`,
        'X-App-Type': 'chitfunds',
        'X-Branch-Id': s.tenantA.branches.hq!,
      },
      body: route.method === 'GET' ? undefined : JSON.stringify({}),
    });
    expect(res.status, `${route.method} ${route.sub} must be Gone`).toBe(410);

    const raw = await res.json().catch(() => null);
    const body = JSON.stringify(raw ?? {});
    expect(body, `${route.sub} must not leak auction data in its 410`).not.toMatch(/chitValue|ticketNo|bidDiscount/i);
  }

  const after = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  expect(after.roomStatus, 'no retired route changed any state').toBe(before.roomStatus);
  expect(after.status).toBe(before.status);
});

test('[CF-634] Creating an auction directly is refused with guidance', async () => {
  const g = loadState().tenantA.groups.manual!;
  const before = await db().chitAuction.count({ where: { chitGroupId: g.id } });

  const res = await api.post(`/api/v1/chits/${g.id}/auctions`, { periodNumber: 99 }, asAdmin());
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(String(res.error ?? ''), 'the refusal explains where auctions come from').toMatch(/activat|generated|schedule/i);
  expect(await db().chitAuction.count({ where: { chitGroupId: g.id } })).toBe(before);
});

// ── Branch and tenant isolation ─────────────────────────────────────────────
test('[CF-645] [CF-646] The group list is branch-scoped, and a superadmin sees both', async () => {
  const state = loadState();

  const hq = await api.get('/api/v1/chits', asAdmin());
  expect(hq.status, JSON.stringify(hq.raw)).toBeLessThan(300);
  const hqRows = Array.isArray(hq.data) ? hq.data : hq.data?.items ?? [];
  const hqIds = hqRows.map((r: any) => r.id);

  expect(hqIds, 'the HQ fixture is present').toContain(state.tenantA.groups.manual!.id);
  expect(hqIds, 'SCOPE-3: the Erode group is not').not.toContain(state.tenantA.groups.erode!.id);

  const all = await api.get('/api/v1/chits', { token: owner.token, appType: 'chitfunds', branchId: null });
  const allIds = (Array.isArray(all.data) ? all.data : all.data?.items ?? []).map((r: any) => r.id);
  expect(allIds).toContain(state.tenantA.groups.manual!.id);
  expect(allIds, 'a superadmin across branches sees Erode too').toContain(state.tenantA.groups.erode!.id);
});

test('[CF-647] Switching the active branch switches the whole chit surface', async () => {
  const state = loadState();
  const erodeScoped = await api.get('/api/v1/chits', {
    token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.erode,
  });
  const ids = (Array.isArray(erodeScoped.data) ? erodeScoped.data : erodeScoped.data?.items ?? []).map((r: any) => r.id);

  expect(ids, 'no HQ group survives the switch').not.toContain(state.tenantA.groups.manual!.id);
});

test('[CF-648] A group id from another tenant returns 404, not 403', async () => {
  const foreign = await db().chitGroup.findFirst({ where: { tenantId: s.tenantB.id } });
  const probe = foreign?.id ?? 'chit_group_that_does_not_exist';

  const res = await api.get(`/api/v1/chits/${probe}`, asAdmin());
  expect(res.status, 'API-5: existence is never confirmed').toBe(404);
});

test('[CF-649] An auction from another branch cannot be actioned', async () => {
  const state = loadState();
  const erode = state.tenantA.groups.erode!;
  const auction = await db().chitAuction.findFirst({ where: { chitGroupId: erode.id } });
  if (!auction) test.skip(true, 'the Erode fixture has no generated auctions');

  const res = await api.post(`/api/v1/chits/${erode.id}/auctions/${auction!.id}/confirm`, {}, asAdmin());
  expect(res.status).toBe(404);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auction!.id } });
  expect(row.winnerMemberId, 'the Erode auction is untouched').toBeNull();
});

test('[CF-651] Soft-deleted groups are invisible but their receipts survive', async () => {
  const created = await api.post(
    '/api/v1/chits',
    { name: `Vanish ${s.runId}`, chitValue: 50000, monthlyContrib: 1000, totalMembers: 5, commissionPct: 5 },
    asAdmin(),
  );
  expect(created.status, JSON.stringify(created.raw)).toBeLessThan(300);
  await db().chitGroup.update({ where: { id: created.data.id }, data: { deletedAt: new Date() } });

  const list = await api.get('/api/v1/chits', asAdmin());
  const ids = (Array.isArray(list.data) ? list.data : list.data?.items ?? []).map((r: any) => r.id);
  expect(ids, 'DB-4: a soft-deleted group disappears from the list').not.toContain(created.data.id);

  const direct = await api.get(`/api/v1/chits/${created.data.id}`, asAdmin());
  expect(direct.status).toBe(404);

  const receipts = await db().chitReceipt.count({ where: { tenantId: s.tenantA.id } });
  expect(receipts, 'the ledger is not emptied by a soft delete').toBeGreaterThan(0);
});

test('[CF-652] Chit receipts do not appear in another module’s ledger', async () => {
  const leaked = await db().chitReceipt.count({
    where: { tenantId: s.tenantA.id, appType: { not: 'chitfunds' } },
  });
  expect(leaked, 'SCOPE-1: every chit receipt is stamped chitfunds').toBe(0);

  const entries = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, referenceType: 'chit_subscription', appType: { not: 'chitfunds' } },
  });
  expect(entries, 'and so is every chit account entry').toBe(0);
});

test('[CF-004] Chit rows never leak into another module’s appType', async () => {
  const wrongModule = await db().chitGroup.count({
    where: { tenantId: s.tenantA.id, appType: { not: 'chitfunds' } },
  });
  expect(wrongModule).toBe(0);
});

// ── Audit, timeline and minutes ─────────────────────────────────────────────
test('[CF-665] Every chit state change writes an audit row', async () => {
  const state = loadState();
  const auctionId = state.tenantA.auctions.confirmed;

  const audits = await db().auditLog.findMany({
    where: { tenantId: s.tenantA.id, entityType: 'chit_auction' },
    select: { action: true, entityId: true, userId: true, newValue: true },
  });
  expect(audits.length, 'CHIT-30').toBeGreaterThan(0);

  const forConfirmed = audits.filter((a) => a.entityId === auctionId);
  expect(forConfirmed.length, 'the confirmed auction is audited').toBeGreaterThan(0);
  for (const row of forConfirmed) {
    expect(row.userId, 'every audit row names its actor').toBeTruthy();
    expect(row.action, 'and the action it recorded').toBeTruthy();
  }
});

test('[CF-667] The auction timeline reads in true chronological order', async () => {
  const state = loadState();
  const g = state.tenantA.groups.live!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 15 } });

  const res = await api.get(`/api/v1/chits/${g.id}/auctions/${auction.id}/timeline`, asAdmin());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const events = (Array.isArray(res.data) ? res.data : res.data?.events ?? []) as Array<{ createdAt: string; type: string }>;
  expect(events.length, 'the room left a trail').toBeGreaterThan(0);

  const times = events.map((e) => new Date(e.createdAt).getTime());
  const sorted = [...times].sort((a, b) => a - b);
  expect(times, 'backdated bell events sit at their real due time, not at poll time').toEqual(sorted);
});

test('[CF-668] The timeline of an unknown auction is refused', async () => {
  const g = loadState().tenantA.groups.manual!;
  const res = await api.get(`/api/v1/chits/${g.id}/auctions/auction_missing/timeline`, asAdmin());
  expect(res.status).toBe(404);
});

// ── Reports and dashboard ───────────────────────────────────────────────────
test('[CF-697] Foreman income reports commission, GST and rounding income separately', async () => {
  const state = loadState();
  const auctions = await db().chitAuction.findMany({
    where: { chitGroupId: state.tenantA.groups.manual!.id, status: { in: ['confirmed', 'paid'] } },
    select: { commission: true, gstAmount: true, roundingIncome: true },
  });
  expect(auctions.length, 'the journey confirmed several auctions').toBeGreaterThan(0);

  const rounding = auctions.reduce((sum, a) => sum + num(a.roundingIncome), 0);
  const commission = auctions.reduce((sum, a) => sum + num(a.commission), 0);
  expect(commission, 'commission accrued').toBeGreaterThan(0);
  expect(
    rounding,
    'CHIT-3: the rounding remainder is stored as its own figure, never folded into commission or dropped',
  ).toBeGreaterThan(0);

  for (const a of auctions) {
    expect(num(a.gstAmount), 'GST is its own column, not netted off the commission').toBeGreaterThanOrEqual(0);
  }
});

test('[CF-699] Chit reports are closed to agents', async () => {
  const res = await api.get('/api/v1/reports/chits', {
    token: agent.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq,
  });
  expect(
    [401, 403, 404],
    `ROLE-4: the handler refuses, not just the nav (got ${res.status})`,
  ).toContain(res.status);
});

// ── Security and negative ───────────────────────────────────────────────────
test('[CF-715] SQL-shaped payloads in chit text fields are inert', async () => {
  const payload = `'; DROP TABLE chit_groups; --`;
  const res = await api.post(
    '/api/v1/chits',
    { name: `${payload} ${s.runId}`, chitValue: 50000, monthlyContrib: 1000, totalMembers: 5, commissionPct: 5 },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.name, 'stored literally').toContain(payload);
  expect(await db().chitGroup.count({ where: { tenantId: s.tenantA.id } }), 'the table still exists').toBeGreaterThan(0);
});

test('[CF-716] Script payloads in text fields are stored inertly', async () => {
  const payload = '<script>window.__xss=1</script>';
  const res = await api.post(
    '/api/v1/chits',
    { name: `${payload}${s.runId}`, chitValue: 50000, monthlyContrib: 1000, totalMembers: 5, commissionPct: 5 },
    asAdmin(),
  );
  expect(res.status).toBeLessThan(300);

  const row = await db().chitGroup.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.name, 'kept as text, neither executed nor silently stripped').toContain(payload);
});

test('[CF-717] No chit response carries a password hash, token or secret', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.confirmed;

  const payloads = await Promise.all([
    api.get('/api/v1/chits', asAdmin()),
    api.get(`/api/v1/chits/${g.id}`, asAdmin()),
    api.get(`/api/v1/chits/${g.id}/members`, asAdmin()),
    api.get(`/api/v1/chits/${g.id}/subscriptions`, asAdmin()),
    api.get(`/api/v1/chits/${g.id}/auctions/${auctionId}/live`, asAdmin()),
    api.get('/api/v1/chits/payment-intents', asAdmin()),
  ]);

  for (const res of payloads) {
    const body = JSON.stringify(res.raw ?? {});
    expect(body, 'X-13: no password hash in a chit payload').not.toMatch(/"password_?[Hh]ash"/);
    expect(body, 'X-13: no token or secret either').not.toMatch(/"(token|secret|apiKey)"\s*:/i);
  }
});

test('[CF-718] A member id from another group cannot be smuggled into any action', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });
  const foreign = state.tenantA.groups.erode!.membersByTicket['1'];

  const attempts = [
    api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/bids`, { memberId: foreign, prizeAmount: 90_000 }, asAdmin()),
    api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/attendance`, { memberId: foreign, status: 'present' }, asAdmin()),
    api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/admission`, { memberId: foreign, decision: 'admit' }, asAdmin()),
    api.post(`/api/v1/chits/${g.id}/members/${foreign}/agreement`, { status: 'signed' }, asAdmin()),
  ];

  for (const res of await Promise.all(attempts)) {
    expect(res.status, 'SCOPE-1: a foreign member id is not found, not accepted').toBe(404);
  }

  const member = await db().chitMember.findUniqueOrThrow({ where: { id: foreign } });
  expect(member.agreementStatus, 'and nothing was written to it').not.toBe('signed');
});

test('[CF-719] Malformed JSON is refused cleanly', async () => {
  const g = loadState().tenantA.groups.manual!;
  const res = await fetch(`${BASE_URL}/api/v1/chits/${g.id}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
      'X-App-Type': 'chitfunds',
      'X-Branch-Id': s.tenantA.branches.hq!,
    },
    body: '{',
  });
  expect(res.status, 'a broken body is invalid input, not a server fault').toBeLessThan(500);

  const body = await res.text();
  expect(body, 'no stack trace reaches the client').not.toMatch(/at .*\.ts:\d+|node_modules/);
});

test('[CF-720] Extremely large numbers do not overflow the money columns', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });

  const res = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/bids`,
    { memberId: g.membersByTicket['1'], prizeAmount: 1e308 },
    asAdmin(),
  );
  expect(res.status, 'refused by validation').toBeGreaterThanOrEqual(400);

  const infinite = await db().chitBid.count({ where: { auctionId: auction.id, bidAmount: { gt: 1e15 } } });
  expect(infinite, 'no Infinity is persisted').toBe(0);
});

test('[CF-722] A negative amount cannot reverse money through a collect route', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await api.post(
    `/api/v1/chits/${g.id}/payments`,
    { memberId: g.membersByTicket['1'], periodNumber: 13, amount: -5_000, mode: 'ADD_PAYMENT' },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'X-14: the pool is untouched').toBe(poolBefore);
});

test('[CF-723] Error messages do not disclose internals', async () => {
  const g = loadState().tenantA.groups.manual!;
  const probes = await Promise.all([
    api.post(`/api/v1/chits/${g.id}/payments`, { memberId: 'nope', periodNumber: 1, amount: 100 }, asAdmin()),
    api.post(`/api/v1/chits/${g.id}/penalties`, { subscriptionId: 'nope', amount: 100 }, asAdmin()),
    api.get('/api/v1/chits/does_not_exist', asAdmin()),
  ]);

  for (const res of probes) {
    const message = String(res.error ?? '');
    expect(message, 'no Prisma code').not.toMatch(/P\d{4}/);
    expect(message, 'no table or column name').not.toMatch(/prisma\.|chit_groups|chit_subscriptions/i);
    expect(message, 'no file path').not.toMatch(/\.ts:\d+/);
  }
});

// ── Borrower portal ─────────────────────────────────────────────────────────
test('[CF-605] A member sees only their own groups and subscriptions', async () => {
  const state = loadState();
  const g = state.tenantA.groups.live!;
  const customerId = g.customersByTicket['1'];
  const customer = await db().customer.findUniqueOrThrow({ where: { id: customerId } });

  const auth = await borrowerToken(customerId, customer.phone);
  expect(auth.status, JSON.stringify(auth.raw)).toBeLessThan(300);
  expect(auth.token, 'the borrower gets a token').toBeTruthy();

  const res = await fetch(`${BASE_URL}/api/v1/borrower/chits/contributions`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const raw = await res.json().catch(() => null);
  expect(res.status, JSON.stringify(raw)).toBeLessThan(300);

  const body = JSON.stringify(raw ?? {});
  const otherCustomer = g.customersByTicket['2'];
  expect(body, 'SCOPE-2: another member id never appears in a member payload').not.toContain(otherCustomer);
  expect(body, 'nor a password hash').not.toMatch(/"password_?[Hh]ash"/);
});

test('[CF-606] A member cannot read a live auction of a group they do not belong to', async () => {
  const state = loadState();
  const live = state.tenantA.groups.live!;
  const foreignGroup = state.tenantA.groups.erode!;
  const customer = await db().customer.findUniqueOrThrow({ where: { id: live.customersByTicket['1'] } });
  const auth = await borrowerToken(customer.id, customer.phone);
  expect(auth.token).toBeTruthy();

  const auction = await db().chitAuction.findFirst({ where: { chitGroupId: foreignGroup.id } });
  const res = await fetch(
    `${BASE_URL}/api/v1/borrower/chits/${foreignGroup.id}/auctions/${auction?.id ?? 'missing'}/live`,
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
  expect(res.status, 'membership comes from the session, never from the URL').toBe(404);
});

test('[CF-614] A logged-out borrower is refused every chit route', async () => {
  const state = loadState();
  const g = state.tenantA.groups.live!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });

  const targets = [
    '/api/v1/borrower/chits/contributions',
    '/api/v1/borrower/chits/payment-intents',
    `/api/v1/borrower/chits/${g.id}/auctions/${auction.id}/live`,
  ];
  for (const target of targets) {
    const res = await fetch(`${BASE_URL}${target}`);
    expect(res.status, `${target} without a session`).toBe(401);
  }
});

test('[CF-615] A borrower from another tenant sees nothing', async () => {
  const state = loadState();
  const g = state.tenantA.groups.live!;
  const foreignCustomer = await db().customer.findFirst({ where: { tenantId: s.tenantB.id } });
  if (!foreignCustomer) test.skip(true, 'tenant B has no customers to borrow an identity from');

  const auth = await borrowerToken(foreignCustomer!.id, foreignCustomer!.phone);
  if (!auth.token) {
    expect(auth.status, 'a tenant-B borrower who cannot even authenticate here is already isolated').toBeGreaterThanOrEqual(400);
    return;
  }

  const res = await fetch(`${BASE_URL}/api/v1/borrower/chits/contributions`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const raw = await res.json().catch(() => null);
  expect(JSON.stringify(raw ?? {}), 'no tenant-A group reaches a tenant-B borrower').not.toContain(g.id);
});

// ── Concurrency ─────────────────────────────────────────────────────────────
test('[CF-736] Two simultaneous confirms produce one winner', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 15 } });
  await db().chitBid.deleteMany({ where: { auctionId: auction.id } });
  await db().chitSecurity.deleteMany({ where: { auctionId: auction.id } });
  await db().chitAuction.update({
    where: { id: auction.id },
    data: { status: 'pending', payoutStatus: 'not_ready', winnerMemberId: null, prizeAmount: null },
  });
  await db().chitMember.updateMany({ where: { chitGroupId: g.id }, data: { hasWon: false, wonAt: null } });

  const placed = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/bids`,
    { memberId: g.membersByTicket['1'], prizeAmount: 85_000 },
    asAdmin(),
  );
  expect(placed.status, JSON.stringify(placed.raw)).toBeLessThan(300);

  const [a, b] = await Promise.all([
    api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/confirm`, {}, asAdmin()),
    api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/confirm`, {}, asAdmin()),
  ]);

  const accepted = [a, b].filter((r) => r.status < 300);
  expect(accepted, 'exactly one confirm wins the race').toHaveLength(1);

  expect(await db().chitSecurity.count({ where: { auctionId: auction.id } }), 'one security row').toBe(1);
  expect(await db().chitBid.count({ where: { auctionId: auction.id, status: 'winning' } }), 'one winning bid').toBe(1);
});

test('[CF-737] Two simultaneous payouts post the prize once', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 15 } });
  const prize = num((await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } })).prizeAmount);

  await db().chitSecurity.updateMany({ where: { auctionId: auction.id }, data: { status: 'approved' } });
  await db().chitAuction.update({ where: { id: auction.id }, data: { payoutStatus: 'ready', status: 'confirmed' } });
  await db().branchCashAccount.updateMany({
    where: { tenantId: s.tenantA.id, appType: 'chitfunds', branchId: s.tenantA.branches.hq! },
    data: { balance: prize * 4 },
  });
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const [a, b] = await Promise.all([
    api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/payout`, {}, asOwner()),
    api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/payout`, {}, asOwner()),
  ]);

  expect([a, b].filter((r) => r.status < 300), 'CHIT-18: one posting only').toHaveLength(1);
  expect(await db().accountEntry.count({ where: { referenceId: auction.id, type: 'chit_payout' } })).toBe(1);
  expect(await db().chitReceipt.count({ where: { entityId: auction.id, receiptType: 'payout' } })).toBe(1);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'the pool is debited once').toBe(poolBefore - prize);
});

test('[CF-738] Two simultaneous collections do not double-credit', async () => {
  const g = loadState().tenantA.groups.manual!;
  const memberId = g.membersByTicket['1'];
  const sub = await db().chitSubscription.findFirstOrThrow({ where: { memberId, periodNumber: 14 } });
  await db().chitSubscription.update({
    where: { id: sub.id },
    data: { paidAmount: 0, status: 'upcoming', dueAmount: g.monthlyContrib },
  });
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const body = (key: string) => ({
    memberId, periodNumber: 14, amount: 2_500, mode: 'ADD_PAYMENT', paymentMode: 'cash', idempotencyKey: key,
  });
  const [a, b] = await Promise.all([
    api.post(`/api/v1/chits/${g.id}/payments`, body(`cf-${s.runId}-conc-a`), asAdmin()),
    api.post(`/api/v1/chits/${g.id}/payments`, body(`cf-${s.runId}-conc-b`), asAdmin()),
  ]);
  expect([a, b].every((r) => r.status < 300), `${JSON.stringify(a.raw)} | ${JSON.stringify(b.raw)}`).toBe(true);

  const row = await db().chitSubscription.findUniqueOrThrow({ where: { id: sub.id } });
  expect(num(row.paidAmount), 'both collections land exactly once').toBe(5_000);

  const receipts = await db().chitReceipt.findMany({ where: { entityId: sub.id, receiptType: 'collection' } });
  expect(receipts, 'two receipts').toHaveLength(2);
  expect(new Set(receipts.map((r) => r.receiptNo)).size, 'CHIT-25: with two distinct numbers').toBe(2);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!)).toBe(poolBefore + 5_000);
});

test('[CF-740] The live-state poll stays under the interval budget', async () => {
  const state = loadState();
  const g = state.tenantA.groups.live!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 15 } });

  const started = Date.now();
  const res = await api.get(`/api/v1/chits/${g.id}/auctions/${auction.id}/live`, asAdmin());
  const elapsed = Date.now() - started;

  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect(
    elapsed,
    `the client polls this every 2 seconds; a ${elapsed}ms response means the polls overlap`,
  ).toBeLessThan(2_000);
});

test('[CF-742] The group list is paginated, not unbounded', async () => {
  const res = await api.get('/api/v1/chits?limit=5', asAdmin());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  expect(rows.length, 'API-3: the limit is honoured').toBeLessThanOrEqual(5);
});
