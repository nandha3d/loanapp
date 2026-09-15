import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, branchPool, num, plate, type Session } from './support/harness';
import { loadState, patchState, type AutoRunState } from './support/state';

/**
 * HP origination through the API.
 *
 * Spec 03 proved the calculator produces the right numbers. This file proves
 * the PERSISTED loan carries those numbers and nothing a client claimed (AF-1),
 * that the vehicle and its detail row are written in the same transaction
 * (AF-3), and that the payout moves the branch pool only by its cash leg
 * (MONEY-17) and never below zero (MONEY-16).
 *
 * Reference: vehicleValue 500000, down 100000, 12% flat, 24 months
 *   → principal 400000 · payable 496000 · emi 20666.67 · net payout 390000
 */

let owner: Session;
let admin: Session;
let agentHq: Session;
let s: AutoRunState;

const asAdmin = () => ({ token: admin.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });
const asOwner = () => ({ token: owner.token, appType: 'autofinance', branchId: s.tenantA.branches.hq });

/** Enough cash in the HQ pool that a payout is never refused for the wrong reason. */
async function fundBranch(balance: number) {
  await db().branchCashAccount.upsert({
    where: {
      tenantId_appType_branchId: {
        tenantId: s.tenantA.id,
        appType: 'autofinance',
        branchId: s.tenantA.branches.hq!,
      },
    },
    create: { tenantId: s.tenantA.id, appType: 'autofinance', branchId: s.tenantA.branches.hq!, balance },
    update: { balance },
  });
}

function originationBody(over: {
  customerIndex?: number;
  plateSeq?: number;
  autoFinance?: Record<string, unknown>;
  body?: Record<string, unknown>;
} = {}) {
  return {
    customerId: s.tenantA.customers.hq[over.customerIndex ?? 0],
    tenure: 24,
    startDate: '2026-01-15',
    loanType: 'cheque',
    autoFinance: {
      vehicleValue: 500_000,
      downPayment: 100_000,
      interestRate: 12,
      interestMethod: 'flat',
      insuranceCharge: 5_000,
      documentCharge: 2_000,
      brokerCommission: 3_000,
      ...(over.autoFinance ?? {}),
    },
    vehicle: {
      registrationNo: plate(s.runId, over.plateSeq ?? 100),
      make: 'Bajaj',
      model: 'Pulsar 150',
    },
    ...(over.body ?? {}),
  };
}

async function originate(session: Session, body: Record<string, unknown>, branchId?: string) {
  return api.post('/api/v1/loans', body, {
    token: session.token,
    appType: 'autofinance',
    branchId: branchId ?? s.tenantA.branches.hq,
  });
}

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agentHq = await loginApi(s.tenantA.agentHq!.username, s.password);

  // Two finance partners for the linkage cases. Partner CRUD lives on a server
  // action rather than a v1 route, so these are seeded as fixture.
  const [broker, dealer] = await Promise.all(
    (['broker', 'dealer'] as const).map((type) =>
      db().financePartner.create({
        data: {
          tenantId: s.tenantA.id,
          type,
          name: `${type === 'broker' ? 'Ravi Broker' : 'Sundar Motors'} ${s.runId}`,
          status: 'active',
        },
      }),
    ),
  );
  patchState((state) => {
    state.tenantA.partners = { broker: broker.id, dealer: dealer.id };
  });
  s = loadState();

  await fundBranch(5_000_000);
});

test.afterAll(async () => {
  await closeDb();
});

// ── The happy path ──────────────────────────────────────────────────────────
test('[AUTO-200] A complete HP origination persists the loan, the schedule and the vehicle together', async () => {
  const res = await originate(admin, originationBody({ plateSeq: 100 }));
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loanId = res.data.id ?? res.data.loan?.id;
  expect(loanId, 'the route returns the loan it created').toBeTruthy();

  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  const instalments = await db().instalment.findMany({ where: { loanId }, orderBy: { instalmentNo: 'asc' } });
  const vehicle = await db().vehicle.findFirst({ where: { loanId } });

  expect(instalments, 'AF-3: the schedule is written with the loan').toHaveLength(24);
  expect(vehicle, 'AF-3: so is the financed vehicle').toBeTruthy();
  expect(vehicle!.tenantId).toBe(loan.tenantId);
  expect(vehicle!.appType).toBe('autofinance');

  patchState((state) => {
    state.tenantA.loans.reference = loanId;
    state.tenantA.vehicles.financed = vehicle!.id;
  });
});

test('[AUTO-202] The persisted loan carries the terms the builder computed', async () => {
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loadState().tenantA.loans.reference } });

  expect(num(loan.principal), 'vehicleValue − downPayment').toBe(400_000);
  expect(num(loan.totalPayable)).toBe(496_000);
  expect(num(loan.perInstalment)).toBe(20_666.67);
  expect(loan.deductionType, 'a flat contract is emi_flat').toBe('emi_flat');
  expect(num(loan.disbursed), 'the net payout after the charges were recovered').toBe(390_000);
});

test('[AUTO-204] Each instalment stores its own principal and interest split', async () => {
  const instalments = await db().instalment.findMany({
    where: { loanId: loadState().tenantA.loans.reference },
    orderBy: { instalmentNo: 'asc' },
  });

  for (const row of instalments) {
    const principal = num(row.principalComponent);
    const interest = num(row.interestComponent);
    expect(principal, `instalment ${row.instalmentNo} carries a principal component`).toBeGreaterThan(0);
    expect(
      Math.round((principal + interest) * 100) / 100,
      `instalment ${row.instalmentNo} splits into its own due`,
    ).toBe(num(row.dueAmount));
  }

  const total = instalments.reduce((sum, r) => sum + num(r.dueAmount), 0);
  expect(Math.round(total * 100) / 100, 'the schedule sums to totalPayable').toBe(496_000);
});

test('[AUTO-179] An HP loan is always monthly, whatever the request body says', async () => {
  const res = await originate(
    admin,
    originationBody({ customerIndex: 1, plateSeq: 101, body: { frequency: 'daily' } }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data.id ?? res.data.loan?.id } });
  expect(loan.frequency, 'AF-2: the body value is ignored, not honoured').toBe('monthly');
});

test('[AUTO-180] The stored tenure comes from the generated schedule', async () => {
  const loanId = loadState().tenantA.loans.reference;
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  const count = await db().instalment.count({ where: { loanId } });

  expect(loan.tenure, 'AF-2: tenure is the schedule length').toBe(count);
});

test('[AUTO-128] Client-claimed principal, EMI or total payable are ignored', async () => {
  const res = await originate(
    admin,
    originationBody({
      customerIndex: 2,
      plateSeq: 102,
      body: { principal: 1_000, perInstalment: 1, totalPayable: 1_000 },
    }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loan = await db().loan.findUniqueOrThrow({ where: { id: res.data.id ?? res.data.loan?.id } });
  expect(
    num(loan.principal),
    'AF-1: origination uses the terms the builder returned, not the values a client claimed',
  ).toBe(400_000);
  expect(num(loan.perInstalment)).toBe(20_666.67);
  expect(num(loan.totalPayable)).toBe(496_000);
});

test('[AUTO-203] A diminishing contract is stored as emi_floating', async () => {
  const res = await originate(
    admin,
    originationBody({
      customerIndex: 3,
      plateSeq: 103,
      autoFinance: { interestMethod: 'diminishing' },
    }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loanId = res.data.id ?? res.data.loan?.id;
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  expect(loan.deductionType).toBe('emi_floating');

  const instalments = await db().instalment.findMany({ where: { loanId }, orderBy: { instalmentNo: 'asc' } });
  expect(num(instalments[0].interestComponent), 'one month of interest on the full principal').toBe(4_000);
  expect(
    num(instalments[instalments.length - 1].interestComponent),
    'and materially less by the final instalment',
  ).toBeLessThan(4_000);

  patchState((state) => {
    state.tenantA.loans.diminishing = loanId;
  });
});

// ── Refusals before anything is written ─────────────────────────────────────
test('[AUTO-206] A registration already in the registry is refused before anything is written', async () => {
  const taken = plate(s.runId, 100);
  const loansBefore = await db().loan.count({ where: { tenantId: s.tenantA.id } });

  const res = await originate(admin, originationBody({ customerIndex: 4, plateSeq: 100 }));
  expect(res.status, JSON.stringify(res.raw)).toBe(409);
  expect(String(res.error ?? '')).toContain(taken);

  expect(
    await db().loan.count({ where: { tenantId: s.tenantA.id } }),
    'the wizard reports a clean error rather than failing after the money is booked',
  ).toBe(loansBefore);
});

test('[AUTO-207] The origination path normalises the registration to uppercase', async () => {
  const canonical = plate(s.runId, 104);
  const res = await originate(
    admin,
    originationBody({
      customerIndex: 4,
      body: { vehicle: { registrationNo: canonical.toLowerCase(), make: 'Honda', model: 'Shine' } },
    }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const vehicle = await db().vehicle.findFirstOrThrow({ where: { loanId: res.data.id ?? res.data.loan?.id } });
  expect(vehicle.registrationNo, 'AF-4').toBe(canonical);
});

test('[AUTO-208] A broker from another tenant is refused', async () => {
  const foreign = await db().financePartner.create({
    data: { tenantId: s.tenantB.id, type: 'broker', name: `Foreign Broker ${s.runId}`, status: 'active' },
  });

  const res = await originate(
    admin,
    originationBody({ customerIndex: 5, plateSeq: 105, body: { brokerId: foreign.id } }),
  );
  expect(res.status, 'a crafted id cannot link a loan across tenants').toBe(404);
  expect(String(res.error ?? '')).toMatch(/broker not found/i);
});

test('[AUTO-209] A dealer id that names a broker is refused', async () => {
  const state = loadState();
  const res = await originate(
    admin,
    originationBody({ customerIndex: 5, plateSeq: 106, body: { dealerId: state.tenantA.partners.broker } }),
  );
  expect(res.status, 'the partner type is checked, not just the ownership').toBe(404);
  expect(String(res.error ?? '')).toMatch(/dealer not found/i);
});

test('[AUTO-210] A soft-deleted partner cannot be attached', async () => {
  const state = loadState();
  await db().financePartner.update({
    where: { id: state.tenantA.partners.dealer! },
    data: { deletedAt: new Date() },
  });

  const res = await originate(
    admin,
    originationBody({ customerIndex: 5, plateSeq: 107, body: { dealerId: state.tenantA.partners.dealer } }),
  );
  expect(res.status, 'DB-4').toBe(404);

  await db().financePartner.update({
    where: { id: state.tenantA.partners.dealer! },
    data: { deletedAt: null },
  });
});

test('[AUTO-215] A duplicate voucher reference is refused', async () => {
  const voucherRef = `VCH-${s.runId}`;
  const first = await originate(
    admin,
    originationBody({ customerIndex: 5, plateSeq: 108, body: { voucherRef } }),
  );
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);

  const second = await originate(
    admin,
    originationBody({ customerIndex: 6, plateSeq: 109, body: { voucherRef } }),
  );
  expect(second.status).toBe(409);
  expect(String(second.error ?? '')).toContain(voucherRef);
});

test('[AUTO-129] Every quote refusal surfaces as a 400 through the API', async () => {
  const invalid: Array<[string, Record<string, unknown>]> = [
    ['zero vehicle value', { vehicleValue: 0 }],
    ['down payment above the value', { downPayment: 600_000 }],
    ['negative rate', { interestRate: -5 }],
    ['charges above the payout', { insuranceCharge: 400_000 }],
    ['unsupported payout mode', { payoutMode1: 'crypto', payoutAmount1: 390_000 }],
  ];

  for (const [label, autoFinance] of invalid) {
    const res = await originate(admin, originationBody({ customerIndex: 6, plateSeq: 110, autoFinance }));
    expect(
      res.status,
      `API-4: ${label} is invalid input, not a server fault — got ${res.status} ${JSON.stringify(res.raw)}`,
    ).toBe(400);
  }
});

test('[AUTO-213] An agent cannot originate beyond their own book', async () => {
  const res = await originate(
    agentHq,
    originationBody({ plateSeq: 111, body: { customerId: s.tenantA.customers.erode[0] } }),
  );
  expect([403, 404], `an agent’s reach stops at their own route (got ${res.status})`).toContain(res.status);
});

// ── Money ───────────────────────────────────────────────────────────────────
test('[AUTO-430] A cash disbursement debits the branch pool by its cash leg', async () => {
  await fundBranch(5_000_000);
  const before = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await originate(
    admin,
    originationBody({
      customerIndex: 6,
      plateSeq: 112,
      autoFinance: {
        payoutMode1: 'cash', payoutAmount1: 200_000,
        payoutMode2: 'bank_transfer', payoutAmount2: 190_000,
      },
    }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const after = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);
  expect(
    before - after,
    'MONEY-17: only the cash leg is physical cash — the bank leg never leaves the drawer',
  ).toBe(200_000);
});

test('[AUTO-431] A bank leg does not move physical cash', async () => {
  await fundBranch(5_000_000);
  const before = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);

  const res = await originate(
    admin,
    originationBody({
      customerIndex: 7,
      plateSeq: 113,
      autoFinance: { payoutMode1: 'bank_transfer', payoutAmount1: 390_000 },
    }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  expect(await branchPool(s.tenantA.id, s.tenantA.branches.hq!), 'the pool is untouched').toBe(before);

  const entries = await db().accountEntry.count({
    where: { tenantId: s.tenantA.id, appType: 'autofinance', type: { contains: 'disburse' } },
  });
  expect(entries, 'the GL still records the disbursement').toBeGreaterThan(0);
});

test('[AUTO-155] [AUTO-432] A cash payout larger than the branch pool is refused, not overdrawn', async () => {
  await fundBranch(50_000);
  const loansBefore = await db().loan.count({ where: { tenantId: s.tenantA.id } });

  const res = await originate(
    admin,
    originationBody({
      customerIndex: 7,
      plateSeq: 114,
      autoFinance: { payoutMode1: 'cash', payoutAmount1: 390_000 },
    }),
  );

  const pool = await branchPool(s.tenantA.id, s.tenantA.branches.hq!);
  expect(pool, `MONEY-16: the pool must never go negative (balance ${pool})`).toBeGreaterThanOrEqual(0);
  expect(
    [400, 409],
    `X-14: an insufficient float surfaces as a 409, never a 200 — got ${res.status}`,
  ).toContain(res.status);
  expect(
    await db().loan.count({ where: { tenantId: s.tenantA.id } }),
    'DB-8: no loan, no schedule and no vehicle are left behind',
  ).toBe(loansBefore);
  expect(await db().vehicle.count({ where: { tenantId: s.tenantA.id, registrationNo: plate(s.runId, 114) } })).toBe(0);

  await fundBranch(5_000_000);
});

test('[AUTO-201] Origination is atomic — a duplicate plate leaves nothing behind', async () => {
  const loansBefore = await db().loan.count({ where: { tenantId: s.tenantA.id } });
  const instalmentsBefore = await db().instalment.count();

  const res = await originate(admin, originationBody({ customerIndex: 7, plateSeq: 100 }));
  expect(res.status).toBeGreaterThanOrEqual(400);

  expect(await db().loan.count({ where: { tenantId: s.tenantA.id } })).toBe(loansBefore);
  expect(await db().instalment.count(), 'AF-3: the four-step wizard is one operation').toBe(instalmentsBefore);
});

test('[AUTO-211] The disbursement posts to the cash book and the GL', async () => {
  const entries = await db().accountEntry.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance' },
    select: { type: true, amount: true, referenceType: true },
  });
  expect(entries.length, 'ACC-6: the journey has posted').toBeGreaterThan(0);
  expect(
    entries.every((e) => num(e.amount) >= 0),
    'no entry carries a negative amount — a reversal is its own entry',
  ).toBe(true);
});

test('[AUTO-205] The financed vehicle is linked to its loan', async () => {
  const state = loadState();
  const vehicle = await db().vehicle.findUniqueOrThrow({ where: { id: state.tenantA.vehicles.financed } });
  expect(vehicle.loanId, 'the asset knows which contract secures it').toBe(state.tenantA.loans.reference);

  const list = await api.get('/api/v1/loans?limit=50', asAdmin());
  expect(list.status, JSON.stringify(list.raw)).toBeLessThan(300);
  const rows = Array.isArray(list.data) ? list.data : list.data?.items ?? [];
  const withVehicle = rows.find((l: any) => l.id === state.tenantA.loans.reference);
  expect(withVehicle?.vehicle?.registrationNo, 'the grid shows the vehicle inline').toBeTruthy();
});

test('[AUTO-214] Loan codes are unique within the tenant', async () => {
  const loans = await db().loan.findMany({
    where: { tenantId: s.tenantA.id, appType: 'autofinance' },
    select: { loanCode: true },
  });
  const codes = loans.map((l) => l.loanCode).filter(Boolean);
  expect(codes.length, 'the journey originated several loans').toBeGreaterThan(1);
  expect(new Set(codes).size, 'no two loans share a code').toBe(codes.length);
});
