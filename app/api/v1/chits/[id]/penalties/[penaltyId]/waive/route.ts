import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; penaltyId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, penaltyId } = await params;
  const body = await req.json().catch(() => null) as any;
  const penalty = await prisma.chitPenalty.findFirst({
    where: {
      id: penaltyId,
      tenantId: ctx.tenantId,
      subscription: {
        member: {
          chitGroup: { id, tenantId: ctx.tenantId, appType: ctx.appType, deletedAt: null, ...scopedBranchWhere(ctx) },
        },
      },
    },
    include: { subscription: true },
  });
  if (!penalty) return fail('Penalty not found', 404);
  const remaining = Math.max(0, Number(penalty.amount) - Number(penalty.paidAmount));
  const waiveAmount = Math.min(remaining, Number(body?.amount || remaining));
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.chitPenalty.update({
      where: { id: penalty.id },
      data: {
        status: waiveAmount >= remaining ? 'waived' : 'partial',
        waivedById: ctx.userId,
        waivedAt: new Date(),
        reason: body?.reason || penalty.reason,
      },
    });
    await tx.chitSubscription.update({
      where: { id: penalty.subscriptionId },
      data: {
        penaltyAmount: Math.max(0, Number(penalty.subscription.penaltyAmount || 0) - waiveAmount),
      },
    });
    return updated;
  });
  return ok(result);
}
