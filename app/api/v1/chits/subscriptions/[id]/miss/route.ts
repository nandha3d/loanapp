import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const subscription = await prisma.chitSubscription.findFirst({
      where: {
        id,
        member: {
          chitGroup: {
            tenantId: ctx.tenantId,
            ...scopedBranchWhere(ctx),
            deletedAt: null,
          },
        },
      },
      select: { id: true, paidAmount: true },
    });
    if (!subscription) return fail('Subscription not found', 404);
    if (Number(subscription.paidAmount) > 0) {
      return fail('Cannot mark a partially paid subscription as missed', 409);
    }

    const updated = await prisma.chitSubscription.update({
      where: { id },
      data: { status: 'missed' },
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Mark missed failed', 500);
  }
}
