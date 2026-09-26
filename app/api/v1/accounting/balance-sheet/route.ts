import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { resolveActor } from '@/lib/api/dualAuth';
import { assertPremiumAccountingAccess, PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';

export async function GET(req: NextRequest) {
  const ctx = await resolveActor(req);
  if (!ctx) return fail('Unauthorized', 401);

  try {
    await assertPremiumAccountingAccess(ctx);
    const searchParams = req.nextUrl.searchParams;
    const asOfStr = searchParams.get('asOf');
    const asOf = asOfStr || new Date().toISOString().split('T')[0];
    const asOfDate = new Date(asOf);

    const lines = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        entry: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
          status: 'posted',
          entryDate: { lte: asOfDate },
        },
        account: { tenantId: ctx.tenantId },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = lines.map((l) => l.accountId);
    const accounts = await prisma.account.findMany({
      where: { tenantId: ctx.tenantId, id: { in: accountIds } },
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

    return ok({
      groups,
      totalAssets,
      totalLiabilities,
      totalEquity,
      asOf,
    });
  } catch (e: any) {
    return fail(e.message, e instanceof PremiumAccountingServiceError ? e.status : 500);
  }
}
