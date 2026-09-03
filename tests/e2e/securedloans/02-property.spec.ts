import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, num, surveyNo, type Session } from './support/harness';
import { loadState, patchState, type SecuredRunState } from './support/state';

/**
 * Property collateral: what the mortgage register is allowed to say, and who
 * may change custody of the deed.
 *
 * The origination route stores every property field verbatim from the request,
 * including eligibleLtvPercent and eligibleAmount — the two figures that decide
 * whether the loan is covered. The release route reads the loan only to confirm
 * it exists. Both of those are asserted directly rather than assumed.
 */

let owner: Session;
let admin: Session;
let agent: Session;
let s: SecuredRunState;

const MARKET_VALUE = 5_000_000;
const LTV = 60;
const ELIGIBLE = 3_000_000;

const asOwner = () => ({ token: owner.token, appType: 'property', branchId: s.tenantA.branches.hq });
const asAdmin = () => ({ token: admin.token, appType: 'property', branchId: s.tenantA.branches.hq });
const asAgent = () => ({ token: agent.token, appType: 'property', branchId: s.tenantA.branches.hq });

function propertyLoan(over: {
  customerIndex?: number;
  seq?: number;
  principal?: number;
  property?: Record<string, unknown>;
  body?: Record<string, unknown>;
} = {}) {
  return {
    customerId: s.tenantA.customers.hq[over.customerIndex ?? 0],
    principal: over.principal ?? 2_000_000,
    tenure: 24,
    frequency: 'monthly',
    deduction: 12,
    deductionType: 'emi_flat',
    startDate: '2026-01-15',
    loanType: 'cheque',
    propertyCollateral: {
      propertyType: 'residential',
      address: '12 Market Street, Erode',
      surveyNo: surveyNo(s.runId, over.seq ?? 1),
      extentValue: 2_400,
      extentUnit: 'sqft',
      marketValue: MARKET_VALUE,
      eligibleLtvPercent: LTV,
      eligibleAmount: ELIGIBLE,
      encumbranceStatus: 'clear',
      valuerName: 'R. Valuer',
      valuationDate: '2026-01-10',
      ...(over.property ?? {}),
    },
    ...(over.body ?? {}),
  };
}

async function originate(session: Session, body: Record<string, unknown>, branchId?: string) {
  return api.post('/api/v1/loans', body, {
    token: session.token,
    appType: 'property',
    branchId: branchId ?? s.tenantA.branches.hq,
  });
}

const loanIdOf = (res: any) => res.data?.id ?? res.data?.loan?.id;

test.beforeAll(async () => {
  s = loadState();
  owner = await loginApi(s.tenantA.owner.username, s.password);
  admin = await loginApi(s.tenantA.admin!.username, s.password);
  agent = await loginApi(s.tenantA.agentHq!.username, s.password);

  await db().branchCashAccount.upsert({
    where: {
      tenantId_appType_branchId: {
        tenantId: s.tenantA.id, appType: 'property', branchId: s.tenantA.branches.hq!,
      },
    },
    create: {
      tenantId: s.tenantA.id, appType: 'property', branchId: s.tenantA.branches.hq!, balance: 50_000_000,
    },
    update: { balance: 50_000_000 },
  });
});

test.afterAll(async () => {
  await closeDb();
});

// ── Capture ─────────────────────────────────────────────────────────────────
test('[PPF-020] A property loan writes its collateral row in the same transaction', async () => {
  const res = await originate(admin, propertyLoan({ seq: 1 }));
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loanId = loanIdOf(res);
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  const collateral = await db().propertyCollateral.findUnique({ where: { loanId } });
  const instalments = await db().instalment.count({ where: { loanId } });

  expect(collateral, 'the mortgage is written with the loan').toBeTruthy();
  expect(instalments, 'and so is the schedule').toBeGreaterThan(0);
  expect(collateral!.tenantId).toBe(loan.tenantId);
  expect(collateral!.branchId, 'stamped with the branch that owns the loan').toBe(loan.branchId);

  patchState((state) => {
    state.tenantA.loans.property = loanId;
  });
});

test('[PPF-004] The loan and its collateral carry the property appType', async () => {
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loadState().tenantA.loans.property } });
  expect(loan.appType).toBe('property');

  const leaked = await db().loan.count({
    where: { tenantId: s.tenantA.id, appType: 'microlending', propertyCollateral: { isNot: null } },
  });
  expect(leaked, 'SCOPE-1: no property loan is filed under another module').toBe(0);
});

test('[PPF-031] The mortgage status starts as mortgaged', async () => {
  const collateral = await db().propertyCollateral.findUniqueOrThrow({
    where: { loanId: loadState().tenantA.loans.property },
  });
  expect(collateral.mortgageStatus).toBe('mortgaged');
  expect(collateral.releasedAt).toBeNull();
  expect(collateral.releasedBy).toBeNull();
});

test('[PPF-025] The extent is stored with its unit', async () => {
  const collateral = await db().propertyCollateral.findUniqueOrThrow({
    where: { loanId: loadState().tenantA.loans.property },
  });
  expect(num(collateral.extentValue)).toBe(2_400);
  expect(collateral.extentUnit, 'a bare number without its unit is not a measurement').toBe('sqft');
});

test('[PPF-022] One loan carries at most one property', async () => {
  const loanId = loadState().tenantA.loans.property;
  const existing = await db().propertyCollateral.findUniqueOrThrow({ where: { loanId } });

  await expect(
    db().propertyCollateral.create({
      data: {
        tenantId: s.tenantA.id,
        branchId: s.tenantA.branches.hq,
        loanId,
        customerId: existing.customerId,
        propertyType: 'commercial',
      },
    }),
    'a loan secured twice over is not a state the ledger can express',
  ).rejects.toThrow();
});

test('[PPF-023] A property loan without a property block is refused', async () => {
  const body = propertyLoan({ customerIndex: 1, seq: 2 }) as Record<string, unknown>;
  delete body.propertyCollateral;

  const res = await originate(admin, body);
  const loanId = loanIdOf(res);
  const collateral = loanId ? await db().propertyCollateral.findUnique({ where: { loanId } }) : null;

  expect(
    res.status >= 400 || collateral !== null,
    `GOLD-3 refuses a gold origination with no collateral. The property module accepted one (${res.status}) and stored no mortgage — an unsecured loan wearing a secured label`,
  ).toBe(true);
});

test('[PPF-026] A negative extent or market value is refused', async () => {
  for (const [field, value] of [['extentValue', -2_400], ['marketValue', -5_000_000]] as const) {
    const res = await originate(
      admin,
      propertyLoan({ customerIndex: 2, seq: 10, property: { [field]: value } }),
    );
    const loanId = loanIdOf(res);
    const stored = loanId ? await db().propertyCollateral.findUnique({ where: { loanId } }) : null;

    expect(
      res.status >= 400 || num(stored?.[field as 'extentValue']) >= 0,
      `a negative ${field} must not reach the mortgage register (status ${res.status})`,
    ).toBe(true);

    if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
  }
});

test('[PPF-029] A valuation date in the future is refused', async () => {
  const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const res = await originate(
    admin,
    propertyLoan({ customerIndex: 3, seq: 11, property: { valuationDate: future } }),
  );
  const loanId = loanIdOf(res);
  const stored = loanId ? await db().propertyCollateral.findUnique({ where: { loanId } }) : null;

  expect(
    res.status >= 400 || !stored?.valuationDate || stored.valuationDate <= new Date(),
    'a property cannot have been valued on a day that has not happened',
  ).toBe(true);

  if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
});

// ── Valuation and LTV ───────────────────────────────────────────────────────
test('[PPF-045] The eligible amount is derived, not accepted from the request', async () => {
  const res = await originate(
    admin,
    propertyLoan({
      customerIndex: 4,
      seq: 20,
      property: { marketValue: MARKET_VALUE, eligibleLtvPercent: LTV, eligibleAmount: MARKET_VALUE },
    }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const collateral = await db().propertyCollateral.findUniqueOrThrow({ where: { loanId: loanIdOf(res) } });
  expect(
    num(collateral.eligibleAmount),
    `the request claimed the property supports ${MARKET_VALUE}; at ${LTV}% of a ${MARKET_VALUE} valuation it supports ${ELIGIBLE}. A figure a client sends is never what the register should say the asset covers`,
  ).toBe(ELIGIBLE);

  await db().loan.delete({ where: { id: loanIdOf(res) } }).catch(() => {});
});

test('[PPF-046] A principal above the eligible amount is refused', async () => {
  const res = await originate(
    admin,
    propertyLoan({ customerIndex: 4, seq: 21, principal: 4_000_000 }),
  );

  expect(
    res.status,
    `lending 4000000 against a property the register itself says supports ${ELIGIBLE} is the failure a mortgage register exists to prevent`,
  ).toBeGreaterThanOrEqual(400);

  const loanId = loanIdOf(res);
  if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
});

test('[PPF-047] An eligible LTV above 100 is refused', async () => {
  const res = await originate(
    admin,
    propertyLoan({ customerIndex: 5, seq: 22, property: { eligibleLtvPercent: 150 } }),
  );
  const loanId = loanIdOf(res);
  const stored = loanId ? await db().propertyCollateral.findUnique({ where: { loanId } }) : null;

  expect(
    res.status >= 400 || num(stored?.eligibleLtvPercent) <= 100,
    'no configuration lends more than the asset is worth',
  ).toBe(true);

  if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
});

test('[PPF-050] The applied LTV is snapshotted on the collateral row', async () => {
  const collateral = await db().propertyCollateral.findUniqueOrThrow({
    where: { loanId: loadState().tenantA.loans.property },
  });
  expect(num(collateral.eligibleLtvPercent), 'GOLD-4: the pledge keeps the terms it was made on').toBe(LTV);
  expect(num(collateral.marketValue)).toBe(MARKET_VALUE);
});

// ── Release ─────────────────────────────────────────────────────────────────
test('[PPF-066] A mortgage cannot be released while the loan is still outstanding', async () => {
  const loanId = loadState().tenantA.loans.property;
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  expect(loan.status, 'the fixture loan is still live').not.toBe('closed');

  const res = await api.post(`/api/v1/loans/${loanId}/property-release`, {}, asOwner());
  const collateral = await db().propertyCollateral.findUniqueOrThrow({ where: { loanId } });

  expect(
    res.status >= 400 || collateral.mortgageStatus === 'mortgaged',
    `the release route reads the loan only to confirm it exists — it never checks the status or the balance, so a title deed can be handed back on a fully outstanding debt (status ${res.status}, mortgage now ${collateral.mortgageStatus})`,
  ).toBe(true);

  // Put the fixture back for the cases that follow.
  await db().propertyCollateral.update({
    where: { loanId },
    data: { mortgageStatus: 'mortgaged', releasedAt: null, releasedBy: null },
  });
});

test('[PPF-067] Who may release a mortgage is enforced server-side', async () => {
  const loanId = loadState().tenantA.loans.property;

  const res = await api.post(`/api/v1/loans/${loanId}/property-release`, {}, asAgent());
  const collateral = await db().propertyCollateral.findUniqueOrThrow({ where: { loanId } });

  expect(
    res.status,
    `ROLE-4: the route requires only that some token authenticates, so a field agent can hand back a title deed (got ${res.status})`,
  ).toBe(403);
  expect(collateral.mortgageStatus).toBe('mortgaged');

  await db().propertyCollateral.update({
    where: { loanId },
    data: { mortgageStatus: 'mortgaged', releasedAt: null, releasedBy: null },
  });
});

test('[PPF-068] A release is scoped to the branch that owns the loan', async () => {
  const erode = await originate(
    owner,
    { ...propertyLoan({ seq: 30 }), customerId: s.tenantA.customers.erode[0] },
    s.tenantA.branches.erode,
  );
  expect(erode.status, JSON.stringify(erode.raw)).toBeLessThan(300);
  const erodeLoanId = loanIdOf(erode);
  patchState((state) => {
    state.tenantA.loans.propertyErode = erodeLoanId;
  });

  const res = await api.post(`/api/v1/loans/${erodeLoanId}/property-release`, {}, asAdmin());
  const collateral = await db().propertyCollateral.findUniqueOrThrow({ where: { loanId: erodeLoanId } });

  expect(
    res.status,
    `SCOPE-3: the route resolves the loan by id and tenantId alone — no appType, no branch filter (got ${res.status})`,
  ).toBe(404);
  expect(collateral.mortgageStatus, 'the Erode mortgage is untouched').toBe('mortgaged');
});

test('[PPF-072] A loan from another tenant cannot be released', async () => {
  const foreign = await db().loan.findFirst({ where: { tenantId: s.tenantB.id } });
  const probe = foreign?.id ?? 'loan_that_does_not_exist';

  const res = await api.post(`/api/v1/loans/${probe}/property-release`, {}, asOwner());
  expect(res.status, 'API-5: existence is not confirmed').toBe(404);
});

test('[PPF-070] A release on a loan with no property is refused cleanly', async () => {
  const plain = await originate(
    admin,
    (() => {
      const body = propertyLoan({ customerIndex: 5, seq: 31 }) as Record<string, unknown>;
      delete body.propertyCollateral;
      return body;
    })(),
  );
  const loanId = loanIdOf(plain);
  if (!loanId) test.skip(true, 'the collateral-free origination was refused, which PPF-023 already covers');

  const res = await api.post(`/api/v1/loans/${loanId}/property-release`, {}, asOwner());
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/property collateral not found/i);
});

test('[PPF-065] [PPF-069] A release records who and when, and does not rewrite itself', async () => {
  const loanId = loadState().tenantA.loans.property;
  await db().loan.update({ where: { id: loanId }, data: { status: 'closed', closedAt: new Date() } });

  const first = await api.post(`/api/v1/loans/${loanId}/property-release`, {}, asOwner());
  expect(first.status, JSON.stringify(first.raw)).toBeLessThan(300);

  const released = await db().propertyCollateral.findUniqueOrThrow({ where: { loanId } });
  expect(released.mortgageStatus).toBe('released');
  expect(released.releasedAt, 'the moment is recorded').toBeTruthy();
  expect(released.releasedBy, 'and the officer').toBe(s.tenantA.owner.id);

  const firstAt = released.releasedAt!.toISOString();
  const second = await api.post(`/api/v1/loans/${loanId}/property-release`, {}, asAdmin());
  const after = await db().propertyCollateral.findUniqueOrThrow({ where: { loanId } });

  expect(
    second.status >= 400 || after.releasedAt!.toISOString() === firstAt,
    `releasing twice re-stamps releasedAt and releasedBy, so the record of who actually handed back the deed is overwritten by whoever clicked last (second call ${second.status}; releasedBy now ${after.releasedBy})`,
  ).toBe(true);
});

test('[PPF-088] Documents survive a release', async () => {
  const collateral = await db().propertyCollateral.findUniqueOrThrow({
    where: { loanId: loadState().tenantA.loans.property },
  });
  expect(collateral.mortgageStatus).toBe('released');
  expect(
    collateral.surveyNo,
    'a released mortgage still has to be evidenced years later',
  ).toBeTruthy();
});

test('[PPF-206] Switching branch switches the secured surface', async () => {
  const state = loadState();

  const hq = await api.get('/api/v1/loans?limit=50', asAdmin());
  const hqIds = (Array.isArray(hq.data) ? hq.data : hq.data?.items ?? []).map((l: any) => l.id);
  expect(hqIds, 'SCOPE-3: the Erode loan is out of scope').not.toContain(state.tenantA.loans.propertyErode);
});
