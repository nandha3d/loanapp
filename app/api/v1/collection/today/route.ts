import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';

/**
 * Returns today's instalments grouped by route for the current user.
 * Agents see only their routes; admins see branch-scoped.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const loanWhere: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) return ok([]);
    loanWhere.customer = { routeId: { in: routeIds } };
  }

  try {
    const instalments = await prisma.instalment.findMany({
      where: {
        loan: loanWhere,
        OR: [
          { dueDate: { gte: today, lt: tomorrow } },
          { status: { in: ['missed', 'partial'] }, dueDate: { lt: tomorrow } },
        ],
      },
      include: {
        loan: {
          include: {
            customer: {
              select: {
                id: true,
                customerCode: true,
                name: true,
                phone: true,
                routeId: true,
                route: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    });
    return ok(instalments);
  } catch (e: any) {
    return fail(e?.message ?? 'Collection list failed', 500);
  }
}
