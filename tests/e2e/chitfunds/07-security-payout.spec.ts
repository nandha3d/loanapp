import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, branchPool, num, type Session } from './support/harness';
import { loadState, patchState, type ChitRunState, type SeededGroup } from './support/state';

/**
 * The security gate and the prize payout.
 *
 * These two are one mechanism: CHIT-15 stops finalisation at security_pending,
 * CHIT-17 lists what must be true before money moves, and CHIT-18 refuses a
 * second posting. Every refusal is asserted for its STATUS as well as its
 * message — a gate that answers 500 tells the mobile client the server fell
 * over, when in fact it correctly refused (API-4).
 */

let owner: Session;
let admin: Session;
let agent: Session;
let s: ChitRunState;

const CHIT_VALUE = 100_000;
const prizeForDiscount = (discount: number) => CHIT_VALUE - discount;

const asAdmin = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });
const asOwner = () => ({ token: owner.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });
const asAgent = () => ({ token: agent.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

function securityPath(g: SeededGroup, auctionId: string, sub = '') {
  return `/api/v1/chits/${g.id}/auctions/${auctionId}/security${sub}`;
}

/** Confirm a fresh auction and return it sitting at the security gate. */
async function confirmedAuction(period: number, ticket: string, discount = 15_000) {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({
    where: { chitGroupId: g.id, periodNumber: period },
  });
  await db().chitBid.deleteMany({ where: { auctionId: auction.id } });
  await db().chitSecurity.deleteMany({ where: { auctionId: auction.id } });
  await db().chitAuction.update({
    where: { id: auction.id },
    data: { status: 'pending', payoutStatus: 'not_ready', winnerMemberId: null, prizeAmount: null },
  });
  await db().chitMember.updateMany({ where: { chitGroupId: g.id }, data: { hasWon: false, wonAt: null } });

  const placed = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auction.id}/bids`,
    { memberId: g.membersByTicket[ticket], prizeAmount: prizeForDiscount(discount) },
    asAdmin(),
  );
  expect(placed.status, JSON.stringify(placed.raw)).toBeLessThan(300);

  const confirmed = await api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/confirm`, {}, asAdmin());
  expect(confirmed.status, JSON.stringify(confirmed.raw)).toBeLessThan(300);

  return { group: g, auctionId: auction.id };
}

/** Put a known balance in the HQ chit cash pool — the payout has to come from somewhere. */
async function setBranchPool(balance: number) {
  await db().branchCashAccount.upsert({
    where: {
      tenantId_appType_branchId: {
        tenantId: s.tenantA.id,
        appType: 'chitfunds',
        branchId: s.tenantA.branches.hq!,
      },
    },
    create: { tenantId: s.tenantA.id, appType: 'chitfunds', branchId: s.tenantA.branches.hq!, balance },
    update: { balance },
  });
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

// ── The gate opens ──────────────────────────────────────────────────────────
test('[CF-465] Confirmation creates a pending security record', async () => {
  const { group, auctionId } = await confirmedAuction(1, '1');

  const rows = await db().chitSecurity.findMany({ where: { auctionId } });
  expect(rows, 'exactly one security row').toHaveLength(1);
  expect(rows[0].status).toBe('pending');
  expect(rows[0].winnerMemberId).toBe(group.membersByTicket['1']);
  expect(rows[0].chitGroupId).toBe(group.id);

  const read = await api.get(securityPath(group, auctionId), asAdmin());
  expect(read.status, JSON.stringify(read.raw)).toBeLessThan(300);

  patchState((state) => {
    state.tenantA.auctions.gate = auctionId;
  });
});

test('[CF-466] Security cannot be recorded before a winner exists', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 2 } });
  await db().chitAuction.update({ where: { id: auction.id }, data: { winnerMemberId: null, status: 'pending' } });

  const res = await api.post(securityPath(g, auction.id), { action: 'submit' }, asAdmin());
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/winner is required before security/i);
});

test('[CF-467] An admin can move security to submitted and verified', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;

  const submitted = await api.post(
    securityPath(g, auctionId),
    { securityType: 'guarantor', guarantorName: 'QA Guarantor', guarantorPhone: '9100800001', securityValue: 85_000 },
    asAdmin(),
  );
  expect(submitted.status, JSON.stringify(submitted.raw)).toBeLessThan(300);
  expect(submitted.data.status).toBe('submitted');

  const verified = await api.post(securityPath(g, auctionId), { action: 'verify' }, asAdmin());
  expect(verified.status, JSON.stringify(verified.raw)).toBeLessThan(300);
  expect(verified.data.status).toBe('verified');
  expect(verified.data.verifiedById, 'the verifier is recorded').toBeTruthy();
});

test('[CF-007] An admin cannot approve chit security', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;

  const res = await api.post(securityPath(g, auctionId), { action: 'approve' }, asAdmin());
  expect(res.status, 'CHIT-29: approval is a different capability from verification').toBe(403);

  const row = await db().chitSecurity.findFirstOrThrow({ where: { auctionId } });
  expect(row.status).toBe('verified');
  expect((await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).payoutStatus).toBe('security_pending');
});

test('[CF-006] An agent cannot approve chit security', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const res = await api.post(securityPath(g, state.tenantA.auctions.gate), { action: 'approve' }, asAgent());
  expect(res.status).toBe(403);
});

test('[CF-491] A payout without approved security is refused', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await api.post(`/api/v1/chits/${g.id}/auctions/${auctionId}/payout`, {}, asOwner());
  expect(String(res.error ?? '')).toMatch(/security must be approved/i);
  expect(
    [400, 409],
    `API-4: a refused gate is a 4xx, got ${res.status} — a 500 tells the mobile client the server broke`,
  ).toContain(res.status);

  expect(await db().chitReceipt.count({ where: { entityId: auctionId, receiptType: 'payout' } })).toBe(0);
  expect(await db().accountEntry.count({ where: { referenceId: auctionId, type: 'chit_payout' } })).toBe(0);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'no cash moved').toBe(poolBefore);
});

test('[CF-468] [CF-469] Only a superadmin can approve, and approval opens the payout', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;

  const res = await api.post(securityPath(g, auctionId), { action: 'approve' }, asOwner());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);
  expect(res.data.status).toBe('approved');
  expect(res.data.approvedById).toBeTruthy();

  const auction = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(auction.payoutStatus, 'CHIT-17: ready, and not before').toBe('ready');
});

// ── Documents ───────────────────────────────────────────────────────────────
test('[CF-471] Security documents can only be uploaded after security is opened', async () => {
  const { group, auctionId } = await confirmedAuction(3, '2');
  await db().chitSecurity.deleteMany({ where: { auctionId } });

  const res = await api.post(
    securityPath(group, auctionId, '/documents'),
    { documentType: 'guarantor_kyc', fileUrl: 'https://example.test/kyc.pdf' },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/submit security before uploading/i);
});

test('[CF-472] Only allowed document types are accepted', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;

  const bad = await api.post(
    securityPath(g, auctionId, '/documents'),
    { documentType: 'selfie', fileUrl: 'https://example.test/selfie.jpg' },
    asAdmin(),
  );
  expect(bad.status).toBe(400);
  expect(String(bad.error ?? '')).toMatch(/invalid document type/i);

  for (const documentType of ['guarantor_photo', 'guarantor_kyc', 'security_cheque']) {
    const good = await api.post(
      securityPath(g, auctionId, '/documents'),
      { documentType, fileUrl: `https://example.test/${documentType}.pdf` },
      asAdmin(),
    );
    expect(good.status, `${documentType} → ${JSON.stringify(good.raw)}`).toBeLessThan(300);
  }
});

test('[CF-473] A document upload requires a file URL', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const res = await api.post(
    securityPath(g, state.tenantA.auctions.gate, '/documents'),
    { documentType: 'guarantor_kyc' },
    asAdmin(),
  );
  expect(res.status).toBe(400);
  expect(String(res.error ?? '')).toMatch(/fileurl is required/i);
});

test('[CF-474] Document approval is restricted the same way as security approval', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;

  const list = await api.get(securityPath(g, auctionId, '/documents'), asAdmin());
  expect(list.status, JSON.stringify(list.raw)).toBeLessThan(300);
  const documents = Array.isArray(list.data) ? list.data : list.data?.items ?? [];
  expect(documents.length, 'the uploads from CF-472 are listed').toBeGreaterThan(0);
  const documentId = documents[0].id;

  const verified = await api.patch(
    securityPath(g, auctionId, `/documents/${documentId}`),
    { action: 'verify' },
    asAdmin(),
  );
  expect(verified.status, 'verification stays open to an admin').toBeLessThan(300);

  const byAdmin = await api.patch(
    securityPath(g, auctionId, `/documents/${documentId}`),
    { action: 'approve' },
    asAdmin(),
  );
  expect(byAdmin.status, 'CHIT-29').toBe(403);

  const byOwner = await api.patch(
    securityPath(g, auctionId, `/documents/${documentId}`),
    { action: 'approve' },
    asOwner(),
  );
  expect(byOwner.status, JSON.stringify(byOwner.raw)).toBeLessThan(300);
});

test('[CF-475] A document from another auction cannot be reviewed through this one', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const foreign = await db().chitDocument.findFirst({
    where: { tenantId: s.tenantA.id, entityType: 'payment_intent' },
  });

  const res = await api.patch(
    securityPath(g, state.tenantA.auctions.gate, `/documents/${foreign?.id ?? 'doc_missing'}`),
    { action: 'verify' },
    asAdmin(),
  );
  expect(res.status).toBe(404);
});

test('[CF-476] Security documents are listed only for the owning branch', async () => {
  const state = loadState();
  const erode = state.tenantA.groups.erode!;
  const auction = await db().chitAuction.findFirst({ where: { chitGroupId: erode.id } });

  const res = await api.get(
    `/api/v1/chits/${erode.id}/auctions/${auction?.id ?? 'auction_missing'}/security/documents`,
    asAdmin(),
  );
  expect(res.status, 'SCOPE-3: out of the active branch is 404').toBe(404);
});

// ── Payout refusals ─────────────────────────────────────────────────────────
test('[CF-492] A payout on an unconfirmed auction is refused', async () => {
  const g = loadState().tenantA.groups.manual!;
  const auction = await db().chitAuction.findFirstOrThrow({ where: { chitGroupId: g.id, periodNumber: 4 } });
  await db().chitAuction.update({
    where: { id: auction.id },
    data: { status: 'in_progress', payoutStatus: 'not_ready' },
  });

  const res = await api.post(`/api/v1/chits/${g.id}/auctions/${auction.id}/payout`, {}, asOwner());
  expect(String(res.error ?? '')).toMatch(/winner is missing|must be confirmed/i);
  expect([400, 409], `API-4, got ${res.status}`).toContain(res.status);
});

test('[CF-493] A payout with payoutStatus not ready is refused', async () => {
  const { group, auctionId } = await confirmedAuction(6, '3');
  await db().chitSecurity.updateMany({ where: { auctionId }, data: { status: 'approved' } });
  await db().chitAuction.update({ where: { id: auctionId }, data: { payoutStatus: 'security_pending' } });

  const res = await api.post(`/api/v1/chits/${group.id}/auctions/${auctionId}/payout`, {}, asOwner());
  expect(String(res.error ?? '')).toMatch(/payout is not ready/i);
  expect([400, 409], `API-4, got ${res.status}`).toContain(res.status);
});

test('[CF-494] A payout with no winner or a zero prize is refused', async () => {
  const { group, auctionId } = await confirmedAuction(7, '4');
  await db().chitSecurity.updateMany({ where: { auctionId }, data: { status: 'approved' } });
  await db().chitAuction.update({ where: { id: auctionId }, data: { payoutStatus: 'ready', prizeAmount: 0 } });

  const zeroPrize = await api.post(`/api/v1/chits/${group.id}/auctions/${auctionId}/payout`, {}, asOwner());
  expect(String(zeroPrize.error ?? '')).toMatch(/prize amount is missing/i);
  expect([400, 409]).toContain(zeroPrize.status);

  await db().chitAuction.update({
    where: { id: auctionId },
    data: { prizeAmount: 85_000, winnerMemberId: null },
  });
  const noWinner = await api.post(`/api/v1/chits/${group.id}/auctions/${auctionId}/payout`, {}, asOwner());
  expect(String(noWinner.error ?? '')).toMatch(/winner is missing/i);
  expect([400, 409]).toContain(noWinner.status);
});

test('[CF-496] Only superadmin or developer can release a payout', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;

  for (const [label, opt] of [['admin', asAdmin()], ['agent', asAgent()]] as const) {
    const res = await api.post(`/api/v1/chits/${g.id}/auctions/${auctionId}/payout`, {}, opt);
    expect(res.status, `${label} must be refused`).toBe(403);
  }
  expect((await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).payoutStatus).toBe('ready');
});

test('[CF-498] A payout larger than the branch pool must be refused, not overdrawn', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;
  const prize = num((await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).prizeAmount);

  await setBranchPool(prize - 1_000);

  const res = await api.post(`/api/v1/chits/${g.id}/auctions/${auctionId}/payout`, {}, asOwner());
  const poolAfter = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  expect(
    poolAfter,
    `MONEY-16: the chit cash pool must never go negative — it is physical cash in a physical office (balance ${poolAfter})`,
  ).toBeGreaterThanOrEqual(0);
  expect([400, 409], `X-14: an insufficient float surfaces as a 409, got ${res.status}`).toContain(res.status);
  expect(
    await db().chitReceipt.count({ where: { entityId: auctionId, receiptType: 'payout' } }),
    'a refused payout leaves no receipt behind',
  ).toBe(0);
});

// ── The payout itself ───────────────────────────────────────────────────────
test('[CF-490] [CF-497] [CF-500] A funded payout posts once and debits the pool', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;
  const prize = num((await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } })).prizeAmount);

  await db().chitAuction.update({ where: { id: auctionId }, data: { payoutStatus: 'ready', status: 'confirmed' } });
  await setBranchPool(prize + 50_000);
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await api.post(`/api/v1/chits/${g.id}/auctions/${auctionId}/payout`, { paymentMode: 'cash' }, asOwner());
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const auction = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(auction.payoutStatus).toBe('paid');
  expect(auction.status).toBe('paid');

  const receipts = await db().chitReceipt.findMany({ where: { entityId: auctionId, receiptType: 'payout' } });
  expect(receipts, 'one payout receipt').toHaveLength(1);
  expect(receipts[0].receiptNo, 'CHIT-25: the payout series is CPO').toMatch(/^CPO-/);
  expect(num(receipts[0].amount)).toBe(prize);

  const entries = await db().accountEntry.findMany({ where: { referenceId: auctionId, type: 'chit_payout' } });
  expect(entries, 'one cash-book entry').toHaveLength(1);
  expect(num(entries[0].amount)).toBe(prize);

  expect(
    await branchPool(s.tenantA.id, s.tenantA.branches.hq!),
    'the pool falls by exactly the prize',
  ).toBe(poolBefore - prize);

  const wallet = await db().walletTransaction.findFirst({
    where: { tenantId: s.tenantA.id, appType: 'chitfunds', refType: 'chit', refId: auctionId },
  });
  expect(wallet, 'a wallet transaction records the movement').toBeTruthy();
  expect(num(wallet!.amount), 'a payout is a debit').toBe(-prize);
});

test('[CF-495] A second payout for the same auction is refused', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;
  const poolBefore = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  // Force the gate back open so the ONLY thing standing between this call and a
  // second posting is CHIT-18's own duplicate check.
  await db().chitAuction.update({ where: { id: auctionId }, data: { payoutStatus: 'ready', status: 'confirmed' } });

  const res = await api.post(`/api/v1/chits/${g.id}/auctions/${auctionId}/payout`, {}, asOwner());
  expect(String(res.error ?? '')).toMatch(/already posted/i);
  expect([400, 409], `API-4, got ${res.status}`).toContain(res.status);

  expect(await db().accountEntry.count({ where: { referenceId: auctionId, type: 'chit_payout' } })).toBe(1);
  expect(await db().chitReceipt.count({ where: { entityId: auctionId, receiptType: 'payout' } })).toBe(1);
  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'the pool is debited once').toBe(poolBefore);
});

test('[CF-502] A paid auction is locked against further bids and confirms', async () => {
  const state = loadState();
  const g = state.tenantA.groups.manual!;
  const auctionId = state.tenantA.auctions.gate;
  await db().chitAuction.update({ where: { id: auctionId }, data: { status: 'paid' } });

  const bid = await api.post(
    `/api/v1/chits/${g.id}/auctions/${auctionId}/bids`,
    { memberId: g.membersByTicket['12'], prizeAmount: prizeForDiscount(20_000) },
    asAdmin(),
  );
  expect(bid.status).toBe(400);
  expect(String(bid.error ?? '')).toMatch(/locked/i);

  const confirm = await api.post(`/api/v1/chits/${g.id}/auctions/${auctionId}/confirm`, {}, asAdmin());
  expect(confirm.status).toBe(409);
});

test('[CF-470] Rejecting security keeps the payout closed', async () => {
  const { group, auctionId } = await confirmedAuction(8, '5');

  const submitted = await api.post(securityPath(group, auctionId), { guarantorName: 'Reject Me' }, asAdmin());
  expect(submitted.status).toBeLessThan(300);

  const rejected = await api.post(
    securityPath(group, auctionId),
    { action: 'reject', rejectionReason: 'Guarantor KYC failed' },
    asOwner(),
  );
  expect(rejected.status, JSON.stringify(rejected.raw)).toBeLessThan(300);
  expect(rejected.data.status).toBe('rejected');
  expect(rejected.data.rejectionReason).toBe('Guarantor KYC failed');

  const auction = await db().chitAuction.findUniqueOrThrow({ where: { id: auctionId } });
  expect(auction.payoutStatus, 'a rejection never opens the payout').toBe('security_pending');

  const res = await api.post(`/api/v1/chits/${group.id}/auctions/${auctionId}/payout`, {}, asOwner());
  expect(String(res.error ?? '')).toMatch(/security must be approved/i);
  expect([400, 409]).toContain(res.status);
});
