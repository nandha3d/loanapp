import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const now = new Date();
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    
    const from = fromStr || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = toStr || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const lines = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        entry: {
          tenantId: ctx.tenantId,
          status: 'posted',
          entryDate: { gte: fromDate, lte: toDate },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = lines.map((l) => l.accountId);
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, name: true, classType: true, subType: true, normalSide: true, parentId: true },
      orderBy: { code: 'asc' },
    });

    const lineMap = new Map(lines.map((l) => [l.accountId, { dr: Number(l._sum.debit ?? 0), cr: Number(l._sum.credit ?? 0) }]));

    const incomeAccounts: Array<{ code: string; name: string; amount: number }> = [];
    const expenseAccounts: Array<{ code: string; name: string; amount: number }> = [];

    for (const acc of accounts) {
      const bal = lineMap.get(acc.id) ?? { dr: 0, cr: 0 };
      const net = acc.normalSide === 'credit' ? bal.cr - bal.dr : bal.dr - bal.cr;
      if (acc.classType === 'income') {
        incomeAccounts.push({ code: acc.code, name: acc.name, amount: net });
      } else if (acc.classType === 'expense') {
        expenseAccounts.push({ code: acc.code, name: acc.name, amount: net });
      }
    }

    const totalIncome = incomeAccounts.reduce((s, a) => s + a.amount, 0);
    const totalExpense = expenseAccounts.reduce((s, a) => s + a.amount, 0);
    const netProfit = totalIncome - totalExpense;

    return ok({
      incomeAccounts,
      expenseAccounts,
      totalIncome,
      totalExpense,
      netProfit,
      from,
      to,
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
