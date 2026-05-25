import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 20, maxLimit: 100 });

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    deletedAt: null,
    customer: {
      ...scopedBranchWhere(ctx),
    },
  };

  if (q) {
    where.OR = [
      { registrationNo: { contains: q } },
      { make: { contains: q } },
      { model: { contains: q } },
      { customer: { name: { contains: q } } },
    ];
  }

  try {
    const rows = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        registrationNo: true,
        make: true,
        model: true,
        year: true,
        color: true,
        vehicleType: true,
        repoFlag: true,
        insuranceExpiry: true,
        customer: {
          select: { id: true, name: true, customerCode: true },
        },
        loan: {
          select: { id: true, loanCode: true },
        },
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]!.id : null;

    return ok(data, { nextCursor, limit });
  } catch (e: any) {
    return fail(e?.message ?? 'Vehicles list failed', 500);
  }
}
