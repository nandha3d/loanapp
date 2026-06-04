import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const agentRouteIds = ctx.role === 'agent' ? await getAgentRouteIds(ctx.userId) : [];

    const routes = await prisma.route.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        status: 'active',
        ...scopedBranchWhere(ctx),
        ...(ctx.role === 'agent' ? { id: { in: agentRouteIds.length ? agentRouteIds : ['__none__'] } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const runs = await prisma.collectionRun.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...(ctx.role === 'agent' ? { agentId: ctx.userId } : scopedBranchWhere(ctx)),
      },
      orderBy: { date: 'desc' },
      take: 50,
    });

    return ok({ routes, runs });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load runs', 500);
  }
}
