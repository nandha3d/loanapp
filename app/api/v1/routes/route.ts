import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

function routeBranchScope(ctx: { role: string; branchId: string | null }) {
  const branchWhere = scopedBranchWhere(ctx as any);
  if (!branchWhere.branchId) return {};
  return { OR: [{ branchId: branchWhere.branchId }, { branchId: null }] };
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const routes = await prisma.route.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...routeBranchScope(ctx),
        ...(ctx.role === 'agent'
          ? {
              OR: [
                { assignedAgentId: ctx.userId },
                { routeAgents: { some: { agentId: ctx.userId } } },
              ],
            }
          : {}),
      },
      include: {
        assignedAgent: { select: { id: true, name: true, phone: true } },
        _count: { select: { customers: true } },
      },
      orderBy: { name: 'asc' },
    });
    return ok(routes);
  } catch (e: any) {
    return fail(e?.message ?? 'Routes failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    if (!body.name?.trim()) return fail('Route name required', 400);

    const route = await prisma.route.create({
      data: {
        tenantId: ctx.tenantId,
        branchId:
          ctx.role === 'admin'
            ? ctx.branchId
            : (body.branchId ?? ctx.branchId ?? null),
        name: body.name.trim(),
        assignedAgentId: body.assignedAgentId ?? null,
        appType: ctx.appType,
        status: 'active',
      },
    });
    return ok(route);
  } catch (e: any) {
    return fail(e?.message ?? 'Route create failed', 500);
  }
}
