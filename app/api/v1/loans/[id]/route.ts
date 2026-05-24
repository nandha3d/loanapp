import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const loan = await prisma.loan.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true, profilePhoto: true } },
      instalments: { orderBy: { instalmentNo: 'asc' } },
      penalties: { orderBy: { createdAt: 'desc' } },
      collaterals: true,
    },
  });
  if (!loan) return fail('Loan not found', 404);
  return ok(loan);
}
