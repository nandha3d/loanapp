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
  // §7.2 / ROLE-4 — analytics is not an agent capability, and the handler must
  // refuse it server-side rather than relying on the proxy redirect.
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  
  const rangeStr = searchParams.get('range');
  let duration = 14;
  if (rangeStr === '7') duration = 7;
  else if (rangeStr === '30') duration = 30;
  else if (rangeStr === '90') duration = 90;

  const to = new Date(searchParams.get('to') || now);
  
  const defaultFrom = new Date(to);
  defaultFrom.setDate(to.getDate() - duration + 1);
  const from = new Date(searchParams.get('from') || defaultFrom);
  
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  
  // Re-calculate actual duration based on from/to
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

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
    for (let i = 0; i < diffDays; i++) {
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
