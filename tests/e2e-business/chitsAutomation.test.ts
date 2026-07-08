import assert from 'node:assert/strict';
import { disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';
import { cleanupRunData } from './helpers/cleanup';
import { issueMobileTokenForSetup } from './helpers/authTokens';
import { expectError, expectOk, routeRequest, routes, type Envelope } from './helpers/apiClient';
import { assertMoneyEqual } from './helpers/assertMoney';
import { knownGap, run, test } from './helpers/harness';
import { writeKnownGapEvidence } from './helpers/evidenceWriter';
import { createCustomerFixture, seedLoanTrackScenario, type LoanTrackScenario } from './helpers/seedLoanTrack';
import { knownGapCatalog } from './helpers/knownGaps';

const CHIT_APP = 'chitfunds';
const runId = getRunId();
const prisma = getPrisma();

let scenario: LoanTrackScenario;
let adminToken = '';
let agentToken = '';
let branchA2AdminToken = '';
let tenantBAdminToken = '';
let developerToken = '';

let lifecycleGroupId = '';
let lifecycleMembers: Array<{ id: string; memberNumber: number; customerId: string }> = [];
let lifecycleSubscriptions: Array<{ id: string; memberId: string; periodNumber: number; dueAmount: unknown; status: string }> = [];
let paidSubscriptionId = '';
let partialSubscriptionId = '';
let unpaidSubscriptionId = '';
let collectionReceiptId = '';

type ApiOptions = {
  importPath: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
  path: string;
  token?: string;
  params?: Record<string, string>;
  body?: unknown;
  tenantSlug?: string;
};

function api<T>(options: ApiOptions) {
  return routeRequest<Envelope<T>>({
    method: options.method ?? 'POST',
    importPath: options.importPath,
    path: options.path,
    token: options.token ?? adminToken,
    tenantSlug: options.tenantSlug ?? scenario.tenantA.slug,
    appType: CHIT_APP,
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
  for (const branchId of [scenario.branchA1.id, scenario.branchA2.id]) {
    await prisma.branchCashAccount.upsert({
      where: { tenantId_appType_branchId: { tenantId: scenario.tenantA.id, appType: CHIT_APP, branchId } },
      create: { tenantId: scenario.tenantA.id, appType: CHIT_APP, branchId, balance: 1_000_000 },
      update: { balance: 1_000_000 },
    });
  }
}

async function createChitCustomers(prefix: string, count: number, offsetStart: number, tenant: 'A' | 'B' = 'A') {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(await createCustomerFixture(scenario, {
      key: `${prefix}-${i + 1}`,
      phoneOffset: offsetStart + i,
      status: 'active',
      appType: CHIT_APP,
      tenantId: tenant === 'B' ? scenario.tenantB.id : scenario.tenantA.id,
      branchId: tenant === 'B' ? scenario.branchB1.id : scenario.branchA1.id,
      routeId: tenant === 'B' ? scenario.routeB1.id : scenario.routeA1.id,
      agentId: tenant === 'B' ? scenario.users.agentB1.id : scenario.users.agentA1.id,
    }));
  }
  return rows;
}

async function createChitGroup(input: {
  key: string;
  memberCount?: number;
  offsetStart?: number;
  auctionType?: string;
  tieBreakRule?: string;
  fixedDiscountPct?: number;
  dividendPolicy?: string;
  dividendDistribution?: string;
}) {
  const memberCount = input.memberCount ?? 3;
  const customers = await createChitCustomers(input.key, memberCount, input.offsetStart ?? 1200);
  const response = await api<{ id: string; status: string }>({
    importPath: routes.chits,
    method: 'POST',
    path: '/api/v1/chits',
    body: {
      name: `${runId}-${input.key}`,
      chitValue: 90_000,
      monthlyContrib: 30_000,
      totalMembers: memberCount,
      durationMonths: memberCount,
      commissionPct: 5,
      startDate: '2026-01-01',
      memberIds: customers.map((customer) => customer.id),
      auctionType: input.auctionType ?? 'open_manual',
      tieBreakRule: input.tieBreakRule ?? 'EARLIEST_BID',
      fixedDiscountPct: input.fixedDiscountPct,
      dividendPolicy: input.dividendPolicy ?? 'ALL_MEMBERS',
      dividendDistribution: input.dividendDistribution ?? 'ADJUST_NEXT_DUE',
    },
  });
  const group = expectOk(response, `${input.key} group create`);
  assert.equal(group.status, 'draft');
  return group.id;
}

async function verifyAgreements(groupId: string) {
  const members = expectOk<Array<{ id: string; memberNumber: number; customerId: string }>>(await api({
    importPath: routes.chitMembers,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/members`,
    params: { id: groupId },
  }));
  for (const member of members) {
    await api({
      importPath: routes.chitMemberAgreement,
      path: `/api/v1/chits/${groupId}/members/${member.id}/agreement`,
      params: { id: groupId, memberId: member.id },
      body: { status: 'verified' },
    });
  }
  return members;
}

async function activateGroup(groupId: string) {
  const response = await api<{ id: string; status: string }>({
    importPath: routes.chitActivate,
    path: `/api/v1/chits/${groupId}/activate`,
    params: { id: groupId },
  });
  const group = expectOk(response, 'activate group');
  assert.equal(group.status, 'active');
}

async function getSubscriptions(groupId: string) {
  return expectOk<Array<{ id: string; memberId: string; periodNumber: number; dueAmount: unknown; status: string }>>(await api({
    importPath: routes.chitSubscriptions,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/subscriptions`,
    params: { id: groupId },
  }));
}

async function firstAuction(groupId: string) {
  const auctions = expectOk<Array<{ id: string; periodNumber: number }>>(await api({
    importPath: routes.chitAuctions,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/auctions`,
    params: { id: groupId },
  }));
  return auctions.find((auction) => auction.periodNumber === 1) ?? auctions[0]!;
}

async function activeGroup(input: Parameters<typeof createChitGroup>[0]) {
  const groupId = await createChitGroup(input);
  const members = await verifyAgreements(groupId);
  await activateGroup(groupId);
  return { groupId, members };
}

test('CHIT-LIFE-001 creates a draft group, updates members, and activates schedules once', async () => {
  lifecycleGroupId = await createChitGroup({ key: 'life', offsetStart: 1300 });
  lifecycleMembers = await verifyAgreements(lifecycleGroupId);

  const updatedMember = expectOk<{ id: string; nomineeName: string; introducedBy: string }>(await api({
    importPath: routes.chitMemberById,
    method: 'PATCH',
    path: `/api/v1/chits/${lifecycleGroupId}/members/${lifecycleMembers[0]!.id}`,
    params: { id: lifecycleGroupId, memberId: lifecycleMembers[0]!.id },
    body: {
      ticketNo: '1',
      nomineeName: `${runId} Nominee`,
      nomineeRelation: 'spouse',
      nomineePhone: '7999999999',
      introducedBy: `${runId} introducer`,
    },
  }), 'member update');
  assert.equal(updatedMember.nomineeName, `${runId} Nominee`);
  assert.equal(updatedMember.introducedBy, `${runId} introducer`);

  await activateGroup(lifecycleGroupId);
  lifecycleSubscriptions = await getSubscriptions(lifecycleGroupId);
  const auctionCount = await prisma.chitAuction.count({ where: { chitGroupId: lifecycleGroupId } });
  assert.equal(lifecycleSubscriptions.length, 9);
  assert.equal(auctionCount, 3);

  const secondActivation = await api({
    importPath: routes.chitActivate,
    path: `/api/v1/chits/${lifecycleGroupId}/activate`,
    params: { id: lifecycleGroupId },
  });
  expectError(secondActivation, [409], 'second activation');
  assert.equal(await prisma.chitSubscription.count({ where: { member: { chitGroupId: lifecycleGroupId } } }), 9);
  assert.equal(await prisma.chitAuction.count({ where: { chitGroupId: lifecycleGroupId } }), 3);
});

test('CHIT-LIFE-002 posts payments, missed status, penalties, waivers, and receipt reversal', async () => {
  const memberOnePeriodOne = lifecycleSubscriptions.find((sub) => sub.memberId === lifecycleMembers[0]!.id && sub.periodNumber === 1)!;
  const memberTwoPeriodOne = lifecycleSubscriptions.find((sub) => sub.memberId === lifecycleMembers[1]!.id && sub.periodNumber === 1)!;
  const memberThreePeriodOne = lifecycleSubscriptions.find((sub) => sub.memberId === lifecycleMembers[2]!.id && sub.periodNumber === 1)!;
  paidSubscriptionId = memberOnePeriodOne.id;
  partialSubscriptionId = memberTwoPeriodOne.id;
  unpaidSubscriptionId = memberThreePeriodOne.id;

  const branchBefore = await prisma.branchCashAccount.findUnique({
    where: { tenantId_appType_branchId: { tenantId: scenario.tenantA.id, appType: CHIT_APP, branchId: scenario.branchA1.id } },
  });

  const fullPayment = expectOk<{ id: string; receivedDelta: number; status: string; receiptNo: string }>(await api({
    importPath: routes.chitPayments,
    path: `/api/v1/chits/${lifecycleGroupId}/payments`,
    params: { id: lifecycleGroupId },
    body: {
      memberId: lifecycleMembers[0]!.id,
      periodNumber: 1,
      amount: 30_000,
      paymentMode: 'cash',
      referenceNo: `${runId}-cash-1`,
    },
  }), 'full contribution payment');
  assert.equal(fullPayment.status, 'paid');
  assertMoneyEqual(fullPayment.receivedDelta, 30_000, 'full contribution delta');

  const receipt = await prisma.chitReceipt.findFirstOrThrow({
    where: { tenantId: scenario.tenantA.id, receiptNo: fullPayment.receiptNo, receiptType: 'collection' },
  });
  collectionReceiptId = receipt.id;
  assert.equal(receipt.entityId, paidSubscriptionId);

  const branchAfter = await prisma.branchCashAccount.findUniqueOrThrow({
    where: { tenantId_appType_branchId: { tenantId: scenario.tenantA.id, appType: CHIT_APP, branchId: scenario.branchA1.id } },
  });
  assertMoneyEqual(Number(branchAfter.balance) - Number(branchBefore?.balance ?? 0), 30_000, 'branch cash credited');
  assert.equal(await prisma.accountEntry.count({ where: { tenantId: scenario.tenantA.id, referenceId: paidSubscriptionId, type: 'collection' } }), 1);
  assert.equal(await prisma.walletTransaction.count({ where: { tenantId: scenario.tenantA.id, appType: CHIT_APP, refId: paidSubscriptionId, amount: 30_000 } }), 1);

  const partialPayment = expectOk<{ id: string; status: string; receivedDelta: number }>(await api({
    importPath: routes.chitPayments,
    token: agentToken,
    path: `/api/v1/chits/${lifecycleGroupId}/payments`,
    params: { id: lifecycleGroupId },
    body: {
      memberId: lifecycleMembers[1]!.id,
      periodNumber: 1,
      amount: 10_000,
      paymentMode: 'cash',
    },
  }), 'agent partial contribution payment');
  assert.equal(partialPayment.status, 'partial');
  assertMoneyEqual(partialPayment.receivedDelta, 10_000, 'partial contribution delta');

  const missedPartial = await api({
    importPath: routes.chitMiss,
    path: `/api/v1/chits/subscriptions/${partialSubscriptionId}/miss`,
    params: { id: partialSubscriptionId },
  });
  expectError(missedPartial, [409], 'partially paid subscription cannot be missed');

  const missed = expectOk<{ id: string; status: string }>(await api({
    importPath: routes.chitMiss,
    path: `/api/v1/chits/subscriptions/${unpaidSubscriptionId}/miss`,
    params: { id: unpaidSubscriptionId },
  }), 'mark unpaid subscription missed');
  assert.equal(missed.status, 'missed');

  const penalty = expectOk<{ id: string; amount: unknown; status: string }>(await api({
    importPath: routes.chitPenalties,
    path: `/api/v1/chits/${lifecycleGroupId}/penalties`,
    params: { id: lifecycleGroupId },
    body: {
      subscriptionId: unpaidSubscriptionId,
      amount: 300,
      reason: `${runId} late fee`,
    },
  }), 'create penalty');
  assert.equal(penalty.status, 'due');
  assertMoneyEqual((await prisma.chitSubscription.findUniqueOrThrow({ where: { id: unpaidSubscriptionId } })).penaltyAmount, 300, 'penalty added to subscription');

  const paidPenalty = expectOk<{ id: string; status: string; paidAmount: unknown }>(await api({
    importPath: routes.chitPenaltyPay,
    path: `/api/v1/chits/${lifecycleGroupId}/penalties/${penalty.id}/pay`,
    params: { id: lifecycleGroupId, penaltyId: penalty.id },
    body: { amount: 100, paymentMode: 'cash' },
  }), 'partial penalty payment');
  assert.equal(paidPenalty.status, 'partial');
  assertMoneyEqual(paidPenalty.paidAmount, 100, 'penalty paid amount');

  const partialWaiver = expectOk<{ id: string; status: string }>(await api({
    importPath: routes.chitPenaltyWaive,
    path: `/api/v1/chits/${lifecycleGroupId}/penalties/${penalty.id}/waive`,
    params: { id: lifecycleGroupId, penaltyId: penalty.id },
    body: { amount: 100, reason: 'manager waiver' },
  }), 'partial penalty waiver');
  assert.equal(partialWaiver.status, 'partial');
  assertMoneyEqual((await prisma.chitSubscription.findUniqueOrThrow({ where: { id: unpaidSubscriptionId } })).penaltyAmount, 200, 'partial waiver reduces subscription penalty');

  const fullWaiver = expectOk<{ id: string; status: string }>(await api({
    importPath: routes.chitPenaltyWaive,
    path: `/api/v1/chits/${lifecycleGroupId}/penalties/${penalty.id}/waive`,
    params: { id: lifecycleGroupId, penaltyId: penalty.id },
    body: { reason: 'close remaining penalty' },
  }), 'full penalty waiver');
  assert.equal(fullWaiver.status, 'waived');
  assertMoneyEqual((await prisma.chitSubscription.findUniqueOrThrow({ where: { id: unpaidSubscriptionId } })).penaltyAmount, 0, 'full waiver clears subscription penalty');

  const reversal = expectOk<{ id: string; receiptType: string }>(await api({
    importPath: routes.chitReceiptReverse,
    path: `/api/v1/chits/receipts/${collectionReceiptId}/reverse`,
    params: { receiptId: collectionReceiptId },
    body: { reason: `${runId} correction` },
  }), 'reverse collection receipt');
  assert.equal(reversal.receiptType, 'reversal');
  assert.equal((await prisma.chitReceipt.findUniqueOrThrow({ where: { id: collectionReceiptId } })).status, 'reversed');
  const reversedSub = await prisma.chitSubscription.findUniqueOrThrow({ where: { id: paidSubscriptionId } });
  assert.equal(reversedSub.status, 'upcoming');
  assertMoneyEqual(reversedSub.paidAmount, 0, 'reversal rolls back paid amount');
  assert.equal(await prisma.accountEntry.count({ where: { tenantId: scenario.tenantA.id, referenceId: collectionReceiptId, type: 'reversal', amount: -30_000 } }), 1);
  assert.equal(await prisma.walletTransaction.count({ where: { tenantId: scenario.tenantA.id, appType: CHIT_APP, refId: collectionReceiptId, amount: -30_000 } }), 1);
});

test('CHIT-AUC-001 confirms manual bids, applies dividend, and releases payout only after security approval', async () => {
  const { groupId, members } = await activeGroup({ key: 'manual-auction', offsetStart: 1400 });
  const auction = await firstAuction(groupId);
  await api({
    importPath: routes.chitAuctionAttendance,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/attendance`,
    params: { id: groupId, auctionId: auction.id },
    body: { memberId: members[0]!.id, status: 'present' },
  });
  const bidOne = expectOk<{ id: string; bidDiscount: unknown }>(await api({
    importPath: routes.chitAuctionBids,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/bids`,
    params: { id: groupId, auctionId: auction.id },
    body: { memberId: members[0]!.id, prizeAmount: 80_000, remarks: 'opening bid' },
  }), 'manual bid one');
  await api({
    importPath: routes.chitAuctionBids,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/bids`,
    params: { id: groupId, auctionId: auction.id },
    body: { memberId: members[1]!.id, prizeAmount: 75_000, remarks: 'winning bid' },
  });

  const confirmed = expectOk<{ id: string; status: string; payoutStatus: string; dividend: unknown }>(await api({
    importPath: routes.chitAuctionConfirm,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/confirm`,
    params: { id: groupId, auctionId: auction.id },
    body: { winningBidId: bidOne.id, minutesText: `${runId} manual auction minutes` },
  }), 'confirm selected manual bid');
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.payoutStatus, 'security_pending');
  assert.equal(await prisma.chitSecurity.count({ where: { auctionId: auction.id, status: 'pending' } }), 1);

  const nextDue = await prisma.chitSubscription.findFirstOrThrow({
    where: { memberId: members[0]!.id, periodNumber: 2 },
  });
  assert.equal(Number(nextDue.dividendAmount) > 0, true);
  assert.equal(Number(nextDue.dueAmount) < 30_000, true);

  const adminPayout = await api({
    importPath: routes.chitAuctionPayout,
    token: adminToken,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/payout`,
    params: { id: groupId, auctionId: auction.id },
    body: { paymentMode: 'cash' },
  });
  expectError(adminPayout, [403], 'admin cannot release payout');

  const blockedPayout = await api({
    importPath: routes.chitAuctionPayout,
    token: developerToken,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/payout`,
    params: { id: groupId, auctionId: auction.id },
    body: { paymentMode: 'cash' },
  });
  expectError(blockedPayout, [400, 500], 'payout blocked before security approval');

  const approved = expectOk<{ id: string; status: string }>(await api({
    importPath: routes.chitAuctionSecurity,
    token: developerToken,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/security`,
    params: { id: groupId, auctionId: auction.id },
    body: {
      action: 'approve',
      securityType: 'guarantor',
      guarantorName: `${runId} guarantor`,
      guarantorPhone: '7888888888',
    },
  }), 'approve security');
  assert.equal(approved.status, 'approved');

  const payout = expectOk<{ receiptNo: string; auction: { payoutStatus: string; status: string } }>(await api({
    importPath: routes.chitAuctionPayout,
    token: developerToken,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/payout`,
    params: { id: groupId, auctionId: auction.id },
    body: { paymentMode: 'cash', notes: `${runId} payout` },
  }), 'release payout');
  assert.equal(payout.auction.payoutStatus, 'paid');
  assert.equal(payout.auction.status, 'paid');
  assert.equal(await prisma.accountEntry.count({ where: { tenantId: scenario.tenantA.id, referenceId: auction.id, referenceType: 'chit_auction', type: 'chit_payout' } }), 1);
  assert.equal(await prisma.chitReceipt.count({ where: { tenantId: scenario.tenantA.id, receiptNo: payout.receiptNo, receiptType: 'payout' } }), 1);
  assert.equal(await prisma.walletTransaction.count({ where: { tenantId: scenario.tenantA.id, appType: CHIT_APP, refId: auction.id, amount: -80_000 } }), 1);

  const duplicatePayout = await api({
    importPath: routes.chitAuctionPayout,
    token: developerToken,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/payout`,
    params: { id: groupId, auctionId: auction.id },
    body: { paymentMode: 'cash' },
  });
  expectError(duplicatePayout, [400, 500], 'duplicate payout rejected');
});

test('CHIT-AUC-002 tied highest discounts use lottery evidence during confirmation', async () => {
  const { groupId, members } = await activeGroup({
    key: 'tie-auction',
    offsetStart: 1500,
    tieBreakRule: 'LOTTERY_AMONG_TIED',
  });
  const auction = await firstAuction(groupId);
  for (const member of members.slice(0, 2)) {
    await api({
      importPath: routes.chitAuctionBids,
      path: `/api/v1/chits/${groupId}/auctions/${auction.id}/bids`,
      params: { id: groupId, auctionId: auction.id },
      body: { memberId: member.id, prizeAmount: 80_000 },
    });
  }
  const confirmed = expectOk<{ id: string; status: string; minutesText: string | null }>(await api({
    importPath: routes.chitAuctionConfirm,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/confirm`,
    params: { id: groupId, auctionId: auction.id },
    body: {},
  }), 'confirm tied auction');
  assert.equal(confirmed.status, 'confirmed');
  assert.match(confirmed.minutesText ?? '', /Tie at highest discount|seed/i);
  assert.equal(await prisma.chitBid.count({ where: { auctionId: auction.id, status: 'winning' } }), 1);
});

test('CHIT-AUC-003 fixed rotation draw creates auditable synthetic winning bid', async () => {
  const { groupId } = await activeGroup({
    key: 'fixed-draw',
    offsetStart: 1600,
    auctionType: 'fixed_rotation',
    fixedDiscountPct: 10,
  });
  const auction = await firstAuction(groupId);
  const draw = expectOk<{ auctionId: string; winnerMemberId: string; drawEvidence: string; bidDiscount: number }>(await api({
    importPath: routes.chitAuctionDraw,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/draw`,
    params: { id: groupId, auctionId: auction.id },
  }), 'fixed rotation draw');
  assert.equal(draw.auctionId, auction.id);
  assert.match(draw.drawEvidence, /Fixed rotation/);
  assertMoneyEqual(draw.bidDiscount, 9_000, 'fixed rotation bid discount');
  assert.equal(await prisma.chitBid.count({ where: { auctionId: auction.id, memberId: draw.winnerMemberId, status: 'winning' } }), 1);
  assert.equal((await prisma.chitAuction.findUniqueOrThrow({ where: { id: auction.id } })).status, 'confirmed');
});

test('CHIT-AUC-004 live room opens, extends on bid, closes, and confirms', async () => {
  const { groupId, members } = await activeGroup({
    key: 'live-room',
    offsetStart: 1700,
    auctionType: 'open_live',
  });
  const auction = await firstAuction(groupId);
  const opened = expectOk<{ roomStatus: string; autoExtendSeconds: number }>(await api({
    importPath: routes.chitAuctionRoom,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/room`,
    params: { id: groupId, auctionId: auction.id },
    body: { action: 'open', durationMinutes: 0.01, autoExtendSeconds: 60 },
  }), 'open live room');
  assert.equal(opened.roomStatus, 'open');
  assert.equal(opened.autoExtendSeconds, 60);

  const liveBefore = expectOk<{ roomStatus: string; secondsRemaining: number; bidCount: number }>(await api({
    importPath: routes.chitAuctionLive,
    method: 'GET',
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/live`,
    params: { id: groupId, auctionId: auction.id },
  }), 'live room state');
  assert.equal(liveBefore.roomStatus, 'open');
  assert.equal(liveBefore.bidCount, 0);

  await api({
    importPath: routes.chitAuctionBids,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/bids`,
    params: { id: groupId, auctionId: auction.id },
    body: { memberId: members[0]!.id, prizeAmount: 80_000 },
  });
  const afterBid = await prisma.chitAuction.findUniqueOrThrow({ where: { id: auction.id } });
  assert.equal(['open', 'extended'].includes(afterBid.roomStatus), true);

  const closed = expectOk<{ roomStatus: string }>(await api({
    importPath: routes.chitAuctionRoom,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/room`,
    params: { id: groupId, auctionId: auction.id },
    body: { action: 'close' },
  }), 'close live room');
  assert.equal(closed.roomStatus, 'closed');

  const confirmed = expectOk<{ status: string; winnerMemberId: string }>(await api({
    importPath: routes.chitAuctionConfirm,
    path: `/api/v1/chits/${groupId}/auctions/${auction.id}/confirm`,
    params: { id: groupId, auctionId: auction.id },
    body: {},
  }), 'confirm live auction');
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.winnerMemberId, members[0]!.id);
});

test('CHIT-SEC-001 enforces tenant, branch, and role boundaries around chit routes', async () => {
  const tenantBRead = await api({
    importPath: routes.chitById,
    method: 'GET',
    token: tenantBAdminToken,
    tenantSlug: scenario.tenantB.slug,
    path: `/api/v1/chits/${lifecycleGroupId}`,
    params: { id: lifecycleGroupId },
  });
  expectError(tenantBRead, [403, 404], 'tenant B cannot read tenant A chit group');

  const branchA2Read = await api({
    importPath: routes.chitById,
    method: 'GET',
    token: branchA2AdminToken,
    path: `/api/v1/chits/${lifecycleGroupId}`,
    params: { id: lifecycleGroupId },
  });
  expectError(branchA2Read, [403, 404], 'branch A2 cannot read branch A1 chit group');

  const agentCreate = await api({
    importPath: routes.chits,
    token: agentToken,
    path: '/api/v1/chits',
    body: {
      name: `${runId}-agent-forbidden`,
      chitValue: 10_000,
      monthlyContrib: 5_000,
      totalMembers: 2,
      memberIds: [],
    },
  });
  expectError(agentCreate, [403], 'agent cannot create chit group');

  const agentEdit = await api({
    importPath: routes.chitMemberById,
    method: 'PATCH',
    token: agentToken,
    path: `/api/v1/chits/${lifecycleGroupId}/members/${lifecycleMembers[0]!.id}`,
    params: { id: lifecycleGroupId, memberId: lifecycleMembers[0]!.id },
    body: { nomineeName: 'forbidden' },
  });
  expectError(agentEdit, [403], 'agent cannot edit chit member');
});

test('CHIT-LIFE-003 cancels a group and records suspended compliance state', async () => {
  const cancelled = expectOk<{ id: string; status: string; complianceStatus: string }>(await api({
    importPath: routes.chitCancel,
    path: `/api/v1/chits/${lifecycleGroupId}/cancel`,
    params: { id: lifecycleGroupId },
  }), 'cancel group');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.complianceStatus, 'suspended');
});

knownGap('CHIT-GAP-001 cancelled groups still accept follow-up collection operations', {
  id: 'CHIT-GAP-001',
  classification: 'P1',
  currentBehavior: 'The payment route scopes by group but does not reject groups after status=cancelled.',
  expectedBehavior: 'Cancelled chit groups should reject new payments, bids, member edits, and security/payout actions.',
  evidenceSource: 'app/api/v1/chits/[id]/cancel/route.ts only updates ChitGroup status; app/api/v1/chits/[id]/payments/route.ts does not check group.status.',
  businessImpact: 'Operators can continue posting money movement against a cancelled group.',
  fixedAssertion: 'Posting a contribution after cancellation returns 400/409 and creates no receipt, account entry, or wallet movement.',
}, async () => {
  const response = await api({
    importPath: routes.chitPayments,
    path: `/api/v1/chits/${lifecycleGroupId}/payments`,
    params: { id: lifecycleGroupId },
    body: {
      memberId: lifecycleMembers[0]!.id,
      periodNumber: 2,
      amount: 100,
      paymentMode: 'cash',
    },
  });
  expectError(response, [400, 403, 404, 409], 'cancelled group payment should be blocked');
});

knownGap('MOD-GAP-001 disabled chitfunds module is not enforced at API boundary', knownGapCatalog.optionalModuleBackendMissing, async () => {
  const customers = await createChitCustomers('disabled-module', 2, 1800, 'B');
  const response = await api({
    importPath: routes.chits,
    token: tenantBAdminToken,
    tenantSlug: scenario.tenantB.slug,
    path: '/api/v1/chits',
    body: {
      name: `${runId}-disabled-module`,
      chitValue: 20_000,
      monthlyContrib: 10_000,
      totalMembers: 2,
      durationMonths: 2,
      memberIds: customers.map((customer) => customer.id),
    },
  });
  expectError(response, [403, 404], 'disabled chitfunds module should reject create');
});

async function main() {
  try {
    scenario = await seedLoanTrackScenario(runId);
    await enableChitfundsForTenantA();
    adminToken = await issueMobileTokenForSetup({ ...scenario.users.adminA1, appType: CHIT_APP });
    agentToken = await issueMobileTokenForSetup({ ...scenario.users.agentA1, appType: CHIT_APP });
    branchA2AdminToken = await issueMobileTokenForSetup({ ...scenario.users.adminA2, appType: CHIT_APP });
    tenantBAdminToken = await issueMobileTokenForSetup({ ...scenario.users.adminB1, appType: CHIT_APP });
    developerToken = await issueMobileTokenForSetup({ ...scenario.users.adminA1, role: 'developer', appType: CHIT_APP });
    const summary = await run();
    await writeKnownGapEvidence(runId, summary, 'tests/e2e-business/chitsAutomation.test.ts');
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
