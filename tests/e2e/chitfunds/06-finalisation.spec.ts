import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, branchPool, num, type Session } from './support/harness';
import { loadState, patchState, type ChitRunState, type SeededGroup } from './support/state';

/**
 * Winner selection, the auction arithmetic and everything finalisation writes.
 *
 * The reference numbers are worked by hand from CHIT-1's formula so a failure
 * reads as "we owe 710 and paid 715", not as "the snapshot changed":
 *
 *   chitValue 100000, prize 85000, commissionPct 5, BID_DISCOUNT, gst 18%,
 *   20 members, ALL_MEMBERS, dividendRounding 5
 *     bidDiscount   = 100000 − 85000            = 15000
 *     commission    = 15000 × 5%                =   750
 *     gstAmount     =   750 × 18%               =   135
 *     distributable = 15000 − 750               = 14250
 *     dividend      = floor(14250 / 20 / 5) × 5 =   710   (raw 712.5)
 *     roundingIncome= 14250 − 710 × 20          =    50
 */

let owner: Session;
let admin: Session;
let agent: Session;
let s: ChitRunState;

const CHIT_VALUE = 100_000;
const prizeForDiscount = (discount: number) => CHIT_VALUE - discount;

const asAdmin = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

async function bid(g: SeededGroup, auctionId: string, ticket: string, discount: number) {
  return api.post(
    `/api/v1/chits/${g.id}/auctions/${auctionId}/bids`,
    { memberId: g.membersByTicket[ticket], prizeAmount: prizeForDiscount(discount) },
    asAdmin(),
  );
}

async function confirm(g: SeededGroup, auctionId: string, body: Record<string, unknown> = {}) {
  return api.post(`/api/v1/chits/${g.id}/auctions/${auctionId}/confirm`, body, asAdmin());
}

/**
 * A clean, unconfirmed auction on the manual fixture.
 *
 * Winners are demoted too: hasWon is group-wide and a member who won an earlier
 * case would be refused in this one for the wrong reason.
 */
async function freshAuction(period: number, opts: { resetWinners?: boolean } = {}) {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({
    where: { chitGroupId: g.id, periodNumber: period },
  });
  await db().chitBid.deleteMany({ where: { auctionId: auction.id } });
  await db().chitSecurity.deleteMany({ where: { auctionId: auction.id } });
  await db().chitAuction.update({
    where: { id: auction.id },
    data: {
      status: 'pending',
      payoutStatus: 'not_ready',
      winnerMemberId: null,
      prizeAmount: null,
      bidDiscount: null,
      commission: null,
      dividend: null,
      gstAmount: 0,
      roundingIncome: 0,
      minutesText: null,
      confirmedAt: null,
      completedAt: null,
    },
  });
  if (opts.resetWinners !== false) {
    await db().chitMember.updateMany({ where: { chitGroupId: g.id }, data: { hasWon: false, wonAt: null } });
  }
  return { group: g, auctionId: auction.id };
}

/** Put the fixture back on the reference configuration between cases. */
async function setGroupConfig(groupId: string, data: Record<string, unknown>) {
  await db().chitGroup.update({ where: { id: groupId }, data });
}

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agent = await loginApi(s.tenantA.agentHq!.username, s.password);

  await setGroupConfig(loadState().tenantA.groups.manual!.id, {
    commissionPct: 5,
    gstPct: 18,
    dividendRounding: 5,
    dividendPolicy: 'ALL_MEMBERS',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    commissionBasis: 'BID_DISCOUNT',
    tieBreakRule: 'EARLIEST_BID',
    winnerInterestType: 'NONE',
    bidIncrement: null,
    minDiscountPct: null,
  });
});

test.afterAll(async () => {
  await closeDb();
});

// ── Winner selection ────────────────────────────────────────────────────────
test('[CF-350] Confirming an auction selects the highest bid discount', async () => {
  const { group, auctionId } = await freshAuction(1);
  for (const [ticket, discount] of [['1', 8_000], ['2', 12_000], ['3', 10_000]] as const) {
    expect((await bid(group, auctionId, ticket, discount as number)).status).toBeLessThan(300);
  }

  const res = await confirm(group, auctionId);
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const bids = await db().chitBid.findMany({ where: { auctionId } });
  const winning = bids.filter((b) => b.status === 'winning');
  expect(winning, 'exactly one winning bid').toHaveLength(1);
  expect(num(winning[0].bidDiscount)).toBe(12_000);
  expect(bids.filter((b) => b.status === 'valid'), 'the others stay valid').toHaveLength(2);
});

test('[CF-351] A tie is broken by the earliest bid time by default', async () => {
  const { group, auctionId } = await freshAuction(2);
  const first = await bid(group, auctionId, '1', 30_000);
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);
  await new Promise((r) => setTimeout(r, 1_100));
  expect((await bid(group, auctionId, '2', 30_000)).status).toBeLessThan(300);

  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.winnerMemberId, 'the earlier of two identical bids wins').toBe(group.membersByTicket['1']);
});

test('[CF-352] LOTTERY_AMONG_TIED draws the winner from the tied bids', async () => {
  const { group, auctionId } = await freshAuction(3);
  await setGroupConfig(group.id, { tieBreakRule: 'LOTTERY_AMONG_TIED' });

  const tiedTickets = ['1', '2', '3'];
  for (const ticket of tiedTickets) {
    expect((await bid(group, auctionId, ticket, 30_000)).status).toBeLessThan(300);
  }

  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(
    tiedTickets.map((t) => group.membersByTicket[t]),
    'the winner comes from the tied set',
  ).toContain(row.winnerMemberId);
  expect(row.minutesText, 'CHIT-13: the draw evidence is stored on the minutes').toMatch(/seed [0-9a-f]{32}/i);
  expect(row.minutesText).toMatch(/tie at highest discount/i);

  await setGroupConfig(group.id, { tieBreakRule: 'EARLIEST_BID' });
});

test('[CF-353] A tie of one is not sent to the lottery', async () => {
  const { group, auctionId } = await freshAuction(4);
  await setGroupConfig(group.id, { tieBreakRule: 'LOTTERY_AMONG_TIED' });

  expect((await bid(group, auctionId, '1', 12_000)).status).toBeLessThan(300);
  expect((await bid(group, auctionId, '2', 9_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.winnerMemberId).toBe(group.membersByTicket['1']);
  expect(row.minutesText ?? '', 'a clear highest bid needs no draw').not.toMatch(/seed /i);

  await setGroupConfig(group.id, { tieBreakRule: 'EARLIEST_BID' });
});

test('[CF-354] Confirming with no valid bids is refused', async () => {
  const { group, auctionId } = await freshAuction(5);

  const res = await confirm(group, auctionId);
  expect(res.status, JSON.stringify(res.raw)).toBe(400);
  expect(String(res.error ?? '')).toMatch(/at least one valid bid/i);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.winnerMemberId).toBeNull();
  expect(await db().chitSecurity.count({ where: { auctionId } })).toBe(0);
});

test('[CF-355] An explicitly supplied winning bid must be valid', async () => {
  const { group, auctionId } = await freshAuction(6);
  const placed = await bid(group, auctionId, '1', 12_000);
  expect(placed.status).toBeLessThan(300);
  await db().chitBid.update({ where: { id: placed.data.id }, data: { status: 'retracted' } });

  const res = await confirm(group, auctionId, { winningBidId: placed.data.id });
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/winning bid must be valid/i);
});

test('[CF-356] A member who already won cannot be confirmed again', async () => {
  const { group, auctionId } = await freshAuction(7);
  const placed = await bid(group, auctionId, '1', 12_000);
  expect(placed.status).toBeLessThan(300);
  await db().chitMember.update({ where: { id: group.membersByTicket['1'] }, data: { hasWon: true } });

  const res = await confirm(group, auctionId, { winningBidId: placed.data.id });
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/already won/i);

  await db().chitMember.update({ where: { id: group.membersByTicket['1'] }, data: { hasWon: false } });
});

test('[CF-365] Only an admin or above can confirm', async () => {
  const { group, auctionId } = await freshAuction(8);
  expect((await bid(group, auctionId, '1', 12_000)).status).toBeLessThan(300);

  const res = await api.post(
    `/api/v1/chits/${group.id}/auctions/${auctionId}/confirm`,
    {},
    { token: agent.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq },
  );
  expect(res.status).toBe(403);
  expect((await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).winnerMemberId).toBeNull();
});

// ── What finalisation writes ────────────────────────────────────────────────
test('[CF-358] Finalisation writes every side effect in one transaction', async () => {
  const { group, auctionId } = await freshAuction(9);
  await api.post(
    `/api/v1/chits/${group.id}/auctions/${auctionId}/attendance`,
    { memberId: group.membersByTicket['1'], status: 'present' },
    asAdmin(),
  );
  expect((await bid(group, auctionId, '1', 15_000)).status).toBeLessThan(300);

  const res = await confirm(group, auctionId);
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.status).toBe('confirmed');
  expect(row.payoutStatus, 'CHIT-15: finalisation stops at the security gate').toBe('security_pending');
  expect(row.confirmedAt).toBeTruthy();
  expect(row.completedAt).toBeTruthy();

  const member = await db().chitMember.findUniqueOrThrow({ where: { id: group.membersByTicket['1'] } });
  expect(member.hasWon).toBe(true);
  expect(member.wonAt).toBeTruthy();

  expect(await db().chitBid.count({ where: { auctionId, status: 'winning' } })).toBe(1);
  expect(await db().chitAuctionEvent.count({ where: { auctionId, type: 'winner' } })).toBe(1);

  const security = await db().chitSecurity.findFirstOrThrow({ where: { auctionId } });
  expect(security.status, 'a pending security row is created by the same transaction').toBe('pending');
  expect(security.winnerMemberId).toBe(group.membersByTicket['1']);

  // createChitAudit writes into the shared AuditLog table, not a chit-only one.
  const audits = await db().auditLog.findMany({
    where: { tenantId: s.tenantA.id, entityType: 'chit_auction', entityId: auctionId, action: 'confirm_auction' },
  });
  expect(audits, 'CHIT-30: the state change is audited').toHaveLength(1);
  expect(String(audits[0].newValue ?? ''), 'the audit carries the calculation it committed').toMatch(/"calc"/);

  patchState((state) => {
    state.tenantA.auctions.confirmed = auctionId;
  });
});

test('[CF-360] Finalisation never pays the prize', async () => {
  const auctionId = loadState().tenantA.auctions.confirmed;
  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });

  expect(row.payoutStatus).not.toBe('paid');
  expect(row.payoutStatus).not.toBe('ready');
  expect(
    await db().accountEntry.count({ where: { referenceId: auctionId, type: 'chit_payout' } }),
    'CHIT-15: no payout entry exists before the security gate',
  ).toBe(0);
  expect(await db().chitReceipt.count({ where: { entityId: auctionId, receiptType: 'payout' } })).toBe(0);
});

test('[CF-357] Confirming twice is refused', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.confirmed;
  const securityBefore = await db().chitSecurity.count({ where: { auctionId } });

  const res = await confirm(g, auctionId);
  expect(res.status).toBe(409);
  expect(String(res.error ?? '')).toMatch(/already confirmed/i);
  expect(await db().chitSecurity.count({ where: { auctionId } }), 'no second security row').toBe(securityBefore);
});

test('[CF-363] Auction minutes are generated and persisted on every finalisation', async () => {
  const auctionId = loadState().tenantA.auctions.confirmed;
  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });

  const minutes = row.minutesText ?? '';
  expect(minutes, 'CHIT-16').toMatch(/period 9/i);
  expect(minutes).toMatch(/out of 20 subscribers were marked present\/proxy/i);
  expect(minutes).toMatch(/prize amount: 85000/i);
  expect(minutes).toMatch(/bid discount: 15000/i);
  expect(minutes).toMatch(/foreman commission: 750/i);
  expect(minutes).toMatch(/dividend per eligible subscriber: 710/i);
});

test('[CF-192] Present count in the minutes matches the attendance rows', async () => {
  const auctionId = loadState().tenantA.auctions.confirmed;
  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  const present = await db().chitAuctionAttendance.count({
    where: { auctionId, status: { in: ['present', 'proxy'] } },
  });
  expect(row.minutesText ?? '').toContain(`${present} out of 20 subscribers`);
});

test('[CF-364] Operator-supplied minutes are kept alongside the draw evidence', async () => {
  const { group, auctionId } = await freshAuction(10);
  await setGroupConfig(group.id, { tieBreakRule: 'LOTTERY_AMONG_TIED' });
  for (const ticket of ['1', '2']) {
    expect((await bid(group, auctionId, ticket, 30_000)).status).toBeLessThan(300);
  }

  const res = await confirm(group, auctionId, { minutesText: 'Conducted at the Erode branch office.' });
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(row.minutesText).toContain('Conducted at the Erode branch office.');
  expect(row.minutesText, 'the draw evidence is kept too').toMatch(/seed [0-9a-f]{32}/i);

  await setGroupConfig(group.id, { tieBreakRule: 'EARLIEST_BID' });
});

// ── The arithmetic ──────────────────────────────────────────────────────────
test('[CF-380] [CF-381] [CF-383] [CF-384] The reference auction computes the worked figures', async () => {
  const auctionId = loadState().tenantA.auctions.confirmed;
  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });

  expect(num(row.prizeAmount)).toBe(85_000);
  expect(num(row.bidDiscount), 'chitValue − prizeAmount').toBe(15_000);
  expect(num(row.commission), '5% of the 15000 discount').toBe(750);
  expect(num(row.gstAmount), 'GST is charged on the commission, not the discount').toBe(135);
});

test('[CF-389] [CF-390] Dividend rounds down and the remainder becomes foreman income', async () => {
  const auctionId = loadState().tenantA.auctions.confirmed;
  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });

  expect(num(row.dividend), 'raw 712.5 rounds DOWN to the 5-rupee increment').toBe(710);
  expect(num(row.roundingIncome), 'CHIT-3: 14250 − 710 × 20 is income, not a lost rupee').toBe(50);
});

test('[CF-391] Dividend × eligible + rounding income equals the distributable', async () => {
  const auctionId = loadState().tenantA.auctions.confirmed;
  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });

  const distributable = num(row.bidDiscount) - num(row.commission);
  expect(num(row.dividend) * 20 + num(row.roundingIncome), 'the identity holds').toBe(distributable);
});

test('[CF-387] NON_WINNERS_ONLY excludes the winner from the divisor', async () => {
  const { group, auctionId } = await freshAuction(11);
  await setGroupConfig(group.id, { dividendPolicy: 'NON_WINNERS_ONLY' });
  expect((await bid(group, auctionId, '1', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(num(row.dividend), '14250 over 19 eligible tickets divides exactly').toBe(750);
  expect(num(row.roundingIncome), 'and leaves no remainder').toBe(0);

  await setGroupConfig(group.id, { dividendPolicy: 'ALL_MEMBERS' });
});

test('[CF-382] Commission on CHIT_VALUE basis', async () => {
  const { group, auctionId } = await freshAuction(12);
  await setGroupConfig(group.id, { commissionBasis: 'CHIT_VALUE' });
  expect((await bid(group, auctionId, '1', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(num(row.commission), '5% of the 100000 chit value').toBe(5_000);
  expect(num(row.dividend) * 20 + num(row.roundingIncome), 'distributable falls to 10000').toBe(10_000);

  await setGroupConfig(group.id, { commissionBasis: 'BID_DISCOUNT' });
});

test('[CF-385] Commission larger than the discount clamps the dividend to zero', async () => {
  const { group, auctionId } = await freshAuction(13);
  await setGroupConfig(group.id, { commissionBasis: 'CHIT_VALUE', minDiscountPct: 0, bidStartAtCommission: false });
  expect((await bid(group, auctionId, '1', 1_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(num(row.commission)).toBe(5_000);
  expect(num(row.dividend), 'never negative').toBe(0);
  expect(num(row.roundingIncome)).toBe(0);

  await setGroupConfig(group.id, {
    commissionBasis: 'BID_DISCOUNT', minDiscountPct: null, bidStartAtCommission: true,
  });
});

test('[CF-393] A fractional ticket receives a proportional dividend', async () => {
  const state = loadState();
  const half = state.tenantA.groups.halfTicket!;
  const members = await db().chitMember.findMany({ where: { chitGroupId: half.id }, orderBy: { memberNumber: 'asc' } });
  const halfMember = members.find((m) => num(m.ticketShare) === 0.5);
  const wholeMember = members.find((m) => num(m.ticketShare) === 1);
  expect(halfMember, 'the half-ticket fixture must exist').toBeTruthy();

  await db().chitGroup.update({
    where: { id: half.id },
    data: { dividendDistribution: 'ACCUMULATE', dividendRounding: 0, commissionPct: 5, gstPct: null },
  });
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: half.id, periodNumber: 1 } });

  const placed = await api.post(
    `/api/v1/chits/${half.id}/auctions/${auction.id}/bids`,
    { memberId: wholeMember!.id, prizeAmount: 36_000 },
    asAdmin(),
  );
  expect(placed.status, JSON.stringify(placed.raw)).toBeLessThan(300);
  const confirmed = await api.post(`/api/v1/chits/${half.id}/auctions/${auction.id}/confirm`, {}, asAdmin());
  expect(confirmed.status, JSON.stringify(confirmed.raw)).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  const perTicket = num(row.dividend);
  expect(perTicket).toBeGreaterThan(0);

  const halfSub = await db().chitSubscription.findFirstOrThrow({
    where: { memberId: halfMember!.id, periodNumber: 1 },
  });
  const wholeSub = await db().chitSubscription.findFirstOrThrow({
    where: { memberId: wholeMember!.id, periodNumber: 1 },
  });
  expect(num(halfSub.dividendAmount), 'CHIT-4: half a ticket earns half the dividend').toBe(perTicket / 2);
  expect(num(wholeSub.dividendAmount)).toBe(perTicket);
});

// ── Dividend distribution ───────────────────────────────────────────────────
test('[CF-415] ADJUST_NEXT_DUE credits the following period only', async () => {
  const { group, auctionId } = await freshAuction(14);
  await setGroupConfig(group.id, { dividendDistribution: 'ADJUST_NEXT_DUE' });

  const before = await db().chitSubscription.findMany({
    where: { member: { chitGroupId: group.id }, periodNumber: { in: [14, 15, 16] } },
    select: { periodNumber: true, memberId: true, dueAmount: true, dividendAmount: true },
  });

  expect((await bid(group, auctionId, '1', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const after = await db().chitSubscription.findMany({
    where: { member: { chitGroupId: group.id }, periodNumber: { in: [14, 15, 16] } },
    select: { periodNumber: true, memberId: true, dueAmount: true, dividendAmount: true },
  });
  const key = (r: { periodNumber: number; memberId: string }) => `${r.periodNumber}:${r.memberId}`;
  const beforeBy = new Map(before.map((r) => [key(r), r]));

  for (const row of after) {
    const prior = beforeBy.get(key(row))!;
    const dividendDelta = num(row.dividendAmount) - num(prior.dividendAmount);
    const dueDelta = num(row.dueAmount) - num(prior.dueAmount);
    if (row.periodNumber === 15) {
      expect(dividendDelta, 'the NEXT period is credited').toBe(710);
      expect(dueDelta, 'and its due falls by the same amount').toBe(-710);
    } else {
      expect(dividendDelta, `period ${row.periodNumber} is untouched`).toBe(0);
      expect(dueDelta, `period ${row.periodNumber} is untouched`).toBe(0);
    }
  }
});

test('[CF-416] ADJUST_NEXT_DUE never reduces an already-paid due', async () => {
  const { group, auctionId } = await freshAuction(16);
  await setGroupConfig(group.id, { dividendDistribution: 'ADJUST_NEXT_DUE' });

  const settled = group.membersByTicket['5'];
  await db().chitSubscription.updateMany({
    where: { memberId: settled, periodNumber: 17 },
    data: { status: 'paid' },
  });
  const beforePaid = await db().chitSubscription.findFirstOrThrow({
    where: { memberId: settled, periodNumber: 17 },
  });

  expect((await bid(group, auctionId, '1', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const afterPaid = await db().chitSubscription.findFirstOrThrow({
    where: { memberId: settled, periodNumber: 17 },
  });
  expect(num(afterPaid.dueAmount), 'CHIT-19: a settled due is never reduced').toBe(num(beforePaid.dueAmount));

  const other = await db().chitSubscription.findFirstOrThrow({
    where: { memberId: group.membersByTicket['6'], periodNumber: 17 },
  });
  expect(num(other.dividendAmount), 'unpaid members are still credited').toBeGreaterThan(0);
});

test('[CF-418] ADJUST_NEXT_DUE moves no cash', async () => {
  const { group, auctionId } = await freshAuction(18);
  await setGroupConfig(group.id, { dividendDistribution: 'ADJUST_NEXT_DUE' });

  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);
  const receiptsBefore = await db().chitReceipt.count({ where: { tenantId: s.tenantA.id } });

  expect((await bid(group, auctionId, '1', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'CHIT-20: no cash moves').toBe(poolBefore);
  expect(await db().chitReceipt.count({ where: { tenantId: s.tenantA.id } })).toBe(receiptsBefore);
});

test('[CF-419] ACCUMULATE records the accrual on the auction period', async () => {
  const { group, auctionId } = await freshAuction(19);
  await setGroupConfig(group.id, { dividendDistribution: 'ACCUMULATE' });

  const before = await db().chitSubscription.findFirstOrThrow({
    where: { memberId: group.membersByTicket['6'], periodNumber: 19 },
  });
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  expect((await bid(group, auctionId, '1', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const after = await db().chitSubscription.findFirstOrThrow({
    where: { memberId: group.membersByTicket['6'], periodNumber: 19 },
  });
  expect(num(after.dividendAmount) - num(before.dividendAmount), 'the accrual lands on the auction period').toBe(710);
  expect(num(after.dueAmount), 'the due is unchanged').toBe(num(before.dueAmount));
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'no cash moves').toBe(poolBefore);

  await setGroupConfig(group.id, { dividendDistribution: 'ADJUST_NEXT_DUE' });
});

test('[CF-422] A zero dividend distributes nothing at all', async () => {
  const { group, auctionId } = await freshAuction(20);
  await setGroupConfig(group.id, {
    commissionBasis: 'CHIT_VALUE', minDiscountPct: 0, bidStartAtCommission: false, dividendDistribution: 'CASH_PAYOUT',
  });

  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);
  const receiptsBefore = await db().chitReceipt.count({ where: { tenantId: s.tenantA.id } });

  expect((await bid(group, auctionId, '1', 1_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  expect(await db().chitReceipt.count({ where: { tenantId: s.tenantA.id } }), 'no receipt for a zero dividend').toBe(receiptsBefore);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!)).toBe(poolBefore);

  await setGroupConfig(group.id, {
    commissionBasis: 'BID_DISCOUNT', minDiscountPct: null, bidStartAtCommission: true,
    dividendDistribution: 'ADJUST_NEXT_DUE',
  });
});

// ── Winner interest ─────────────────────────────────────────────────────────
test('[CF-440] [CF-442] [CF-443] FIXED winner interest charges the periods after the win', async () => {
  const { group, auctionId } = await freshAuction(5);
  await setGroupConfig(group.id, {
    winnerInterestType: 'FIXED', winnerInterestValue: 500, winnerInterestPeriods: 3,
    dividendDistribution: 'ACCUMULATE',
  });

  const winner = group.membersByTicket['2'];
  const before = await db().chitSubscription.findMany({
    where: { memberId: winner, periodNumber: { in: [5, 6, 7, 8, 9] } },
    select: { periodNumber: true, dueAmount: true, interestAmount: true },
  });

  expect((await bid(group, auctionId, '2', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const after = await db().chitSubscription.findMany({
    where: { memberId: winner, periodNumber: { in: [5, 6, 7, 8, 9] } },
    select: { periodNumber: true, dueAmount: true, interestAmount: true },
  });
  const beforeBy = new Map(before.map((r) => [r.periodNumber, r]));

  for (const row of after) {
    const prior = beforeBy.get(row.periodNumber)!;
    const interestDelta = num(row.interestAmount) - num(prior.interestAmount);
    const dueDelta = num(row.dueAmount) - num(prior.dueAmount);
    const inWindow = [6, 7, 8].includes(row.periodNumber);

    expect(interestDelta, `period ${row.periodNumber} interest`).toBe(inWindow ? 500 : 0);
    expect(dueDelta, `CHIT-22: period ${row.periodNumber} due moves with the interest`).toBe(inWindow ? 500 : 0);
  }
  expect(beforeBy.get(5), 'CHIT-21: the period they won in is never charged').toBeTruthy();

  await setGroupConfig(group.id, {
    winnerInterestType: 'NONE', winnerInterestValue: null, winnerInterestPeriods: null,
    dividendDistribution: 'ADJUST_NEXT_DUE',
  });
});

test('[CF-444] The winner-interest window is clamped to the last period', async () => {
  const { group, auctionId } = await freshAuction(19);
  await setGroupConfig(group.id, {
    winnerInterestType: 'PERCENT', winnerInterestValue: 1, winnerInterestPeriods: 3,
    dividendDistribution: 'ACCUMULATE',
  });

  const winner = group.membersByTicket['3'];
  const before = await db().chitSubscription.findMany({
    where: { memberId: winner, periodNumber: { in: [19, 20] } },
    select: { periodNumber: true, interestAmount: true },
  });

  expect((await bid(group, auctionId, '3', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const after = await db().chitSubscription.findMany({
    where: { memberId: winner, periodNumber: { in: [19, 20] } },
    select: { periodNumber: true, interestAmount: true },
  });
  const beforeBy = new Map(before.map((r) => [r.periodNumber, r]));

  const p20 = after.find((r) => r.periodNumber === 20)!;
  expect(num(p20.interestAmount) - num(beforeBy.get(20)!.interestAmount), '1% of 100000').toBe(1_000);

  const p19 = after.find((r) => r.periodNumber === 19)!;
  expect(num(p19.interestAmount) - num(beforeBy.get(19)!.interestAmount), 'the won period is untouched').toBe(0);

  expect(
    await db().chitSubscription.count({ where: { memberId: winner, periodNumber: { gt: 20 } } }),
    'no period 21 or 22 is invented',
  ).toBe(0);

  await setGroupConfig(group.id, {
    winnerInterestType: 'NONE', winnerInterestValue: null, winnerInterestPeriods: null,
    dividendDistribution: 'ADJUST_NEXT_DUE',
  });
});

test('[CF-449] Winner interest applies only to the winner', async () => {
  const { group, auctionId } = await freshAuction(13);
  await setGroupConfig(group.id, {
    winnerInterestType: 'FIXED', winnerInterestValue: 500, winnerInterestPeriods: 2,
    dividendDistribution: 'ACCUMULATE',
  });

  const others = [group.membersByTicket['7'], group.membersByTicket['8']];
  const before = await db().chitSubscription.findMany({
    where: { memberId: { in: others }, periodNumber: { in: [14, 15] } },
    select: { id: true, interestAmount: true },
  });

  expect((await bid(group, auctionId, '4', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const after = await db().chitSubscription.findMany({
    where: { id: { in: before.map((r) => r.id) } },
    select: { id: true, interestAmount: true },
  });
  const beforeBy = new Map(before.map((r) => [r.id, r]));
  for (const row of after) {
    expect(num(row.interestAmount), 'only the winner is charged').toBe(num(beforeBy.get(row.id)!.interestAmount));
  }

  await setGroupConfig(group.id, {
    winnerInterestType: 'NONE', winnerInterestValue: null, winnerInterestPeriods: null,
    dividendDistribution: 'ADJUST_NEXT_DUE',
  });
});

test('[CF-447] NONE applies nothing', async () => {
  const { group, auctionId } = await freshAuction(12);
  await setGroupConfig(group.id, { winnerInterestType: 'NONE', dividendDistribution: 'ACCUMULATE' });

  const winner = group.membersByTicket['9'];
  const before = await db().chitSubscription.findMany({
    where: { memberId: winner },
    select: { id: true, interestAmount: true },
  });

  expect((await bid(group, auctionId, '9', 15_000)).status).toBeLessThan(300);
  expect((await confirm(group, auctionId)).status).toBeLessThan(300);

  const after = await db().chitSubscription.findMany({
    where: { memberId: winner },
    select: { id: true, interestAmount: true },
  });
  const beforeBy = new Map(before.map((r) => [r.id, r]));
  for (const row of after) {
    expect(num(row.interestAmount)).toBe(num(beforeBy.get(row.id)!.interestAmount));
  }

  await setGroupConfig(group.id, { dividendDistribution: 'ADJUST_NEXT_DUE' });
});

// ── Summary ─────────────────────────────────────────────────────────────────
test('[CF-366] The winner summary is unavailable before confirmation', async () => {
  const { group, auctionId } = await freshAuction(17);
  const res = await api.get(`/api/v1/chits/${group.id}/auctions/${auctionId}/summary`, asAdmin());
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/not confirmed yet/i);
});

test('[CF-367] The winner summary matches the stored calculation', async () => {
  const state = loadState();
  const auctionId = state.tenantA.auctions.confirmed;
  const res = await api.get(
    `/api/v1/chits/${state.tenantA.groups.manual!.id}/auctions/${auctionId}/summary`,
    asAdmin(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const row = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  const payload = JSON.stringify(res.data);
  for (const value of [num(row.prizeAmount), num(row.bidDiscount), num(row.commission), num(row.dividend)]) {
    expect(payload, `the summary reports ${value} exactly as stored`).toContain(String(value));
  }
});
