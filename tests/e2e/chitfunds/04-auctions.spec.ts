import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, idemKey, type Session } from './support/harness';
import { loadState, patchState, type ChitRunState } from './support/state';

/**
 * Auction scheduling, attendance and bidding.
 *
 * The bid validator is the single gate between an auction and the money that
 * follows it (CHIT-7): floor, cap, increment, eligibility and lock state all
 * refuse here or not at all. Each is asserted alone, with the others satisfied,
 * so a failure names the rule that broke rather than "the bid was refused".
 */

let admin: Session;
let agent: Session;
let s: ChitRunState;

const CHIT_VALUE = 100_000;

const asAdmin = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

/** prizeAmount for a discount percentage of the reference chit value. */
const prizeForDiscountPct = (pct: number) => CHIT_VALUE - (CHIT_VALUE * pct) / 100;

function bidPath(groupId: string, auctionId: string) {
  return `/api/v1/chits/${groupId}/auctions/${auctionId}/bids`;
}

async function placeBid(
  session: Session,
  groupId: string,
  auctionId: string,
  body: Record<string, unknown>,
) {
  return api.post(bidPath(groupId, auctionId), body, {
    token: session.token,
    appType: 'chitfunds',
    branchId: s.tenantA.branches.hq,
  });
}

/** The manual fixture's period-1 auction, kept clean between bidding cases. */
async function freshManualAuction(period: number) {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({
    where: { chitGroupId: g.id, periodNumber: period },
  });
  await db().chitBid.deleteMany({ where: { auctionId: auction.id } });
  await db().chitAuction.update({
    where: { id: auction.id },
    data: { status: 'pending', startedAt: null },
  });
  return { group: g, auction };
}

test.beforeAll(async () => {
  s = loadState();
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agent = await loginApi(s.tenantA.agentHq!.username, s.password);
});

test.afterAll(async () => {
  await closeDb();
});

// ── Scheduling and notices ──────────────────────────────────────────────────
test('[CF-160] A pending auction can be rescheduled', async () => {
  const { group, auction } = await freshManualAuction(3);
  await db().chitAuction.update({
    where: { id: auction.id },
    data: { reminder1DayAt: new Date(), reminder1HourAt: new Date() },
  });

  const when = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const res = await api.post(
    `/api/v1/chits/${group.id}/auctions/${auction.id}/reschedule`,
    { scheduledAt: when.toISOString() },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  expect(row.scheduledAt?.toISOString().slice(0, 16)).toBe(when.toISOString().slice(0, 16));
  expect(row.auctionDate.toISOString().slice(0, 16), 'the auction date follows the schedule').toBe(when.toISOString().slice(0, 16));
  expect(row.reminder1DayAt, 'reminder stamps reset so the cron re-sends for the new slot').toBeNull();
  expect(row.reminder1HourAt).toBeNull();
});

test('[CF-161] An invalid scheduledAt is rejected', async () => {
  const { group, auction } = await freshManualAuction(4);
  const res = await api.post(
    `/api/v1/chits/${group.id}/auctions/${auction.id}/reschedule`,
    { scheduledAt: 'not-a-date' },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/scheduledat is invalid/i);
});

test('[CF-162] Only pending or notice-sent auctions can be rescheduled', async () => {
  const { group, auction } = await freshManualAuction(5);
  const when = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

  for (const status of ['in_progress', 'confirmed']) {
    await db().chitAuction.update({ where: { id: auction.id }, data: { status } });
    const res = await api.post(
      `/api/v1/chits/${group.id}/auctions/${auction.id}/reschedule`,
      { scheduledAt: when },
      asAdmin(),
    );
    expect(res.status, `status ${status} → ${JSON.stringify(res.raw)}`).toBe(400);
    expect(String(res.error ?? '')).toMatch(/only pending or notice-sent/i);
  }
  await db().chitAuction.update({ where: { id: auction.id }, data: { status: 'pending' } });
});

test('[CF-167] The reminder cron refuses an unauthenticated call', async () => {
  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';
  const res = await fetch(`${base}/api/cron/chit-auction-reminders`);
  expect(res.status, 'CRON-3: an unauthenticated cron call is refused').toBe(401);
});

// ── Attendance and admission ────────────────────────────────────────────────
test('[CF-180] Staff can mark a member present', async () => {
  const { group, auction } = await freshManualAuction(1);
  const memberId = group.membersByTicket['1'];

  const res = await api.post(
    `/api/v1/chits/${group.id}/auctions/${auction.id}/attendance`,
    { memberId, status: 'present' },
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitAuctionAttendance.findUniqueOrThrow({
    where: { auctionId_memberId: { auctionId: auction.id, memberId } },
  });
  expect(row.status).toBe('present');
});

test('[CF-183] Re-marking attendance updates rather than duplicating', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });
  const memberId = g.membersByTicket['1'];

  const res = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/attendance`,
    { memberId, status: 'absent' },
    asAdmin(),
  );
  expect(res.status).toBeLessThan(300);

  const rows = await db().chitAuctionAttendance.findMany({ where: { auctionId: auction.id, memberId } });
  expect(rows, 'the (auctionId, memberId) key holds').toHaveLength(1);
  expect(rows[0].status).toBe('absent');
});

test('[CF-181] Proxy attendance requires a proxy name', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });

  const res = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/attendance`,
    { memberId: g.membersByTicket['2'], status: 'proxy' },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/proxyname is required/i);
});

test('[CF-182] Attendance for an unknown member is refused', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });
  const foreign = state.tenantA.groups.erode!.membersByTicket['1'];

  const res = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/attendance`,
    { memberId: foreign, status: 'present' },
    asAdmin(),
  );
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/member not found/i);
});

test('[CF-188] Admission decisions require the member to have joined', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });
  const memberId = g.membersByTicket['9'];
  await db().chitAuctionAttendance.deleteMany({ where: { auctionId: auction.id, memberId } });

  const res = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/admission`,
    { memberId, decision: 'admit' },
    asAdmin(),
  );
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/has not joined/i);
});

test('[CF-189] Admission decision must be admit or deny', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });

  const res = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/admission`,
    { memberId: g.membersByTicket['1'], decision: 'maybe' },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/admit.*deny/i);
});

test('[CF-191] Only an admin can decide admission', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });

  const res = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/admission`,
    { memberId: g.membersByTicket['1'], decision: 'admit' },
    { token: agent.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq },
  );
  expect(res.status).toBe(403);
});

// ── Bidding: required input ─────────────────────────────────────────────────
test('[CF-211] A bid without memberId or prizeAmount is rejected', async () => {
  const { group, auction } = await freshManualAuction(1);

  for (const body of [{}, { memberId: group.membersByTicket['1'], prizeAmount: 'abc' }]) {
    const res = await placeBid(admin, group.id, auction.id, body);
    expect(res.status, JSON.stringify(body)).toBe(400);
    expect(String(res.error ?? '')).toMatch(/memberid and prizeamount are required/i);
  }
});

test('[CF-212] A zero or negative prize amount is refused', async () => {
  const { group, auction } = await freshManualAuction(1);
  for (const prizeAmount of [0, -5000]) {
    const res = await placeBid(admin, group.id, auction.id, { memberId: group.membersByTicket['1'], prizeAmount });
    expect(res.status, `prizeAmount ${prizeAmount}`).toBe(400);
    expect(String(res.error ?? '')).toMatch(/greater than zero/i);
  }
});

test('[CF-213] A prize amount above the chit value is refused', async () => {
  const { group, auction } = await freshManualAuction(1);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: CHIT_VALUE + 1,
  });
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/cannot exceed chit value/i);
});

// ── Bidding: floor, cap and increment ───────────────────────────────────────
test('[CF-214] A bid below the discount floor is refused', async () => {
  const { group, auction } = await freshManualAuction(1);
  // commissionPct 5 and bidStartAtCommission defaulted true → floor is 5%.
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(3),
  });
  expect(res.status).toBe(400);
  expect(String(res.error ?? ''), 'CHIT-6: the floor is the commission when no explicit minimum is set').toMatch(
    /at least 5%/i,
  );
});

test('[CF-210] A valid bid is accepted and moves the auction to in_progress', async () => {
  const { group, auction } = await freshManualAuction(1);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(10),
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect(Number(res.data.bidDiscount)).toBe(10_000);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  expect(row.status).toBe('in_progress');
  expect(row.startedAt, 'startedAt is stamped on the first bid').toBeTruthy();

  const startedAt = row.startedAt!.toISOString();
  await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['2'],
    prizeAmount: prizeForDiscountPct(12),
  });
  const after = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  expect(after.startedAt!.toISOString(), 'a later bid does not restamp the start').toBe(startedAt);
});

test('[CF-217] A bid above maxDiscountPct is refused', async () => {
  const { group, auction } = await freshManualAuction(1);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(40),
  });
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/exceeds allowed maximum of 30/i);
});

test('[CF-218] A bid exactly at the cap is accepted', async () => {
  const { group, auction } = await freshManualAuction(1);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(30),
  });
  expect(res.status, 'the ceiling is inclusive').toBeLessThan(300);
  expect(Number(res.data.bidDiscount)).toBe(30_000);
});

test('[CF-215] An explicit minDiscountPct overrides the commission floor', async () => {
  const { group, auction } = await freshManualAuction(2);
  await db().chitGroup.update({ where: { id: group.id }, data: { minDiscountPct: 8 } });

  const low = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(6),
  });
  expect(low.status).toBe(400);
  expect(String(low.error ?? ''), 'the explicit floor wins over the commission').toMatch(/at least 8%/i);

  const ok = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(8),
  });
  expect(ok.status, JSON.stringify(ok.raw)).toBeLessThan(300);

  await db().chitGroup.update({ where: { id: group.id }, data: { minDiscountPct: null } });
});

test('[CF-216] bidStartAtCommission false removes the implied floor', async () => {
  const { group, auction } = await freshManualAuction(2);
  await db().chitGroup.update({ where: { id: group.id }, data: { bidStartAtCommission: false, minDiscountPct: null } });

  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(1),
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  await db().chitGroup.update({ where: { id: group.id }, data: { bidStartAtCommission: true } });
});

test('[CF-219] A bid must beat the current highest by the increment', async () => {
  const { group, auction } = await freshManualAuction(2);
  await db().chitGroup.update({ where: { id: group.id }, data: { bidIncrement: 500 } });

  const first = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(10),
  });
  expect(first.status).toBeLessThan(300);

  const tooSmall = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['2'],
    prizeAmount: CHIT_VALUE - 10_200,
  });
  expect(tooSmall.status).toBe(400);
  expect(String(tooSmall.error ?? '')).toMatch(/must exceed the current highest \(10000\).*500/i);
});

test('[CF-220] A bid exactly one increment above the highest is accepted', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 2 } });

  const res = await placeBid(admin, g.id, auction.id, {
    memberId: g.membersByTicket['2'],
    prizeAmount: CHIT_VALUE - 10_500,
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
});

test('[CF-221] An exact-at-cap bid bypasses the increment rule so cap ties can form', async () => {
  const { group, auction } = await freshManualAuction(2);
  await db().chitGroup.update({ where: { id: group.id }, data: { bidIncrement: 500 } });

  const near = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: CHIT_VALUE - 29_900,
  });
  expect(near.status, JSON.stringify(near.raw)).toBeLessThan(300);

  // 30000 is only 100 above the highest, but it is exactly the cap.
  const atCap = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['2'],
    prizeAmount: prizeForDiscountPct(30),
  });
  expect(atCap.status, JSON.stringify(atCap.raw)).toBeLessThan(300);

  const tie = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['3'],
    prizeAmount: prizeForDiscountPct(30),
  });
  expect(tie.status, 'a second member can also sit exactly at the cap, forming a tie').toBeLessThan(300);

  const atCapBids = await db().chitBid.count({ where: { auctionId: auction.id, bidDiscount: 30_000 } });
  expect(atCapBids).toBe(2);
});

test('[CF-222] The first bid of a round is not blocked by the increment', async () => {
  const { group, auction } = await freshManualAuction(6);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(5),
  });
  expect(res.status, 'the increment only applies once a highest exists').toBeLessThan(300);
});

// ── Bidding: eligibility and lock state ─────────────────────────────────────
test('[CF-223] A member who has already won cannot bid again', async () => {
  const { group, auction } = await freshManualAuction(6);
  const memberId = group.membersByTicket['10'];
  await db().chitMember.update({ where: { id: memberId }, data: { hasWon: true } });

  const res = await placeBid(admin, group.id, auction.id, { memberId, prizeAmount: prizeForDiscountPct(10) });
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/already won/i);

  await db().chitMember.update({ where: { id: memberId }, data: { hasWon: false } });
});

test('[CF-224] A non-active subscriber cannot bid', async () => {
  const { group, auction } = await freshManualAuction(6);
  const memberId = group.membersByTicket['11'];

  for (const subscriberStatus of ['defaulted', 'removed', 'substituted']) {
    await db().chitMember.update({ where: { id: memberId }, data: { subscriberStatus } });
    const res = await placeBid(admin, group.id, auction.id, { memberId, prizeAmount: prizeForDiscountPct(10) });
    expect(res.status, subscriberStatus).toBe(400);
    expect(String(res.error ?? ''), subscriberStatus).toMatch(new RegExp(subscriberStatus, 'i'));
  }

  await db().chitMember.update({ where: { id: memberId }, data: { subscriberStatus: 'active' } });
});

test('[CF-225] A locked auction rejects bids', async () => {
  const { group, auction } = await freshManualAuction(7);

  for (const status of ['confirmed', 'paid', 'cancelled']) {
    await db().chitAuction.update({ where: { id: auction.id }, data: { status } });
    const res = await placeBid(admin, group.id, auction.id, {
      memberId: group.membersByTicket['1'],
      prizeAmount: prizeForDiscountPct(10),
    });
    expect(res.status, status).toBe(400);
    expect(String(res.error ?? ''), status).toMatch(/auction is locked/i);
  }

  await db().chitAuction.update({ where: { id: auction.id }, data: { status: 'pending' } });
});

test('[CF-226] Lottery and fixed-rotation groups reject bids outright', async () => {
  const state = loadState();
  for (const key of ['lottery', 'rotation'] as const) {
    const g = state.tenantA.groups[key]!;
    await db().chitMember.updateMany({ where: { chitGroupId: g.id }, data: { agreementStatus: 'signed' } });
    const activate = await api.post(`/api/v1/chits/${g.id}/activate`, {}, asAdmin());
    expect([200, 201, 409]).toContain(activate.status);

    const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });
    const res = await placeBid(admin, g.id, auction.id, {
      memberId: g.membersByTicket['1'],
      prizeAmount: prizeForDiscountPct(10),
    });
    expect(res.status, key).toBe(400);
    expect(String(res.error ?? ''), key).toMatch(/draw/i);

    patchState((state2) => {
      state2.tenantA.auctions[key] = auction.id;
    });
  }
});

test('[CF-227] A bid for a member of another group is refused', async () => {
  const state = loadState();
  const { group, auction } = await freshManualAuction(7);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: state.tenantA.groups.erode!.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(10),
  });
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/member not found/i);
});

test('[CF-228] An agent cannot place a staff bid', async () => {
  const { group, auction } = await freshManualAuction(7);
  const res = await placeBid(agent, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(10),
  });
  expect(res.status).toBe(403);
});

test('[CF-229] A fractional prize amount is stored without drift', async () => {
  const { group, auction } = await freshManualAuction(7);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: 89_999.99,
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitBid.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(Number(row.bidDiscount), 'no floating-point residue').toBe(10_000.01);
});

// ── Idempotency and sources ─────────────────────────────────────────────────
test('[CF-245] The same idempotencyKey returns the original bid', async () => {
  const { group, auction } = await freshManualAuction(8);
  const key = idemKey(s.runId, 'bid-replay');
  const body = { memberId: group.membersByTicket['1'], prizeAmount: prizeForDiscountPct(10), idempotencyKey: key };

  const first = await placeBid(admin, group.id, auction.id, body);
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);

  const replay = await placeBid(admin, group.id, auction.id, body);
  expect(replay.status).toBeLessThan(300);
  expect(replay.data.id, 'the original bid is returned').toBe(first.data.id);
  expect(await db().chitBid.count({ where: { auctionId: auction.id } })).toBe(1);
});

test('[CF-246] A replay with the same key but a different amount does not overwrite', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 8 } });
  const key = idemKey(s.runId, 'bid-replay');

  const res = await placeBid(admin, g.id, auction.id, {
    memberId: g.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(15),
    idempotencyKey: key,
  });
  expect(res.status).toBeLessThan(300);

  const bids = await db().chitBid.findMany({ where: { auctionId: auction.id } });
  expect(bids, 'no second row').toHaveLength(1);
  expect(Number(bids[0].bidDiscount), 'the stored bid keeps its original amount').toBe(10_000);
});

test('[CF-247] Idempotency is scoped to the auction, not global', async () => {
  const g = loadState().tenantA.groups.manual!;
  const other = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 9 } });
  await db().chitBid.deleteMany({ where: { auctionId: other.id } });

  const res = await placeBid(admin, g.id, other.id, {
    memberId: g.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(10),
    idempotencyKey: idemKey(s.runId, 'bid-replay'),
  });
  expect(res.status, 'the unique key is (auctionId, idempotencyKey)').toBeLessThan(300);
  expect(await db().chitBid.count({ where: { auctionId: other.id } })).toBe(1);
});

test('[CF-249] Bid source is recorded as tap, voice or remote', async () => {
  const { group, auction } = await freshManualAuction(10);
  const tickets = ['1', '2', '3'];
  const sources = ['tap', 'voice', 'remote'];

  for (let i = 0; i < sources.length; i++) {
    const res = await placeBid(admin, group.id, auction.id, {
      memberId: group.membersByTicket[tickets[i]],
      prizeAmount: prizeForDiscountPct(10 + i * 2),
      source: sources[i],
    });
    expect(res.status, sources[i]).toBeLessThan(300);
    expect(res.data.source).toBe(sources[i]);
  }

  const unknown = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['4'],
    prizeAmount: prizeForDiscountPct(18),
    source: 'telepathy',
  });
  expect(unknown.status).toBeLessThan(300);
  expect(unknown.data.source, 'an unknown source normalises to tap rather than being stored raw').toBe('tap');
});

test('[CF-250] A voice bid keeps its transcript', async () => {
  const { group, auction } = await freshManualAuction(11);
  const res = await placeBid(admin, group.id, auction.id, {
    memberId: group.membersByTicket['1'],
    prizeAmount: prizeForDiscountPct(10),
    source: 'voice',
    transcript: 'ticket one bids ten thousand',
  });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitBid.findUniqueOrThrow({ where: { id: res.data.id } });
  expect(row.source).toBe('voice');
  expect(row.transcript).toBe('ticket one bids ten thousand');
});

test('[CF-251] Bids are never written outside placeChitBid', async () => {
  const { execSync } = await import('node:child_process');
  const hits = execSync(
    'git grep -n "chitBid.create" -- "app" "lib" || true',
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);

  expect(hits, `chitBid.create must exist only in the bid service: ${hits.join(' | ')}`).toHaveLength(1);
  expect(hits[0]).toContain('lib/chits/bidService.ts');
});
