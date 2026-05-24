import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 20, maxLimit: 100 });

  const where: any = { tenantId: ctx.tenantId, appType: ctx.appType };
  if (status) where.status = status;
  if (ctx.role === 'agent') where.requestedById = ctx.userId;

  try {
    const rows = await prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return ok(data, { nextCursor, limit });
  } catch (e: any) {
    return fail(e?.message ?? 'Approvals failed', 500);
  }
}
