import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * GET /api/v1/gps/history/:id?from=ISO&to=ISO&cursor=...&limit=...
 * Returns agent location history in a date range. Admin only.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  if (!['admin', 'superadmin', 'developer'].includes(auth.context.role)) {
    return fail('Forbidden', 403);
  }
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 100, maxLimit: 500 });

  const where: any = { agentId: id, tenantId: auth.context.tenantId };
  if (from || to) {
    where.capturedAt = {};
    if (from) where.capturedAt.gte = new Date(from);
    if (to) where.capturedAt.lte = new Date(to);
  }

  try {
    const rows = await prisma.agentLocationPing.findMany({
      where,
      orderBy: { capturedAt: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return ok(data, { nextCursor, limit });
  } catch (e: any) {
    return fail(e?.message ?? 'GPS history failed', 500);
  }
}
