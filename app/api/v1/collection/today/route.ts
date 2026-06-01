import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
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

  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 50, maxLimit: 200 });

  const loanWhere: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) return ok([], { nextCursor: null, limit });
    loanWhere.customer = { routeId: { in: routeIds } };
  }

  try {
    const rows = await prisma.instalment.findMany({
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
                lat: true,
                lng: true,
                route: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return ok(data, { nextCursor, limit });
  } catch (e: any) {
    return fail(e?.message ?? 'Collection list failed', 500);
  }
}
