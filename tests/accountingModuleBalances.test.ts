import assert from 'node:assert/strict';
import prisma from '../lib/db';
import { getModuleAccountBalances } from '../lib/accounting/queries';

const calls: any[] = [];
const journalLine = prisma.journalLine as any;
const originalGroupBy = journalLine.groupBy;
journalLine.groupBy = async (args: any) => {
  calls.push(args);
  return [
    { accountId: 'cash', _sum: { debit: 150, credit: 50 } },
    { accountId: 'payable', _sum: { debit: 20, credit: 70 } },
  ];
};

async function main() {
try {
  const balances = await getModuleAccountBalances('tenant-a', 'microlending', 'branch-one', new Date(2026, 8, 15));
  assert.deepEqual(balances.get('cash'), { closingDr: 100, closingCr: 0 });
  assert.deepEqual(balances.get('payable'), { closingDr: 0, closingCr: 50 });
  assert.deepEqual(
    { ...calls[0].where.entry, entryDate: undefined },
    { tenantId: 'tenant-a', appType: 'microlending', branchId: 'branch-one', status: 'posted', entryDate: undefined },
  );
  assert.equal(calls[0].where.entry.entryDate.lte.getDate(), 15);

  await getModuleAccountBalances('tenant-a', 'autofinance', null);
  assert.equal(calls[1].where.entry.appType, 'autofinance');
  assert.equal('branchId' in calls[1].where.entry, false);
} finally {
  journalLine.groupBy = originalGroupBy;
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
