import assert from 'node:assert/strict';
import { postBillInTx, BillPostingError } from '../lib/accounting/bills';
import { reviewPremiumApproval, PremiumAccountingServiceError } from '../lib/accounting/premiumMobileService';
import prisma from '../lib/db';

const writes: Array<{ kind: string; data: any }> = [];
const bill = {
  id: 'bill-1', tenantId: 'tenant-1', appType: 'microlending', branchId: 'branch-1',
  billNo: 'B-1', billDate: new Date(2026, 8, 15), totalAmount: 1.01, gstAmount: 0.01,
  vendor: { name: 'Vendor', tenantId: 'tenant-1', appType: 'microlending', branchId: 'branch-1' },
  lines: [{ accountId: 'expense', amount: 1, gstAmount: 0.01, description: 'Supply' }],
};
const accounts = new Map([['2211', 'payable'], ['1410', 'cgst'], ['1420', 'sgst']]);
const tx: any = {
  bill: {
    findFirst: async ({ where }: any) => {
      assert.deepEqual(where, { id: 'bill-1', tenantId: 'tenant-1', appType: 'microlending', branchId: 'branch-1', status: 'pending_approval' });
      return bill;
    },
    updateMany: async ({ where, data }: any) => { writes.push({ kind: 'bill', data: { where, data } }); return { count: 1 }; },
  },
  accountingSettings: { findUnique: async () => ({ postingOverrides: '{"vendor_payable":"2211"}', fiscalYearStartMonth: 4 }) },
  account: {
    findFirst: async ({ where }: any) => ({ id: accounts.get(where.code) }),
    findUnique: async () => ({ tenantId: 'tenant-1' }),
    count: async () => 1,
  },
  journalEntry: {
    findMany: async () => [],
    create: async ({ data }: any) => { writes.push({ kind: 'journal', data }); return { id: 'journal-1' }; },
  },
  accountBalance: { upsert: async ({ create }: any) => { writes.push({ kind: 'balance', data: create }); } },
  accountingAuditLog: { create: async ({ data }: any) => { writes.push({ kind: 'audit', data }); } },
};

async function main() {
  await postBillInTx(tx, {
    tenantId: 'tenant-1', appType: 'microlending', branchId: 'branch-1',
    billId: 'bill-1', actorId: 'reviewer-1', expectedStatus: 'pending_approval',
  });
  const journal = writes.find((write) => write.kind === 'journal')!.data;
  assert.equal(journal.appType, 'microlending');
  assert.equal(journal.branchId, 'branch-1');
  assert.equal(journal.dedupKey, 'bill:tenant-1:bill-1');
  assert.equal(journal.totalDebit, 1.01);
  assert.equal(journal.totalCredit, 1.01);
  assert.deepEqual(journal.lines.create.map((line: any) => [line.accountId, line.debit, line.credit]), [
    ['expense', 1, 0], ['cgst', 0.01, 0], ['sgst', 0, 0], ['payable', 0, 1.01],
  ]);
  assert.equal(writes.filter((write) => write.kind === 'balance').length, 4);
  assert.equal(writes.find((write) => write.kind === 'audit')!.data.appType, 'microlending');
  assert.equal(writes.find((write) => write.kind === 'bill')!.data.data.journalEntryId, 'journal-1');

  tx.bill.findFirst = async ({ where }: any) => where.appType === 'autofinance' ? null : bill;
  await assert.rejects(() => postBillInTx(tx, {
    tenantId: 'tenant-1', appType: 'autofinance', branchId: 'branch-1',
    billId: 'bill-1', actorId: 'reviewer-1', expectedStatus: 'pending_approval',
  }), BillPostingError);

  tx.bill.findFirst = async () => ({ ...bill, vendor: { ...bill.vendor, appType: 'autofinance' } });
  await assert.rejects(() => postBillInTx(tx, {
    tenantId: 'tenant-1', appType: 'microlending', branchId: 'branch-1',
    billId: 'bill-1', actorId: 'reviewer-1', expectedStatus: 'pending_approval',
  }), BillPostingError);

  const subscription = prisma.tenantSubscription as any;
  const approvals = prisma.accountingApproval as any;
  const bills = prisma.bill as any;
  const original = [subscription.findUnique, approvals.findFirst, bills.findFirst];
  try {
    subscription.findUnique = async () => ({ premiumAccountingEnabled: true });
    approvals.findFirst = async ({ where }: any) => {
      assert.equal(where.appType, 'microlending');
      return { id: 'approval-2', entityId: 'bill-1', entityType: 'bill', status: 'pending', level: 2, approverRole: 'developer' };
    };
    bills.findFirst = async () => ({ id: 'bill-1' });
    await assert.rejects(() => reviewPremiumApproval({
      tenantId: 'tenant-for-role-test', appType: 'microlending', branchId: 'branch-1', userId: 'superadmin-1', role: 'superadmin',
    }, { approvalId: 'approval-2', action: 'approve' }), (error: any) =>
      error instanceof PremiumAccountingServiceError && error.status === 403);
  } finally {
    [subscription.findUnique, approvals.findFirst, bills.findFirst] = original;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
