import { expect, test } from '@playwright/test';
import { api, db, closeDb, loginApi, num, type Session } from './support/harness';
import { loadState, patchState, type SecuredRunState } from './support/state';

/**
 * Product finance: the financed item, the three amounts that must reconcile,
 * and custody of a repossessed appliance.
 *
 * invoiceAmount, downPayment and financedAmount are each stored verbatim from
 * the request, so nothing in the route makes them agree with one another or
 * with the loan principal. The repossession route accepts a reason it never
 * stores and coerces any unrecognised status to "active". Both are asserted
 * head-on.
 */

let owner: Session;
let admin: Session;
let agent: Session;
let s: SecuredRunState;

const INVOICE = 60_000;
const DOWN = 10_000;
const FINANCED = 50_000;

const asOwner = () => ({ token: owner.token, appType: 'productfinance', branchId: s.tenantA.branches.hq });
const asAdmin = () => ({ token: admin.token, appType: 'productfinance', branchId: s.tenantA.branches.hq });
const asAgent = () => ({ token: agent.token, appType: 'productfinance', branchId: s.tenantA.branches.hq });

function productLoan(over: {
  seq?: number;
  principal?: number;
  item?: Record<string, unknown>;
  body?: Record<string, unknown>;
} = {}) {
  return {
    customerId: s.tenantA.partners.productCustomer,
    principal: over.principal ?? FINANCED,
    tenure: 12,
    frequency: 'monthly',
    deduction: 14,
    deductionType: 'emi_flat',
    startDate: '2026-01-15',
    loanType: 'cheque',
    productItem: {
      category: 'appliance',
      productName: 'Refrigerator 260L',
      brand: 'Godrej',
      modelNo: 'RT-260',
      serialNo: `SN-${s.runId}-${String(over.seq ?? 1).padStart(3, '0')}`,
      dealerName: 'Sundar Electronics',
      invoiceNo: `INV-${s.runId}-${over.seq ?? 1}`,
      invoiceAmount: INVOICE,
      downPayment: DOWN,
      financedAmount: FINANCED,
      tenureMonths: 12,
      ...(over.item ?? {}),
    },
    ...(over.body ?? {}),
  };
}

async function originate(session: Session, body: Record<string, unknown>, branchId?: string) {
  return api.post('/api/v1/loans', body, {
    token: session.token,
    appType: 'productfinance',
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
        tenantId: s.tenantA.id, appType: 'productfinance', branchId: s.tenantA.branches.hq!,
      },
    },
    create: {
      tenantId: s.tenantA.id, appType: 'productfinance', branchId: s.tenantA.branches.hq!, balance: 5_000_000,
    },
    update: { balance: 5_000_000 },
  });
});

test.afterAll(async () => {
  await closeDb();
});

// ── Capture ─────────────────────────────────────────────────────────────────
test('[PPF-100] A product loan writes its item row in the same transaction', async () => {
  const res = await originate(admin, productLoan({ seq: 1 }));
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const loanId = loanIdOf(res);
  const loan = await db().loan.findUniqueOrThrow({ where: { id: loanId } });
  const item = await db().productFinanceItem.findUnique({ where: { loanId } });

  expect(item, 'the financed item is written with the loan').toBeTruthy();
  expect(item!.tenantId).toBe(loan.tenantId);
  expect(item!.branchId).toBe(loan.branchId);
  expect(loan.appType).toBe('productfinance');
  expect(await db().instalment.count({ where: { loanId } }), 'and the schedule').toBeGreaterThan(0);

  patchState((state) => {
    state.tenantA.loans.product = loanId;
  });
});

test('[PPF-108] The repossession status starts as active', async () => {
  const item = await db().productFinanceItem.findUniqueOrThrow({
    where: { loanId: loadState().tenantA.loans.product },
  });
  expect(item.repossessionStatus).toBe('active');
  expect(item.repossessedAt).toBeNull();
});

test('[PPF-101] One loan finances at most one item row', async () => {
  const loanId = loadState().tenantA.loans.product;
  const existing = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId } });

  await expect(
    db().productFinanceItem.create({
      data: {
        tenantId: s.tenantA.id,
        branchId: s.tenantA.branches.hq,
        loanId,
        customerId: existing.customerId,
        productName: 'Second appliance',
      },
    }),
  ).rejects.toThrow();
});

test('[PPF-102] A product loan without an item block is refused', async () => {
  const body = productLoan({ seq: 2 }) as Record<string, unknown>;
  delete body.productItem;

  const res = await originate(admin, body);
  const loanId = loanIdOf(res);
  const item = loanId ? await db().productFinanceItem.findUnique({ where: { loanId } }) : null;

  expect(
    res.status >= 400 || item !== null,
    `a consumer-durable loan with no durable is an unsecured personal loan wearing the wrong label (status ${res.status})`,
  ).toBe(true);

  if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
});

test('[PPF-104] A serial number is unique within the tenant', async () => {
  const serialNo = `SN-${s.runId}-001`;
  const res = await originate(admin, productLoan({ seq: 9, item: { serialNo } }));
  const loanId = loanIdOf(res);

  const withSerial = await db().productFinanceItem.count({
    where: { tenantId: s.tenantA.id, serialNo },
  });

  expect(
    res.status >= 400 || withSerial === 1,
    `one physical appliance is not collateral for two loans — ${withSerial} rows now carry serial ${serialNo}`,
  ).toBe(true);

  if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
});

// ── Amount integrity ────────────────────────────────────────────────────────
test('[PPF-120] The financed amount is the invoice less the down payment', async () => {
  const res = await originate(
    admin,
    productLoan({ seq: 20, item: { invoiceAmount: INVOICE, downPayment: DOWN, financedAmount: INVOICE } }),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const item = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId: loanIdOf(res) } });
  expect(
    num(item.financedAmount),
    `the request claimed ${INVOICE} financed on a ${INVOICE} invoice with ${DOWN} paid down. Three figures that must reconcile cannot each be accepted independently`,
  ).toBe(FINANCED);

  await db().loan.delete({ where: { id: loanIdOf(res) } }).catch(() => {});
});

test('[PPF-121] The financed amount matches the loan principal', async () => {
  const res = await originate(
    admin,
    productLoan({ seq: 21, principal: FINANCED, item: { financedAmount: 999_999 } }),
  );
  const loanId = loanIdOf(res);
  const item = loanId ? await db().productFinanceItem.findUnique({ where: { loanId } }) : null;
  const loan = loanId ? await db().loan.findUnique({ where: { id: loanId } }) : null;

  expect(
    res.status >= 400 || num(item?.financedAmount) === num(loan?.principal),
    `the item register says ${num(item?.financedAmount)} was financed and the ledger says ${num(loan?.principal)} was lent — they cannot disagree about the same advance`,
  ).toBe(true);

  if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
});

test('[PPF-122] A down payment at or above the invoice is refused', async () => {
  for (const downPayment of [INVOICE, INVOICE + 1_000]) {
    const res = await originate(admin, productLoan({ seq: 22, item: { downPayment } }));
    const loanId = loanIdOf(res);
    const item = loanId ? await db().productFinanceItem.findUnique({ where: { loanId } }) : null;

    expect(
      res.status >= 400 || num(item?.downPayment) < num(item?.invoiceAmount),
      `a down payment of ${downPayment} against a ${INVOICE} invoice leaves nothing to finance`,
    ).toBe(true);

    if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
  }
});

test('[PPF-123] A negative invoice, down payment or financed amount is refused', async () => {
  for (const field of ['invoiceAmount', 'downPayment', 'financedAmount'] as const) {
    const res = await originate(admin, productLoan({ seq: 23, item: { [field]: -1_000 } }));
    const loanId = loanIdOf(res);
    const item = loanId ? await db().productFinanceItem.findUnique({ where: { loanId } }) : null;

    expect(
      res.status >= 400 || num(item?.[field]) >= 0,
      `a negative ${field} must not reach the item register (status ${res.status})`,
    ).toBe(true);

    if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
  }
});

test('[PPF-124] The item tenure matches the loan tenure', async () => {
  const res = await originate(admin, productLoan({ seq: 24, item: { tenureMonths: 6 } }));
  const loanId = loanIdOf(res);
  const item = loanId ? await db().productFinanceItem.findUnique({ where: { loanId } }) : null;
  const loan = loanId ? await db().loan.findUnique({ where: { id: loanId } }) : null;

  expect(
    res.status >= 400 || item?.tenureMonths === loan?.tenure,
    `the item says ${item?.tenureMonths} months and the loan says ${loan?.tenure} — one contract, one term`,
  ).toBe(true);

  if (loanId) await db().loan.delete({ where: { id: loanId } }).catch(() => {});
});

// ── Repossession ────────────────────────────────────────────────────────────
test('[PPF-140] Repossessing an item records the status and the moment', async () => {
  const loanId = loadState().tenantA.loans.product;

  const res = await api.post(
    `/api/v1/loans/${loanId}/product-repossession`,
    { status: 'repossessed', reason: 'Four instalments in arrears' },
    asOwner(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const item = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId } });
  expect(item.repossessionStatus).toBe('repossessed');
  expect(item.repossessedAt, 'the moment is recorded').toBeTruthy();

  const audits = await db().auditLog.count({
    where: { tenantId: s.tenantA.id, entityId: loanId, action: 'product_repossession' },
  });
  expect(audits, 'and the action is audited').toBeGreaterThan(0);
});

test('[PPF-141] The repossession reason is stored on the record, not only in the audit', async () => {
  const loanId = loadState().tenantA.loans.product;
  const item = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId } });

  const readable = JSON.stringify(item);
  expect(
    readable,
    'the route reads body.reason and writes it into the audit newValue only — a recovery clerk should not have to read the audit log to learn why an appliance was taken',
  ).toContain('arrears');
});

test('[PPF-142] An unrecognised status does not silently un-repossess the item', async () => {
  const loanId = loadState().tenantA.loans.product;

  const res = await api.post(
    `/api/v1/loans/${loanId}/product-repossession`,
    { status: 'reposessed', reason: 'typo' },
    asOwner(),
  );
  const item = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId } });

  expect(
    res.status >= 400 || item.repossessionStatus === 'repossessed',
    `anything that is not the literal "repossessed" is coerced to "active", so a single misspelling quietly releases an asset the office is holding (status ${res.status}, item now ${item.repossessionStatus})`,
  ).toBe(true);

  await db().productFinanceItem.update({
    where: { loanId },
    data: { repossessionStatus: 'repossessed', repossessedAt: new Date() },
  });
});

test('[PPF-143] Who may repossess is enforced server-side', async () => {
  const loanId = loadState().tenantA.loans.product;
  await db().productFinanceItem.update({
    where: { loanId },
    data: { repossessionStatus: 'active', repossessedAt: null },
  });

  const res = await api.post(
    `/api/v1/loans/${loanId}/product-repossession`,
    { status: 'repossessed', reason: 'agent attempt' },
    asAgent(),
  );
  const item = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId } });

  expect(
    res.status,
    `ROLE-4: the route requires only that some token authenticates, so a field agent can seize an appliance (got ${res.status})`,
  ).toBe(403);
  expect(item.repossessionStatus).toBe('active');
});

test('[PPF-144] Repossession is scoped to the branch that owns the loan', async () => {
  const erode = await originate(
    owner,
    {
      ...productLoan({ seq: 40 }),
      customerId: s.tenantA.customers.erode[0],
    },
    s.tenantA.branches.erode,
  );
  if (erode.status >= 300) test.skip(true, `the Erode product loan could not be originated: ${JSON.stringify(erode.raw)}`);

  const erodeLoanId = loanIdOf(erode);
  const res = await api.post(
    `/api/v1/loans/${erodeLoanId}/product-repossession`,
    { status: 'repossessed' },
    asAdmin(),
  );
  const item = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId: erodeLoanId } });

  expect(
    res.status,
    `SCOPE-3: the route resolves the loan by id and tenantId alone (got ${res.status})`,
  ).toBe(404);
  expect(item.repossessionStatus, 'the Erode item is untouched').toBe('active');
});

test('[PPF-146] Reactivating a repossessed item clears its repossession date', async () => {
  const loanId = loadState().tenantA.loans.product;
  await db().productFinanceItem.update({
    where: { loanId },
    data: { repossessionStatus: 'repossessed', repossessedAt: new Date() },
  });

  const res = await api.post(
    `/api/v1/loans/${loanId}/product-repossession`,
    { status: 'active', reason: 'Borrower cleared the arrears' },
    asOwner(),
  );
  expect(res.status, JSON.stringify(res.raw)).toBeLessThan(300);

  const item = await db().productFinanceItem.findUniqueOrThrow({ where: { loanId } });
  expect(item.repossessionStatus).toBe('active');
  expect(item.repossessedAt, 'the seizure date is cleared with the seizure').toBeNull();
});

test('[PPF-147] A repossession on a loan with no item is refused cleanly', async () => {
  const state = loadState();
  const propertyLoanId = state.tenantA.loans.property;
  if (!propertyLoanId) test.skip(true, 'the property spec has not run');

  const res = await api.post(`/api/v1/loans/${propertyLoanId}/product-repossession`, {}, asOwner());
  expect(res.status).toBe(404);
  expect(String(res.error ?? '')).toMatch(/product item not found/i);
});

test('[PPF-227] No collateral response carries a password hash, token or secret', async () => {
  const payloads = await Promise.all([
    api.get('/api/v1/loans?limit=20', asAdmin()),
    api.get('/api/v1/customers?limit=20', asAdmin()),
  ]);

  for (const res of payloads) {
    const body = JSON.stringify(res.raw ?? {});
    expect(body, 'X-13: no password hash in a secured-lending payload').not.toMatch(/"password_?[Hh]ash"/);
    expect(body, 'X-13: no token or secret either').not.toMatch(/"(token|secret|apiKey)"\s*:/i);
  }
});

test('[PPF-209] Collateral postings carry their own module appType', async () => {
  const leaked = await db().accountEntry.count({
    where: {
      tenantId: s.tenantA.id,
      appType: { notIn: ['property', 'productfinance'] },
      referenceType: 'loan',
    },
  });
  expect(leaked, 'SCOPE-1: neither module posts into the other’s ledger').toBe(0);
});
