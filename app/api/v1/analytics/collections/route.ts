import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { startOfBusinessDayUtc, parseBusinessDayUtc } from '@/lib/businessTime';

/**
 * Daily collection totals over a date range. Query: `from`, `to` (ISO dates).
 * Defaults to last 14 days.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const isAgent = ctx.role === 'agent';
  const scopeWhere = isAgent
    ? { agentId: ctx.userId }
    : scopedBranchWhere(ctx);

  const { searchParams } = new URL(req.url);

  const rangeStr = searchParams.get('range');
  let duration = 14;
  if (rangeStr === '7') duration = 7;
  else if (rangeStr === '30') duration = 30;
  else if (rangeStr === '90') duration = 90;
  else if (rangeStr === '365' || rangeStr === '1Y' || rangeStr === '365d') duration = 365;

  const toParam = searchParams.get('to');
  const fromParam = searchParams.get('from');

  const to = toParam ? parseBusinessDayUtc(toParam) : startOfBusinessDayUtc();
  const defaultFrom = new Date(to);
  defaultFrom.setUTCDate(to.getUTCDate() - duration + 1);
  const from = fromParam ? parseBusinessDayUtc(fromParam) : defaultFrom;

  // Re-calculate actual duration based on from/to
  const diffDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  try {
    const dailies = await prisma.dailyCollection.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopeWhere,
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

    const series: Array<{ date: string; expected: number; collected: number; overdue: number }> = [];
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(from);
      d.setUTCDate(from.getUTCDate() + i);
      if (d > to) break;
      const key = d.toISOString().split('T')[0];
      const v = byDay.get(key) ?? { expected: 0, collected: 0 };
      const overdue = Math.max(0, v.expected - v.collected);
      series.push({ date: key, overdue, ...v });
    }

    return ok(series);
  } catch (e: any) {
    return fail(e?.message ?? 'Analytics failed', 500);
  }
}
