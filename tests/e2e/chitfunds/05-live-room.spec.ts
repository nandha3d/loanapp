import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, pollUntil, type Session } from './support/harness';
import { loadState, type ChitRunState } from './support/state';

/**
 * The live auction room, its bells and its anti-snipe extension.
 *
 * These cases wait real seconds. The room closes LAZILY, on the first request
 * after expiry (CHIT-9), and bells advance from timestamps on the same poll
 * (CHIT-11) — so a test that faked the clock would be testing the fake. The
 * fixture group uses a 10-second bell interval and rooms are opened for
 * fractions of a minute to keep the wall-clock cost honest but bounded.
 */

let admin: Session;
let s: ChitRunState;

const CHIT_VALUE = 100_000;
const prizeForDiscount = (discount: number) => CHIT_VALUE - discount;

const asAdmin = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

function liveGroup() {
  return loadState().tenantA.groups.live!;
}

async function room(groupId: string, auctionId: string, body: Record<string, unknown>) {
  return api.post(`/api/v1/chits/${groupId}/auctions/${auctionId}/room`, body, asAdmin());
}

async function live(groupId: string, auctionId: string) {
  return api.get(`/api/v1/chits/${groupId}/auctions/${auctionId}/live`, asAdmin());
}

async function bid(groupId: string, auctionId: string, memberId: string, discount: number) {
  return api.post(
    `/api/v1/chits/${groupId}/auctions/${auctionId}/bids`,
    { memberId, prizeAmount: prizeForDiscount(discount) },
    asAdmin(),
  );
}

/** A clean live auction for one case: no bids, room reset to scheduled. */
async function freshLiveAuction(period: number) {
  const g = liveGroup();
  const auction = await db().chitAuction.findFirstOrThrow({
    where: { chitGroupId: g.id, periodNumber: period },
  });
  await db().chitBid.deleteMany({ where: { auctionId: auction.id } });
  await db().chitAuctionEvent.deleteMany({ where: { auctionId: auction.id } });
  await db().chitAuction.update({
    where: { id: auction.id },
    data: {
      status: 'pending',
      roomStatus: 'scheduled',
      biddingOpensAt: null,
      biddingClosesAt: null,
      autoExtendSeconds: 0,
      bellAnchorAt: null,
      bellsRung: 0,
      startedAt: null,
    },
  });
  return { group: g, auctionId: auction.id };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.beforeAll(async () => {
  s = loadState();
  admin = await loginApi(s.tenantA.admin!.username, s.password);

  // The live fixture has to be active before it has auctions to run.
  const g = loadState().tenantA.groups.live!;
  await db().chitMember.updateMany({ where: { chitGroupId: g.id }, data: { agreementStatus: 'signed' } });
  const res = await api.post(`/api/v1/chits/${g.id}/activate`, {}, asAdmin());
  expect([200, 201, 409], JSON.stringify(res.raw)).toContain(res.status);
});

test.afterAll(async () => {
  await closeDb();
});

// ── Opening and closing ─────────────────────────────────────────────────────
test('[CF-265] Opening a room sets the window and starts the auction', async () => {
  const { group, auctionId } = await freshLiveAuction(1);

  const res = await room(group.id, auctionId, { action: 'open', durationMinutes: 30 });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect(res.data.roomStatus).toBe('open');

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.status, 'opening the room starts the auction').toBe('in_progress');
  expect(row.biddingOpensAt).toBeTruthy();
  const windowMs = row.biddingClosesAt!.getTime() - row.biddingOpensAt!.getTime();
  expect(Math.round(windowMs / 60_000), 'a 30-minute room closes 30 minutes out').toBe(30);

  const events = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'open' } });
  expect(events, 'an open event is written').toHaveLength(1);
});

test('[CF-268] Opening an already open room is refused', async () => {
  const g = liveGroup();
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });
  const before = auction.biddingClosesAt!.getTime();

  const res = await room(g.id, auction.id, { action: 'open', durationMinutes: 30 });
  expect(String(res.error ?? '')).toMatch(/already open/i);
  expect(res.status, 'API-4: a refused operator action is 400, not an unexpected 500').toBe(400);

  const after = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  expect(after.biddingClosesAt!.getTime(), 'the retry does not extend the window').toBe(before);
});

test('[CF-266] A zero or negative room duration is refused', async () => {
  const { group, auctionId } = await freshLiveAuction(2);

  const zero = await room(group.id, auctionId, { action: 'open', durationMinutes: 0 });
  if (zero.status < 300) {
    const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
    const minutes = (row.biddingClosesAt!.getTime() - row.biddingOpensAt!.getTime()) / 60_000;
    expect(
      minutes,
      `a zero duration was accepted and silently became a ${minutes}-minute room — the operator asked for something impossible and was given a default instead of an error`,
    ).toBe(0);
  }

  await freshLiveAuction(2);
  const negative = await room(group.id, auctionId, { action: 'open', durationMinutes: -10 });
  expect(String(negative.error ?? '')).toMatch(/duration must be greater than zero/i);
  expect(negative.status, 'API-4: invalid input is 400').toBe(400);
});

test('[CF-267] A room can only be opened for an open_live group', async () => {
  const manual = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: manual.id, periodNumber: 12 } });

  const res = await room(manual.id, auction.id, { action: 'open', durationMinutes: 10 });
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/only available for open_live/i);
});

test('[CF-270] An invalid room action is refused', async () => {
  const g = liveGroup();
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 1 } });

  const res = await room(g.id, auction.id, { action: 'pause' });
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/must be open, close, or ring/i);
});

test('[CF-269] A locked auction cannot open a room', async () => {
  const { group, auctionId } = await freshLiveAuction(3);
  await db().chitAuction.update({ where: { id: auctionId }, data: { status: 'confirmed' } });

  const res = await room(group.id, auctionId, { action: 'open', durationMinutes: 10 });
  expect(res.status).toBe(409);
  expect(String(res.error ?? '')).toMatch(/locked/i);

  await db().chitAuction.update({ where: { id: auctionId }, data: { status: 'pending' } });
});

test('[CF-274] Manually closing a room stops bidding immediately', async () => {
  const { group, auctionId } = await freshLiveAuction(4);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 10 })).status).toBeLessThan(300);

  const closed = await room(group.id, auctionId, { action: 'close' });
  expect(closed.status, JSON.stringify(closed.raw)).toBeLessThan(300);
  expect(closed.data.roomStatus).toBe('closed');

  const refused = await bid(group.id, auctionId, group.membersByTicket['1'], 10_000);
  expect(refused.status).toBe(400);
  expect(String(refused.error ?? '')).toMatch(/room is not open/i);

  const events = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'close' } });
  expect(events).toHaveLength(1);
});

test('[CF-275] Closing a room that is not open is refused', async () => {
  const { group, auctionId } = await freshLiveAuction(5);

  const res = await room(group.id, auctionId, { action: 'close' });
  expect(String(res.error ?? '')).toMatch(/room is not open/i);
  expect(res.status, 'API-4: a refused operator action is 400').toBe(400);
});

test('[CF-276] Closing the room never selects a winner or moves money', async () => {
  const { group, auctionId } = await freshLiveAuction(6);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 10 })).status).toBeLessThan(300);

  for (const [ticket, discount] of [['1', 8_000], ['2', 10_000], ['3', 12_000]] as const) {
    const res = await bid(group.id, auctionId, group.membersByTicket[ticket], discount as number);
    expect(res.status, `${ticket} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
  }

  expect((await room(group.id, auctionId, { action: 'close' })).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.winnerMemberId, 'CHIT-12: the room never picks a winner').toBeNull();
  expect(row.payoutStatus).toBe('not_ready');
  expect(await db().chitSecurity.count({ where: { auctionId } })).toBe(0);
  expect(await db().chitReceipt.count({ where: { entityId: auctionId } })).toBe(0);
});

// ── Lazy close ──────────────────────────────────────────────────────────────
test('[CF-271] The room closes lazily on the first request after expiry', async () => {
  const { group, auctionId } = await freshLiveAuction(7);
  // 0.4 minutes = 24 seconds, long enough to open and bid, short enough to wait out.
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 0.4 })).status).toBeLessThan(300);
  expect((await bid(group.id, auctionId, group.membersByTicket['1'], 10_000)).status).toBeLessThan(300);

  const closesAt = (await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).biddingClosesAt!;
  await wait(Math.max(0, closesAt.getTime() - Date.now()) + 1_500);

  const beforePoll = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(beforePoll.roomStatus, 'nothing closes it until a request arrives').toBe('open');

  const polled = await live(group.id, auctionId);
  expect(polled.status, JSON.stringify(polled.raw)).toBeLessThan(300);
  expect(polled.data.roomStatus).toBe('closed');

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.status, 'in_progress becomes completed on the auto-close').toBe('completed');

  const events = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'close' } });
  expect(events, 'exactly one close event').toHaveLength(1);
  expect(events[0].message).toMatch(/time expired/i);
});

test('[CF-272] Two concurrent polls after expiry do not double-close', async () => {
  const { group, auctionId } = await freshLiveAuction(8);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 0.4 })).status).toBeLessThan(300);

  const closesAt = (await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).biddingClosesAt!;
  await wait(Math.max(0, closesAt.getTime() - Date.now()) + 1_500);

  const [a, b] = await Promise.all([live(group.id, auctionId), live(group.id, auctionId)]);
  expect(a.data.roomStatus).toBe('closed');
  expect(b.data.roomStatus).toBe('closed');

  const events = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'close' } });
  expect(events, 'CHIT-9: the transaction-safe re-read prevents a double close').toHaveLength(1);
});

test('[CF-273] A bid into an expired room is refused', async () => {
  const { group, auctionId } = await freshLiveAuction(9);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 0.4 })).status).toBeLessThan(300);

  const closesAt = (await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).biddingClosesAt!;
  await wait(Math.max(0, closesAt.getTime() - Date.now()) + 1_500);

  const res = await bid(group.id, auctionId, group.membersByTicket['1'], 10_000);
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/room is not open/i);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.roomStatus, 'the refused bid closed the room as a side effect').toBe('closed');
});

test('[CF-277] The live endpoint reports server time and seconds remaining', async () => {
  const { group, auctionId } = await freshLiveAuction(10);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  const first = await live(group.id, auctionId);
  expect(first.status).toBeLessThan(300);
  expect(first.data.serverTime, 'the client never has to trust its own clock').toBeTruthy();
  expect(first.data.secondsRemaining).toBeGreaterThan(0);
  expect(first.data.secondsRemaining).toBeLessThanOrEqual(300);

  await wait(2_000);
  const second = await live(group.id, auctionId);
  expect(second.data.secondsRemaining, 'the countdown moves down').toBeLessThan(first.data.secondsRemaining);
  expect(second.data.secondsRemaining, 'and never goes negative').toBeGreaterThanOrEqual(0);
});

// ── Anti-snipe ──────────────────────────────────────────────────────────────
test('[CF-295] A bid inside the final window extends the close time', async () => {
  const { group, auctionId } = await freshLiveAuction(11);
  expect(
    (await room(group.id, auctionId, { action: 'open', durationMinutes: 0.4, autoExtendSeconds: 30 })).status,
  ).toBeLessThan(300);

  const opened = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  const originalClose = opened.biddingClosesAt!.getTime();

  // The whole 24-second window sits inside the 30-second extension band, so any
  // bid is a late bid by definition.
  const res = await bid(group.id, auctionId, group.membersByTicket['1'], 10_000);
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const after = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(after.biddingClosesAt!.getTime() - originalClose, 'pushed forward by autoExtendSeconds').toBe(30_000);
  expect(after.roomStatus).toBe('extended');

  const events = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'extend' } });
  expect(events).toHaveLength(1);
});

test('[CF-296] A bid outside the final window does not extend', async () => {
  const { group, auctionId } = await freshLiveAuction(12);
  expect(
    (await room(group.id, auctionId, { action: 'open', durationMinutes: 5, autoExtendSeconds: 30 })).status,
  ).toBeLessThan(300);

  const opened = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  const originalClose = opened.biddingClosesAt!.getTime();

  expect((await bid(group.id, auctionId, group.membersByTicket['1'], 10_000)).status).toBeLessThan(300);

  const after = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(after.biddingClosesAt!.getTime(), 'five minutes out is not a snipe').toBe(originalClose);
  expect(await db().chitAuctionEvent.count({ where: { auctionId, type: 'extend' } })).toBe(0);
});

test('[CF-297] Extensions stack for repeated late bids', async () => {
  const { group, auctionId } = await freshLiveAuction(13);
  expect(
    (await room(group.id, auctionId, { action: 'open', durationMinutes: 0.4, autoExtendSeconds: 30 })).status,
  ).toBeLessThan(300);

  const originalClose = (await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).biddingClosesAt!.getTime();

  for (const [ticket, discount] of [['1', 10_000], ['2', 12_000], ['3', 14_000]] as const) {
    const res = await bid(group.id, auctionId, group.membersByTicket[ticket], discount as number);
    expect(res.status, `${ticket} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
  }

  const after = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(after.biddingClosesAt!.getTime() - originalClose, 'three late bids, three 30-second pushes').toBe(90_000);
  expect(await db().chitAuctionEvent.count({ where: { auctionId, type: 'extend' } })).toBe(3);
});

test('[CF-298] autoExtendSeconds zero disables anti-snipe', async () => {
  const { group, auctionId } = await freshLiveAuction(14);
  expect(
    (await room(group.id, auctionId, { action: 'open', durationMinutes: 0.4, autoExtendSeconds: 0 })).status,
  ).toBeLessThan(300);

  const originalClose = (await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).biddingClosesAt!.getTime();
  expect((await bid(group.id, auctionId, group.membersByTicket['1'], 10_000)).status).toBeLessThan(300);

  const after = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(after.biddingClosesAt!.getTime()).toBe(originalClose);
});

// ── Bells ───────────────────────────────────────────────────────────────────
test('[CF-301] Bells advance lazily from timestamps on a poll', async () => {
  const { group, auctionId } = await freshLiveAuction(15);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  // The fixture rings every 10 seconds, three times. Sit out three intervals
  // WITHOUT polling, then poll once.
  await wait(32_000);

  const idle = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(idle.bellsRung, 'nothing rings without a request — there is no server timer').toBe(0);

  const polled = await live(group.id, auctionId);
  expect(polled.status, JSON.stringify(polled.raw)).toBeLessThan(300);
  expect(polled.data.bell.bellsRung, 'one poll catches up every interval that came due').toBe(3);

  const events = await db().chitAuctionEvent.findMany({
    where: { auctionId, type: 'bell' },
    orderBy: { createdAt: 'asc' },
  });
  expect(events, 'one event per bell crossed').toHaveLength(3);
  const anchor = idle.bellAnchorAt!.getTime();
  events.forEach((e, i) => {
    expect(
      Math.round((e.createdAt.getTime() - anchor) / 1000),
      'each bell is backdated to its own due time, not to poll time',
    ).toBe((i + 1) * 10);
  });
});

test('[CF-302] Bells never exceed the configured bell count', async () => {
  const g = liveGroup();
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 15 } });

  await wait(12_000);
  const polled = await live(g.id, auction.id);
  expect(polled.data.bell.bellsRung, 'capped at bellCount').toBe(3);
  expect(await db().chitAuctionEvent.count({ where: { auctionId: auction.id, type: 'bell' } })).toBe(3);
  expect(polled.data.bell.nextBellAt, 'no next bell once the final one has rung').toBeNull();
});

test('[CF-299] A new bid resets the bell countdown', async () => {
  const g = liveGroup();
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 15 } });

  const res = await bid(g.id, auction.id, g.membersByTicket['1'], 10_000);
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  expect(row.bellsRung, 'CHIT-11: a new bid starts going-once over').toBe(0);
  expect(Date.now() - row.bellAnchorAt!.getTime(), 'the anchor is re-stamped to now').toBeLessThan(5_000);
});

test('[CF-300] Opening the room resets the bells', async () => {
  const { group, auctionId } = await freshLiveAuction(16);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);
  await wait(12_000);
  expect((await live(group.id, auctionId)).data.bell.bellsRung).toBeGreaterThanOrEqual(1);

  expect((await room(group.id, auctionId, { action: 'close' })).status).toBeLessThan(300);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.bellsRung, 'the countdown starts fresh on every open').toBe(0);
  expect(Date.now() - row.bellAnchorAt!.getTime()).toBeLessThan(5_000);
});

test('[CF-303] Two concurrent polls do not double-ring a bell', async () => {
  const { group, auctionId } = await freshLiveAuction(17);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  await wait(11_000);
  await Promise.all([live(group.id, auctionId), live(group.id, auctionId), live(group.id, auctionId)]);

  const events = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'bell' } });
  expect(events, 'the optimistic bellsRung guard admits exactly one writer').toHaveLength(1);
});

test('[CF-306] A manual ring re-anchors the automatic countdown', async () => {
  const { group, auctionId } = await freshLiveAuction(18);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  await wait(3_000);
  const rung = await room(group.id, auctionId, { action: 'ring' });
  expect(rung.status, JSON.stringify(rung.raw)).toBeLessThan(300);
  expect(rung.data.bellsRung).toBe(1);

  // 8 more seconds: past the original 10-second mark, but only 8 into the
  // re-anchored interval, so the automatic bell must not have fired yet.
  await wait(8_000);
  const polled = await live(group.id, auctionId);
  expect(polled.data.bell.bellsRung, 'the next automatic bell is a full interval after the manual ring').toBe(1);

  const events = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'bell' } });
  expect(events).toHaveLength(1);
  expect(events[0].message).toMatch(/manual/i);
});

test('[CF-307] A manual ring past the final bell is refused', async () => {
  const { group, auctionId } = await freshLiveAuction(19);
  expect((await room(group.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  for (let i = 0; i < 3; i++) {
    const res = await room(group.id, auctionId, { action: 'ring' });
    expect(res.status, `ring ${i + 1} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
  }

  const extra = await room(group.id, auctionId, { action: 'ring' });
  expect(String(extra.error ?? '')).toMatch(/final bell already rung/i);
  expect(extra.status, 'API-4: a refused operator action is 400').toBe(400);
});

test('[CF-308] A manual ring into a closed room is refused', async () => {
  const { group, auctionId } = await freshLiveAuction(20);
  const res = await room(group.id, auctionId, { action: 'ring' });
  expect(String(res.error ?? '')).toMatch(/room is not open/i);
  expect(res.status, 'API-4: a refused operator action is 400').toBe(400);
});

test('[CF-304] The final bell auto-closes the room when configured', async () => {
  const g = liveGroup();
  await db().chitGroup.update({ where: { id: g.id }, data: { bellAutoClose: true } });
  const { auctionId } = await freshLiveAuction(2);
  expect((await room(g.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  for (let i = 0; i < 3; i++) {
    expect((await room(g.id, auctionId, { action: 'ring' })).status).toBeLessThan(300);
  }

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.roomStatus).toBe('closed');
  expect(row.winnerMemberId, 'the auto-close still picks no winner').toBeNull();

  const closes = await db().chitAuctionEvent.findMany({ where: { auctionId, type: 'close' } });
  expect(closes[0].message).toMatch(/final bell/i);

  await db().chitGroup.update({ where: { id: g.id }, data: { bellAutoClose: false } });
});

test('[CF-309] Bells are inert when the group has them disabled', async () => {
  const g = liveGroup();
  await db().chitGroup.update({ where: { id: g.id }, data: { bellEnabled: false } });
  const { auctionId } = await freshLiveAuction(3);
  expect((await room(g.id, auctionId, { action: 'open', durationMinutes: 5 })).status).toBeLessThan(300);

  await wait(25_000);
  const polled = await pollUntil(
    () => live(g.id, auctionId),
    (r) => r.status < 300,
    'the live poll to answer',
    20_000,
    2_000,
  );

  expect(polled.data.bell.enabled).toBe(false);
  expect(polled.data.bell.bellsRung).toBe(0);
  expect(polled.data.bell.nextBellAt).toBeNull();
  expect(await db().chitAuctionEvent.count({ where: { auctionId, type: 'bell' } })).toBe(0);

  await db().chitGroup.update({ where: { id: g.id }, data: { bellEnabled: true } });
});

// ── Sealed visibility ───────────────────────────────────────────────────────
test('[CF-325] Sealed bids are hidden while the room is open', async () => {
  const sealed = loadState().tenantA.groups.sealed!;
  await db().chitMember.updateMany({ where: { chitGroupId: sealed.id }, data: { agreementStatus: 'signed' } });
  const activated = await api.post(`/api/v1/chits/${sealed.id}/activate`, {}, asAdmin());
  expect([200, 201, 409], JSON.stringify(activated.raw)).toContain(activated.status);

  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: sealed.id, periodNumber: 1 } });
  await db().chitAuction.update({ where: { id: auction.id }, data: { roomStatus: 'open' } });

  for (const [ticket, discount] of [['1', 8_000], ['2', 12_000]] as const) {
    const res = await api.post(
      `/api/v1/chits/${sealed.id}/auctions/${auction.id}/bids`,
      { memberId: sealed.membersByTicket[ticket], prizeAmount: prizeForDiscount(discount as number) },
      asAdmin(),
    );
    expect(res.status, `${ticket} → ${JSON.stringify(res.raw)}`).toBeLessThan(300);
  }

  const open = await api.get(`/api/v1/chits/${sealed.id}/auctions/${auction.id}/live`, asAdmin());
  expect(open.data.bids, 'a sealed round shows no bids while it is open').toHaveLength(0);
  expect(open.data.highestBid).toBeNull();
});

test('[CF-326] Sealed bids become visible once the room closes', async () => {
  const sealed = loadState().tenantA.groups.sealed!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: sealed.id, periodNumber: 1 } });
  await db().chitAuction.update({ where: { id: auction.id }, data: { roomStatus: 'closed' } });

  const res = await api.get(`/api/v1/chits/${sealed.id}/auctions/${auction.id}/live`, asAdmin());
  expect(res.data.bids.length, 'both sealed bids surface after the close').toBe(2);
  expect(Number(res.data.highestBid.bidDiscount)).toBe(12_000);
});
