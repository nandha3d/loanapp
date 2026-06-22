import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { isCollectionDay } from '@/lib/collectionPolicy';

/**
 * Returns today's instalments grouped by route for the current user.
 * Agents see only their routes; admins see branch-scoped.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  // Anchor "today" to IST (UTC+5:30) so the business day boundary is correct
  // regardless of the server's timezone — matches /api/v1/dashboard logic.
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightUtcMs =
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) -
    IST_OFFSET_MS;
  const today = new Date(istMidnightUtcMs);
  const tomorrow = new Date(istMidnightUtcMs + 24 * 60 * 60 * 1000);

  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 1000, maxLimit: 5000 });

  const loanWhere: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  if (ctx.role === 'agent') {
    loanWhere.customer = buildAgentCustomerAccessWhere({ userId: ctx.userId });
  }

  try {
    const rows = await prisma.instalment.findMany({
      where: {
        loan: loanWhere,
        OR: [
          { dueDate: { gte: today, lt: tomorrow } },
          { status: { in: ['upcoming', 'missed', 'partial'] }, dueDate: { lt: today } },
          // Past-due instalments cleared TODAY — keep the customer visible
          // (grayed) so the agent sees what's already been collected.
          { dueDate: { lt: today }, receivedAt: { gte: today, lt: tomorrow } },
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

    // Frequency-aware: a non-daily loan's overdue rows only surface on its
    // cadence day, so agents aren't sent to weekly/monthly customers every day.
    // Today's dues and today's collections always pass through.
    const visible = rows.filter((r) => {
      const dt = new Date(r.dueDate);
      const dueToday = dt >= today && dt < tomorrow;
      const paidToday =
        r.receivedAt != null &&
        new Date(r.receivedAt) >= today &&
        new Date(r.receivedAt) < tomorrow;
      if (dueToday || paidToday) return true;
      return isCollectionDay(r.loan.frequency, r.dueDate, today);
    });

    const hasMore = visible.length > limit;
    const data = hasMore ? visible.slice(0, limit) : visible;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return ok(data, { nextCursor, limit });
  } catch (e: any) {
    return fail(e?.message ?? 'Collection list failed', 500);
  }
}
