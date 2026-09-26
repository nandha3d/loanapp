'use server';

import prisma from '@/lib/db';
import { getUserAppType } from '@/lib/tenant';
import { getPremiumTenantId as getDefaultTenantId } from '../access';
import { getActiveBranchId } from '@/lib/branch';

export async function getBalanceSheetData(asOf: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  const asOfDate = new Date(asOf);

  const lines = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { entry: { tenantId, appType, ...(branchId ? { branchId } : {}), status: 'posted', entryDate: { lte: asOfDate } } },
    _sum: { debit: true, credit: true },
  });

  const accountIds = lines.map((l) => l.accountId);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, classType: true, normalSide: true },
    orderBy: { code: 'asc' },
  });

  const lineMap = new Map(lines.map((l) => [l.accountId, { dr: Number(l._sum.debit ?? 0), cr: Number(l._sum.credit ?? 0) }]));

  const groups: Record<string, Array<{ code: string; name: string; amount: number }>> = { asset: [], liability: [], equity: [] };

  for (const acc of accounts) {
    if (!groups[acc.classType]) continue;
    const bal = lineMap.get(acc.id) ?? { dr: 0, cr: 0 };
    const net = acc.normalSide === 'debit' ? bal.dr - bal.cr : bal.cr - bal.dr;
    groups[acc.classType].push({ code: acc.code, name: acc.name, amount: net });
  }

  const totalAssets = groups.asset.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = groups.liability.reduce((s, a) => s + a.amount, 0);
  const totalEquity = groups.equity.reduce((s, a) => s + a.amount, 0);

  return JSON.parse(JSON.stringify({ groups, totalAssets, totalLiabilities, totalEquity, asOf }));
}
