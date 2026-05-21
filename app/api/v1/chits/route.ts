import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const groups = await prisma.chitGroup.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      include: {
        _count: { select: { members: true, auctions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(groups);
  } catch (e: any) {
    return fail(e?.message ?? 'Chits failed', 500);
  }
}
