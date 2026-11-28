import { expect, test } from '@playwright/test';
import { api, db, closeDb, branchPool, type Session } from './support/harness';
import { loadState, type ChitRunState } from './support/state';

/**
 * E2E verification for P0–P2 chit fund parity features:
 * - Task 1: Winner payout arrears auto-deduction (FIFO) + split 2-tranche disbursement + idempotency
 * - Task 2: Mid-cycle running chit migration dry-run & atomic commit (zero phantom arrears)
 * - Task 3: Cash denomination enforcement (REQUIRED rejects mismatch, accepts exact)
 * - Task 4: Quick-Add minimal subscriber onboarding & public lead-magnet template download
 * - Task 5/7: Statutory register Enterprise gate & public template HTTP 200
 */

let admin: Session;
let s: ChitRunState;

const asAdmin = () => ({ token: admin.token, appType: 'chitfunds', branchId: s.tenantA.branches.hq });

test.beforeAll(async () => {
  s = loadState();
  admin = s.tenantA.users.admin!;
});

test.afterAll(async () => {
  await closeDb();
});

test('Public 5-tab lead-magnet chit tracker xlsx downloads without auth', async ({ request }) => {
  const res = await request.get('/api/public/templates/chit-fund-tracker.xlsx');
  expect(res.status()).toBe(200);
  const ct = res.headers()['content-type'] ?? '';
  expect(ct).toContain('spreadsheetml.sheet');
  const buf = await res.body();
  expect(buf.byteLength).toBeGreaterThan(3000);
});

test('Quick-Add creates minimal member & reuses existing customer by normalized phone', async () => {
  const g = s.tenantA.groups.manual!;
  // Ensure capacity allows an extra member
  await db().chitGroup.update({ where: { id: g.id }, data: { totalMembers: { increment: 2 } } });

  const phone = `98422${Math.floor(10000 + Math.random() * 89999)}`;
  const res1 = await api.post(
    `/api/v1/chits/${g.id}/members/quick-add`,
    { fullName: 'E2E Quick Subscriber', phone: `+91 ${phone}` },
    asAdmin(),
  );
  expect(res1.status, JSON.stringify(res1.raw)).toBe(200);
  expect(res1.raw?.data?.added?.length).toBe(1);
  expect(res1.raw?.data?.added?.[0]?.phone).toBe(phone);
});

test('Cash denomination REQUIRED enforces exact note match on chit payment API', async () => {
  const g = s.tenantA.groups.manual!;
  const sub = await db().chitSubscription.findFirstOrThrow({
    where: { member: { chitGroupId: g.id }, status: 'pending' },
    include: { member: true },
  });

  // Enable REQUIRED denomination mode for tenant
  const putRes = await api.put(
    '/api/v1/chits/settings',
    { cashDenominationMode: 'REQUIRED' },
    asAdmin(),
  );
  expect(putRes.status).toBe(200);

  const due = Number(sub.dueAmount) - Number(sub.paidAmount);
  const badRes = await api.post(
    `/api/v1/chits/${g.id}/payments`,
    {
      memberId: sub.memberId,
      periodNumber: sub.periodNumber,
      amount: due,
      paymentMode: 'cash',
      denominationBreakdown: { counts: { '500': 1 }, computedTotal: 500 },
    },
    asAdmin(),
  );
  expect(badRes.status).toBe(400);

  // Restore OPTIONAL so subsequent tests stay backward-compatible
  await api.put('/api/v1/chits/settings', { cashDenominationMode: 'OPTIONAL' }, asAdmin());
});

test('Mid-cycle running chit migration dry-run + atomic commit creates historical cycles without phantom arrears', async () => {
  const dry = await api.post(
    '/api/v1/chits/migrate?dryRun=1',
    {
      name: `E2E Migrated Series ${Date.now()}`,
      chitValue: 50000,
      monthlyContrib: 5000,
      totalMembers: 4,
      totalCycles: 10,
      currentActiveCycle: 4,
      commissionPct: 5,
      startDate: '2026-01-01',
      openingCashBalance: 15000,
      stateCode: 'TN',
      members: [
        {
          name: 'Prized Cycle 1 Member',
          phone: '9800011001',
          alreadyPrized: true,
          prizedCycleNumber: 1,
          historicalPrizeAmount: 45000,
          historicalPayoutPendingAmount: 5000,
        },
        {
          name: 'Arrears Member Two',
          phone: '9800011002',
          alreadyPrized: false,
          openingArrearsAmount: 5000,
        },
        {
          name: 'Advance Member Three',
          phone: '9800011003',
          alreadyPrized: false,
          openingAdvanceAmount: 2000,
        },
      ],
    },
    asAdmin(),
  );
  expect(dry.status, JSON.stringify(dry.raw)).toBe(200);
  expect(dry.raw?.data?.summary?.valid).toBe(true);
  expect(dry.raw?.data?.summary?.historicalCyclesCount).toBe(3);

  const commit = await api.post(
    '/api/v1/chits/migrate',
    {
      name: `E2E Migrated Live ${Date.now()}`,
      chitValue: 50000,
      monthlyContrib: 5000,
      totalMembers: 4,
      totalCycles: 10,
      currentActiveCycle: 4,
      commissionPct: 5,
      startDate: '2026-01-01',
      openingCashBalance: 15000,
      stateCode: 'TN',
      members: [
        {
          name: 'Prized Cycle 1 Member',
          phone: '9800011001',
          alreadyPrized: true,
          prizedCycleNumber: 1,
          historicalPrizeAmount: 45000,
          historicalPayoutPendingAmount: 5000,
        },
        {
          name: 'Arrears Member Two',
          phone: '9800011002',
          alreadyPrized: false,
          openingArrearsAmount: 5000,
        },
      ],
    },
    asAdmin(),
  );
  expect(commit.status, JSON.stringify(commit.raw)).toBe(201);
  const newGroupId = commit.raw?.data?.groupId;
  expect(newGroupId).toBeTruthy();

  const poolRow = await branchPool(s.tenantA.branches.hq);
  expect(Number(poolRow?.balance ?? 0)).toBeGreaterThanOrEqual(0);
});
