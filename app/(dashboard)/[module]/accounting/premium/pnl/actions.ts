'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';

export async function getPnLData(from: string, to: string) {
  const tenantId = await getDefaultTenantId();
  const branchId = await getActiveBranchId();
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Get all posted journal lines in date range, grouped by account
  const lines = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      entry: {
        tenantId,
        status: 'posted',
        entryDate: { gte: fromDate, lte: toDate },
        ...(branchId ? { branchId } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  // Get account details for those accounts
  const accountIds = lines.map((l) => l.accountId);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, classType: true, subType: true, normalSide: true, parentId: true },
    orderBy: { code: 'asc' },
  });

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const lineMap = new Map(lines.map((l) => [l.accountId, { dr: Number(l._sum.debit ?? 0), cr: Number(l._sum.credit ?? 0) }]));

  // Compute net for each account (positive = in normal direction)
  const incomeAccounts: Array<{ code: string; name: string; amount: number }> = [];
  const expenseAccounts: Array<{ code: string; name: string; amount: number }> = [];

  for (const acc of accounts) {
    const bal = lineMap.get(acc.id) ?? { dr: 0, cr: 0 };
    const net = acc.normalSide === 'credit' ? bal.cr - bal.dr : bal.dr - bal.cr;
    if (acc.classType === 'income') incomeAccounts.push({ code: acc.code, name: acc.name, amount: net });
    else if (acc.classType === 'expense') expenseAccounts.push({ code: acc.code, name: acc.name, amount: net });
  }

  const totalIncome = incomeAccounts.reduce((s, a) => s + a.amount, 0);
  const totalExpense = expenseAccounts.reduce((s, a) => s + a.amount, 0);
  const netProfit = totalIncome - totalExpense;

  return JSON.parse(JSON.stringify({ incomeAccounts, expenseAccounts, totalIncome, totalExpense, netProfit, from, to }));
}
