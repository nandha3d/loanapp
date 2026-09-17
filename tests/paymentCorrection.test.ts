import assert from 'node:assert/strict';
import { correctInstalmentPaymentInTx, correctInstalmentPayment } from '../lib/collectionWrite';

async function runTests() {
  console.log('Testing payment correction logic and role restrictions...');

  // 1. Role restrictions: agent cannot directly correct payments
  let agentForbidden = false;
  try {
    await correctInstalmentPayment({
      tenantId: 't1',
      appType: 'microlending',
      userId: 'u_agent',
      branchId: 'b1',
      role: 'agent',
    }, {
      instalmentId: 'inst1',
      correctedAmount: 5000,
    });
  } catch (e: any) {
    if (e.message === 'forbidden') {
      agentForbidden = true;
    }
  }
  assert.equal(agentForbidden, true, 'Agent must be forbidden from calling correctInstalmentPayment directly');

  // 2. Input validation: negative amount must throw invalid_amount
  let invalidAmountCaught = false;
  try {
    const mockTx: any = {};
    await correctInstalmentPaymentInTx(mockTx, {
      tenantId: 't1',
      appType: 'microlending',
      userId: 'u_admin',
      branchId: 'b1',
      role: 'admin',
    }, {
      instalmentId: 'inst1',
      correctedAmount: -100,
    });
  } catch (e: any) {
    if (e.message === 'invalid_amount') {
      invalidAmountCaught = true;
    }
  }
  assert.equal(invalidAmountCaught, true, 'Negative corrected amount must throw invalid_amount');

  // 3. Simulated correction in transaction:
  const mockInstalment = {
    id: 'inst_1',
    instalmentNo: 1,
    loanId: 'loan_1',
    dueAmount: 1000,
    receivedAmount: 1000,
    paymentMode: 'cash',
    remarks: 'Initial cash payment',
    receivedAt: new Date('2026-09-01'),
    collectionEntryId: 'entry_1',
    loan: {
      id: 'loan_1',
      tenantId: 't1',
      appType: 'microlending',
      branchId: 'b1',
      customerId: 'cus_1',
      customer: { routeId: 'r1' },
      status: 'active',
      deductionType: 'emi_flat',
      principal: 10000,
      outstandingPrincipal: 0,
    },
  };

  const dbState = {
    instalment: { ...mockInstalment },
    collectionEntry: {
      id: 'entry_1',
      collectionId: 'daily_1',
      receivedAmount: 1000,
      dueAmount: 1000,
      paymentMode: 'cash',
      remarks: 'Initial cash payment',
    },
    payments: [] as any[],
    auditLogs: [] as any[],
  };

  const mockTx: any = {
    instalment: {
      findUnique: async () => ({ ...dbState.instalment }),
      update: async ({ data }: any) => {
        dbState.instalment = { ...dbState.instalment, ...data };
        return dbState.instalment;
      },
      findMany: async () => [
        {
          id: dbState.instalment.id,
          instalmentNo: 1,
          dueDate: new Date('2026-09-01'),
          dueAmount: dbState.instalment.dueAmount,
          receivedAmount: dbState.instalment.receivedAmount,
          receivedAt: dbState.instalment.receivedAt,
          status: dbState.instalment.receivedAmount >= dbState.instalment.dueAmount ? 'paid' : 'partial',
        },
      ],
    },
    collectionEntry: {
      findUnique: async () => ({ ...dbState.collectionEntry }),
      update: async ({ data }: any) => {
        dbState.collectionEntry = { ...dbState.collectionEntry, ...data };
        return dbState.collectionEntry;
      },
      findMany: async () => [{ ...dbState.collectionEntry }],
    },
    dailyCollection: {
      update: async () => ({}),
    },
    payment: {
      create: async ({ data }: any) => {
        const row = { id: `pay_${dbState.payments.length + 1}`, ...data };
        dbState.payments.push(row);
        return row;
      },
    },
    paymentAllocation: {
      create: async ({ data }: any) => ({ id: 'alloc_1', ...data }),
    },
    auditLog: {
      create: async ({ data }: any) => {
        dbState.auditLogs.push(data);
        return { id: 'audit_1', ...data };
      },
    },
    loan: {
      findUnique: async () => ({
        deductionType: 'emi_flat',
        principal: 10000,
        outstandingPrincipal: 0,
      }),
      update: async () => ({}),
    },
  };

  // Test admin correcting 1,000 -> 10,000 (user's exact scenario)
  const resultUp = await correctInstalmentPaymentInTx(
    mockTx,
    {
      tenantId: 't1',
      appType: 'microlending',
      userId: 'u_admin',
      branchId: 'b1',
      role: 'admin',
    },
    {
      instalmentId: 'inst_1',
      correctedAmount: 10000,
      paymentMode: 'cash',
      remarks: 'Superadmin corrected to 10000',
    },
  );

  assert.equal(resultUp.previousAmount, 1000);
  assert.equal(resultUp.correctedAmount, 10000);
  assert.equal(resultUp.delta, 9000);
  assert.equal(dbState.instalment.receivedAmount, 10000);
  assert.equal(dbState.collectionEntry.receivedAmount, 10000);
  assert.equal(dbState.payments.length, 1);
  assert.equal(dbState.payments[0].amount, 9000);
  assert.equal(dbState.auditLogs.length, 1);
  assert.equal(dbState.auditLogs[0].entityType, 'payment_correction');

  // Test correcting downwards: 10,000 -> 500
  const resultDown = await correctInstalmentPaymentInTx(
    mockTx,
    {
      tenantId: 't1',
      appType: 'microlending',
      userId: 'u_admin',
      branchId: 'b1',
      role: 'admin',
    },
    {
      instalmentId: 'inst_1',
      correctedAmount: 500,
      paymentMode: 'cash',
      remarks: 'Admin reduced to 500',
    },
  );

  assert.equal(resultDown.previousAmount, 10000);
  assert.equal(resultDown.correctedAmount, 500);
  assert.equal(resultDown.delta, -9500);
  assert.equal(dbState.instalment.receivedAmount, 500);
  assert.equal(resultDown.status, 'partial');

  console.log('paymentCorrection.test.ts: ALL ASSERTIONS PASSED ✅');
}

runTests().catch((err) => {
  console.error('paymentCorrection.test.ts failed:', err);
  process.exit(1);
});
