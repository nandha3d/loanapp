import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * GET /api/v1/gps/agent/:id/collections
 * Today's collection entries for an agent — customer name, due, and collected
 * amount. Powers the table under the agent-tracking detail view. Admin only.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  if (!['admin', 'superadmin', 'developer'].includes(auth.context.role)) {
    return fail('Forbidden', 403);
  }
  const { id } = await ctx.params;

  // Date range (inclusive `from`, exclusive `to`). Defaults to today.
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const from = fromParam ? new Date(fromParam) : todayStart;
  const submittedAt: { gte: Date; lt?: Date } = {
    gte: Number.isNaN(from.getTime()) ? todayStart : from,
  };
  if (toParam) {
    const to = new Date(toParam);
    if (!Number.isNaN(to.getTime())) submittedAt.lt = to;
  }

  try {
    const entries = await prisma.collectionEntry.findMany({
      where: {
        tenantId: auth.context.tenantId,
        agentId: id,
        submittedAt,
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        dueAmount: true,
        receivedAmount: true,
        paymentMode: true,
        submittedAt: true,
        customer: { select: { name: true, customerCode: true } },
      },
    });

    return ok(
      entries.map((e) => ({
        id: e.id,
        customerName: e.customer?.name ?? '—',
        customerCode: e.customer?.customerCode ?? '',
        dueAmount: Number(e.dueAmount),
        receivedAmount: Number(e.receivedAmount),
        paymentMode: e.paymentMode,
        submittedAt: e.submittedAt,
      })),
    );
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to fetch agent collections', 500);
  }
}
