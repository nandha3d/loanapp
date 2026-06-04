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
    const asOfStr = searchParams.get('asOf');
    const asOf = asOfStr || new Date().toISOString().split('T')[0];
    const asOfDate = new Date(asOf);

    const lines = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: { entry: { tenantId: ctx.tenantId, status: 'posted', entryDate: { lte: asOfDate } } },
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

    return ok({
      rows,
      totalDebit,
      totalCredit,
      asOf,
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
