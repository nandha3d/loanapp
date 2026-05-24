import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 50, maxLimit: 100 });

  const where: any = {
    loan: {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
    },
  };
  const status = searchParams.get('status');
  if (status) where.status = status;

  try {
    const rows = await prisma.penalty.findMany({
      where,
      include: {
        loan: {
          select: {
            id: true,
            loanCode: true,
            customer: { select: { id: true, customerCode: true, name: true } },
          },
        },
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
    return fail(e?.message ?? 'Penalties failed', 500);
  }
}
