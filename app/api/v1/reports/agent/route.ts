import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');
  const from = new Date(searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000));
  const to = new Date(searchParams.get('to') ?? new Date());
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  try {
    const where: any = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
      date: { gte: from, lte: to },
    };
    if (agentId) where.agentId = agentId;

    const collections = await prisma.dailyCollection.findMany({
      where,
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    const byAgent = new Map<string, {
      agentId: string;
      name: string;
      expected: number;
      collected: number;
      entryCount: number;
    }>();
    for (const c of collections) {
      const prev = byAgent.get(c.agentId) ?? {
        agentId: c.agentId,
        name: c.agent.name,
        expected: 0,
        collected: 0,
        entryCount: 0,
      };
      prev.expected += Number(c.totalExpected);
      prev.collected += Number(c.totalCollected);
      prev.entryCount += c.entriesCount;
      byAgent.set(c.agentId, prev);
    }

    return ok({
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
      agents: Array.from(byAgent.values()),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Report failed', 500);
  }
}
