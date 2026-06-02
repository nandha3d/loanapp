import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer', 'agent'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
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
    const penalties = await prisma.penalty.findMany({
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
    });
    return ok(penalties);
  } catch (e: any) {
    return fail(e?.message ?? 'Penalties failed', 500);
  }
}
