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

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        deletedAt: null,
        customer: {
          ...scopedBranchWhere(ctx),
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true, phone: true },
        },
        loan: {
          select: { id: true, loanCode: true, status: true, principal: true },
        },
        repoFlaggedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!vehicle) return fail('Vehicle not found', 404);

    return ok(vehicle);
  } catch (e: any) {
    return fail(e?.message ?? 'Vehicle fetch failed', 500);
  }
}
