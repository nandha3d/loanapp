import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

/**
 * Daily collection totals over a date range. Query: `from`, `to` (ISO dates).
 * Defaults to last 14 days.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(now.getDate() - 13);
  const from = new Date(searchParams.get('from') || defaultFrom);
  const to = new Date(searchParams.get('to') || now);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  try {
    const dailies = await prisma.dailyCollection.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
        date: { gte: from, lte: to },
      },
      select: { date: true, totalExpected: true, totalCollected: true },
      orderBy: { date: 'asc' },
    });

    const byDay = new Map<string, { expected: number; collected: number }>();
    for (const d of dailies) {
      const key = d.date.toISOString().split('T')[0];
      const cur = byDay.get(key) ?? { expected: 0, collected: 0 };
      cur.expected += Number(d.totalExpected);
      cur.collected += Number(d.totalCollected);
      byDay.set(key, cur);
    }

    const series: Array<{ date: string; expected: number; collected: number }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      if (d > to) break;
      const key = d.toISOString().split('T')[0];
      const v = byDay.get(key) ?? { expected: 0, collected: 0 };
      series.push({ date: key, ...v });
    }

    return ok(series);
  } catch (e: any) {
    return fail(e?.message ?? 'Analytics failed', 500);
  }
}
