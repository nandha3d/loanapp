import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 30);

  try {
    const agents = await prisma.user.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        role: 'agent',
        status: 'active',
        ...scopedBranchWhere(ctx),
      },
      select: { id: true, name: true },
    });

    const data = await Promise.all(
      agents.map(async (agent) => {
        const dailies = await prisma.dailyCollection.aggregate({
          where: {
            tenantId: ctx.tenantId,
            appType: ctx.appType,
            agentId: agent.id,
            date: { gte: from },
          },
          _sum: { totalExpected: true, totalCollected: true },
        });
        const expected = Number(dailies._sum.totalExpected ?? 0);
        const collected = Number(dailies._sum.totalCollected ?? 0);
        return {
          id: agent.id,
          name: agent.name,
          expected,
          collected,
          hitRate:
            expected > 0 ? Math.round((collected / expected) * 100) : 0,
        };
      }),
    );

    data.sort((a, b) => b.collected - a.collected);
    return ok(data);
  } catch (e: any) {
    return fail(e?.message ?? 'Analytics failed', 500);
  }
}
