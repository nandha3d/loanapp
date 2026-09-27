import prisma from '@/lib/db';

type BookEntryTotal = { type: string; _sum: { amount: unknown } };

export function summarizeDashboardBookTotals(principal: unknown, entries: BookEntryTotal[]) {
  let currentCapital = 0;
  let totalCollectedAllTime = 0;
  for (const entry of entries) {
    const amount = Number(entry._sum.amount ?? 0);
    if (entry.type === 'capital_add' || entry.type === 'collection') currentCapital += amount;
    else if (entry.type === 'capital_withdraw' || entry.type === 'loan_disburse' || entry.type === 'expense') currentCapital -= amount;
    if (entry.type === 'collection') totalCollectedAllTime = amount;
  }
  return { currentCapital, totalDisbursed: Number(principal ?? 0), totalCollectedAllTime };
}

export async function getDashboardBookTotals(tenantId: string, appType: string, branchId?: string | null) {
  const where = { tenantId, appType, ...(branchId ? { branchId } : {}) };
  const [loans, entries] = await Promise.all([
    prisma.loan.aggregate({ where, _sum: { principal: true } }),
    prisma.accountEntry.groupBy({ by: ['type'], where, _sum: { amount: true } }),
  ]);
  return summarizeDashboardBookTotals(loans._sum.principal, entries);
}
