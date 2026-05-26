'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';

export async function getTrialBalanceData(asOf: string) {
  const tenantId = await getDefaultTenantId();
  const asOfDate = new Date(asOf);

  const lines = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { entry: { tenantId, status: 'posted', entryDate: { lte: asOfDate } } },
    _sum: { debit: true, credit: true },
  });

  const accountIds = lines.map((l) => l.accountId);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, classType: true },
    orderBy: { code: 'asc' },
  });

  const lineMap = new Map(lines.map((l) => [l.accountId, { dr: Number(l._sum.debit ?? 0), cr: Number(l._sum.credit ?? 0) }]));

  const rows = accounts.map((a) => {
    const bal = lineMap.get(a.id) ?? { dr: 0, cr: 0 };
    return { code: a.code, name: a.name, classType: a.classType, debit: bal.dr, credit: bal.cr };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return JSON.parse(JSON.stringify({ rows, totalDebit, totalCredit, asOf }));
}
