import assert from 'node:assert/strict';
import { disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';
import { cleanupRunData } from './helpers/cleanup';
import { borrowerLoginAndVerify, issueMobileTokenForSetup } from './helpers/authTokens';
import { expectError, expectOk, routeRequest, routes, type Envelope } from './helpers/apiClient';
import { run, test } from './helpers/harness';
import { writeKnownGapEvidence } from './helpers/evidenceWriter';
import { createCustomerFixture, seedZoloFundScenario, type ZoloFundScenario } from './helpers/seedZoloFund';

// Customer self-service live chit auction (join → admit/deny → bid), the
// feature behind the mobile "Join Live Auction" button. Exercises the new
// app/api/v1/borrower/chits/[id]/auctions/[auctionId]/{live,join,bids,messages}
// routes and the staff app/api/v1/chits/[id]/auctions/[auctionId]/admission
// route, all in-process against a real MySQL test database — no dev server,
// no APK build required.

const CHIT_APP = 'chitfunds';
const runId = getRunId();
const prisma = getPrisma();

let scenario: ZoloFundScenario;
let adminToken = '';

type StaffApiOptions = {
  importPath: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
  path: string;
  token?: string;
  params?: Record<string, string>;
  body?: unknown;
};

function staffApi<T>(options: StaffApiOptions) {
  return routeRequest<Envelope<T>>({
    method: options.method ?? 'POST',
    importPath: options.importPath,
    path: options.path,
    token: options.token ?? adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: CHIT_APP,
    params: options.params,
    body: options.body,
  });
}

type BorrowerApiOptions = {
  importPath: string;
  method?: 'GET' | 'POST';
  path: string;
  token: string;
  body?: unknown;
  params: Record<string, string>;
};

function borrowerApi<T>(options: BorrowerApiOptions) {
  return routeRequest<Envelope<T>>({
    method: options.method ?? 'GET',
    importPath: options.importPath,
    path: options.path,
    token: options.token,
    tenantSlug: scenario.tenantA.slug,
    appType: 'borrower',
    params: options.params,
    body: options.body,
  });
}

async function enableChitfundsForTenantA() {
  const enabledModules = JSON.stringify(['microlending', CHIT_APP]);
  await prisma.tenantSubscription.updateMany({
    where: { tenantId: scenario.tenantA.id },
    data: { enabledModules },
  });
  await prisma.branch.updateMany({
    where: { tenantId: scenario.tenantA.id },
    data: { enabledModules },
  });
  await prisma.branchCashAccount.upsert({
    where: { tenantId_appType_branchId: { tenantId: scenario.tenantA.id, appType: CHIT_APP, branchId: scenario.branchA1.id } },
    create: { tenantId: scenario.tenantA.id, appType: CHIT_APP, branchId: scenario.branchA1.id, balance: 1_000_000 },
    update: { balance: 1_000_000 },
  });
}

async function createChitCustomers(prefix: string, count: number, offsetStart: number) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(await createCustomerFixture(scenario, {
      key: `${prefix}-${i + 1}`,
      phoneOffset: offsetStart + i,
      status: 'active',
      appType: CHIT_APP,
      tenantId: scenario.tenantA.id,
      branchId: scenario.branchA1.id,
      routeId: scenario.routeA1.id,
      agentId: scenario.users.agentA1.id,
    }));
  }
  return rows;
}

async function createOpenLiveGroup(key: string, offsetStart: number, memberCount = 3) {
  const customers = await createChitCustomers(key, memberCount, offsetStart);
  const created = expectOk<{ id: string }>(await staffApi({
    importPath: routes.chits,
    path: '/api/v1/chits',
    body: {
      name: `${runId}-${key}`,
      chitValue: 90_000,
      monthlyContrib: 30_000,
      totalMembers: memberCount,
      durationMonths: memberCount,
      commissionPct: 5,
      startDate: '2026-01-01',
      memberIds: customers.map((c) => c.id),
      auctionType: 'open_live',
    },
  }), `${key} group create`);
  const groupId = created.id;

  const members = expectOk<Array<{ id: string; memberNumber: number; customerId: string }>>(await staffApi({
    importPath: routes.chitMembers,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/members`,
    params: { id: groupId },
  }));
  for (const member of members) {
    await staffApi({
      importPath: routes.chitMemberAgreement,
      path: `/api/v1/chits/${groupId}/members/${member.id}/agreement`,
      params: { id: groupId, memberId: member.id },
      body: { status: 'verified' },
    });
  }
  await staffApi({
    importPath: routes.chitActivate,
    path: `/api/v1/chits/${groupId}/activate`,
    params: { id: groupId },
  });

  const auctions = expectOk<Array<{ id: string; periodNumber: number }>>(await staffApi({
    importPath: routes.chitAuctions,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/auctions`,
    params: { id: groupId },
  }));
  const auction = auctions.find((a) => a.periodNumber === 1) ?? auctions[0]!;

  const byCustomerId = new Map(members.map((m) => [m.customerId, m]));
  const memberFixtures = customers.map((c) => ({ customer: c, member: byCustomerId.get(c.id)! }));

  return { groupId, auctionId: auction.id, members: memberFixtures };
}

async function openRoom(groupId: string, auctionId: string) {
  const opened = expectOk<{ roomStatus: string }>(await staffApi({
    importPath: routes.chitAuctionRoom,
    path: `/api/v1/chits/${groupId}/auctions/${auctionId}/room`,
    params: { id: groupId, auctionId },
    body: { action: 'open', durationMinutes: 5, autoExtendSeconds: 60 },
  }), 'open live room');
  assert.equal(opened.roomStatus, 'open');
}

async function loginAs(customer: { phone: string }) {
  const session = await borrowerLoginAndVerify({ phone: customer.phone, tenantSlug: scenario.tenantA.slug });
  return session.token as string;
}

test('CUSTBID-001 customer joins an auto-admission room and is admitted immediately', async () => {
  const { groupId, auctionId, members } = await createOpenLiveGroup('auto', 2100);
  await openRoom(groupId, auctionId);
  const tokenA = await loginAs(members[0]!.customer);

  const join = expectOk<{ admissionStatus: string }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenA,
  }), 'auto-admission join');
  assert.equal(join.admissionStatus, 'admitted');

  const live = expectOk<{ myMembership: { admissionStatus: string; memberId: string }; isRoomOpen: boolean }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionLive,
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/live`,
    params: { id: groupId, auctionId },
    token: tokenA,
  }));
  assert.equal(live.myMembership.admissionStatus, 'admitted');
  assert.equal(live.myMembership.memberId, members[0]!.member.id);
  assert.equal(live.isRoomOpen, true);
});

test('CUSTBID-002 tap bid persists, idempotency key replays instead of duplicating, and memberId cannot be spoofed', async () => {
  const { groupId, auctionId, members } = await createOpenLiveGroup('tapbid', 2110);
  await openRoom(groupId, auctionId);
  const tokenA = await loginAs(members[0]!.customer);
  await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenA,
  });

  const idempotencyKey = `${runId}-custbid-1`;
  const first = expectOk<{ id: string; memberId: string; bidDiscount: unknown }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionBids,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/bids`,
    params: { id: groupId, auctionId },
    token: tokenA,
    // memberId is deliberately spoofed to another member — the route must
    // ignore it and resolve the caller's own membership server-side.
    body: { prizeAmount: 85_000, idempotencyKey, memberId: members[1]!.member.id },
  }), 'first customer bid');
  assert.equal(first.memberId, members[0]!.member.id, 'bid must be attributed to the caller, not the spoofed memberId');
  assert.equal(Number(first.bidDiscount), 5_000);

  const retry = expectOk<{ id: string }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionBids,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/bids`,
    params: { id: groupId, auctionId },
    token: tokenA,
    body: { prizeAmount: 85_000, idempotencyKey },
  }), 'retried customer bid');
  assert.equal(retry.id, first.id, 'retry with the same idempotency key returns the original bid');
  assert.equal(
    await prisma.chitBid.count({ where: { auctionId, idempotencyKey } }),
    1,
    'idempotency key never creates a duplicate bid',
  );
});

test('CUSTBID-003 customers cannot see or bid for each other; a non-member gets 404', async () => {
  const { groupId, auctionId, members } = await createOpenLiveGroup('isolation', 2120);
  await openRoom(groupId, auctionId);
  const tokenA = await loginAs(members[0]!.customer);
  const tokenB = await loginAs(members[1]!.customer);
  await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenA,
  });
  await borrowerApi({
    importPath: routes.borrowerChitAuctionBids,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/bids`,
    params: { id: groupId, auctionId },
    token: tokenA,
    body: { prizeAmount: 85_000, idempotencyKey: `${runId}-iso-a` },
  });

  // B never joined and never bid — B's own view must show B's own (empty) state.
  const liveB = expectOk<{ myMembership: { memberId: string; admissionStatus: string }; myBids: unknown[] }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionLive,
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/live`,
    params: { id: groupId, auctionId },
    token: tokenB,
  }));
  assert.equal(liveB.myMembership.memberId, members[1]!.member.id);
  assert.equal(liveB.myMembership.admissionStatus, 'not_joined');
  assert.equal(liveB.myBids.length, 0, "B must not see A's bids under myBids");

  // A non-member customer (not enrolled in this group at all) gets a plain
  // 404, not a 403 that would confirm the auction/group exists.
  const [outsider] = await createChitCustomers('outsider', 1, 2199);
  const tokenOutsider = await loginAs(outsider);
  const outsiderLive = await borrowerApi({
    importPath: routes.borrowerChitAuctionLive,
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/live`,
    params: { id: groupId, auctionId },
    token: tokenOutsider,
  });
  expectError(outsiderLive, [404], 'non-member live poll');
  const outsiderJoin = await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenOutsider,
  });
  expectError(outsiderJoin, [404], 'non-member join');
});

test('CUSTBID-004 approval-gated room: waiting → staff admit → bid allowed; deny blocks bidding', async () => {
  const { groupId, auctionId, members } = await createOpenLiveGroup('approval', 2130);
  await prisma.chitGroup.update({ where: { id: groupId }, data: { roomAdmission: 'approval' } });
  await openRoom(groupId, auctionId);

  const tokenA = await loginAs(members[0]!.customer);
  const joinA = expectOk<{ admissionStatus: string }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenA,
  }), 'A joins approval-gated room');
  assert.equal(joinA.admissionStatus, 'waiting');

  // Staff sees A in the waiting list (the field added to the staff live route).
  const staffLive = expectOk<{ waiting: Array<{ memberId: string }> }>(await staffApi({
    importPath: routes.chitAuctionLive,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/auctions/${auctionId}/live`,
    params: { id: groupId, auctionId },
  }));
  assert.equal(staffLive.waiting.some((w) => w.memberId === members[0]!.member.id), true);

  // Bidding while waiting is rejected.
  const blockedBid = await borrowerApi({
    importPath: routes.borrowerChitAuctionBids,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/bids`,
    params: { id: groupId, auctionId },
    token: tokenA,
    body: { prizeAmount: 85_000, idempotencyKey: `${runId}-approval-blocked` },
  });
  expectError(blockedBid, [403], 'bid before admission');

  // Staff admits A.
  await staffApi({
    importPath: routes.chitAuctionAdmission,
    path: `/api/v1/chits/${groupId}/auctions/${auctionId}/admission`,
    params: { id: groupId, auctionId },
    body: { memberId: members[0]!.member.id, decision: 'admit' },
  });
  const liveAfterAdmit = expectOk<{ myMembership: { admissionStatus: string } }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionLive,
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/live`,
    params: { id: groupId, auctionId },
    token: tokenA,
  }));
  assert.equal(liveAfterAdmit.myMembership.admissionStatus, 'admitted');

  const allowedBid = expectOk<{ id: string }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionBids,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/bids`,
    params: { id: groupId, auctionId },
    token: tokenA,
    body: { prizeAmount: 85_000, idempotencyKey: `${runId}-approval-allowed` },
  }), 'bid after admission');
  assert.ok(allowedBid.id);

  // Second member: staff denies instead. Bidding stays blocked, and a repeat
  // join tap must not silently re-open the denial (staff decision sticks).
  const tokenB = await loginAs(members[1]!.customer);
  await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenB,
  });
  await staffApi({
    importPath: routes.chitAuctionAdmission,
    path: `/api/v1/chits/${groupId}/auctions/${auctionId}/admission`,
    params: { id: groupId, auctionId },
    body: { memberId: members[1]!.member.id, decision: 'deny' },
  });
  await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenB,
  });
  const liveB = expectOk<{ myMembership: { admissionStatus: string } }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionLive,
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/live`,
    params: { id: groupId, auctionId },
    token: tokenB,
  }));
  assert.equal(liveB.myMembership.admissionStatus, 'denied', 're-tapping Join must not override a staff denial');
  const deniedBid = await borrowerApi({
    importPath: routes.borrowerChitAuctionBids,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/bids`,
    params: { id: groupId, auctionId },
    token: tokenB,
    body: { prizeAmount: 84_000, idempotencyKey: `${runId}-approval-denied` },
  });
  expectError(deniedBid, [403], 'bid after denial');
});

test('CUSTBID-005 organizer chat is shared between customer and staff routes', async () => {
  const { groupId, auctionId, members } = await createOpenLiveGroup('chat', 2140);
  await openRoom(groupId, auctionId);
  const tokenA = await loginAs(members[0]!.customer);
  await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenA,
  });

  const sent = expectOk<{ id: string; senderName: string; visibility: string }>(await borrowerApi({
    importPath: routes.borrowerChitAuctionMessages,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/messages`,
    params: { id: groupId, auctionId },
    token: tokenA,
    body: { body: `${runId} can you clarify the discount cap?` },
  }), 'customer sends message');
  assert.equal(sent.visibility, 'public');

  const staffView = expectOk<Array<{ id: string; body: string }>>(await staffApi({
    importPath: routes.chitAuctionMessages,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/auctions/${auctionId}/messages`,
    params: { id: groupId, auctionId },
  }));
  assert.equal(staffView.some((m) => m.id === sent.id), true, 'staff route must see the customer message');
});

test('CUSTBID-006 a member who already won cannot re-join', async () => {
  const { groupId, auctionId, members } = await createOpenLiveGroup('won', 2150);
  await openRoom(groupId, auctionId);
  await prisma.chitMember.update({ where: { id: members[0]!.member.id }, data: { hasWon: true } });
  const tokenA = await loginAs(members[0]!.customer);

  const join = await borrowerApi({
    importPath: routes.borrowerChitAuctionJoin,
    method: 'POST',
    path: `/api/v1/borrower/chits/${groupId}/auctions/${auctionId}/join`,
    params: { id: groupId, auctionId },
    token: tokenA,
  });
  expectError(join, [400], 'already-won member cannot join');
});

async function main() {
  try {
    scenario = await seedZoloFundScenario(runId);
    await enableChitfundsForTenantA();
    adminToken = await issueMobileTokenForSetup({ ...scenario.users.adminA1, appType: CHIT_APP });
    const summary = await run();
    await writeKnownGapEvidence(runId, summary, 'tests/e2e-business/chitCustomerLiveBidding.test.ts');
  } finally {
    await cleanupRunData(runId);
    await disconnectTestDb();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  await disconnectTestDb();
});
