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
  const group = await prisma.chitGroup.findFirst({
    where: { id, tenantId: ctx.tenantId, appType: ctx.appType, deletedAt: null, ...scopedBranchWhere(ctx) },
    select: { id: true },
  });
  if (!group) return fail('Chit group not found', 404);
  const penalties = await prisma.chitPenalty.findMany({
    where: { tenantId: ctx.tenantId, subscription: { member: { chitGroupId: id } } },
    include: {
      subscription: {
        include: { member: { include: { customer: { select: { name: true, phone: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return ok(penalties);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id } = await params;
  const body = await req.json().catch(() => null) as any;
  const subscriptionId = String(body?.subscriptionId || '');
  const amount = Number(body?.amount || 0);
  if (!subscriptionId || !(amount > 0)) return fail('subscriptionId and positive amount are required', 400);

  const subscription = await prisma.chitSubscription.findFirst({
    where: {
      id: subscriptionId,
      member: {
        chitGroup: { id, tenantId: ctx.tenantId, appType: ctx.appType, deletedAt: null, ...scopedBranchWhere(ctx) },
      },
    },
    include: { member: { include: { chitGroup: true } } },
  });
  if (!subscription) return fail('Subscription not found', 404);

  const result = await prisma.$transaction(async (tx) => {
    const penalty = await tx.chitPenalty.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: subscription.member.chitGroup.branchId || undefined,
        subscriptionId: subscription.id,
        memberId: subscription.memberId,
        penaltyType: body?.penaltyType || 'late_fee',
        amount,
        reason: body?.reason || undefined,
      },
    });
    await tx.chitSubscription.update({
      where: { id: subscription.id },
      data: {
        penaltyAmount: Number(subscription.penaltyAmount || 0) + amount,
        status: subscription.status === 'paid' ? 'partial' : subscription.status,
      },
    });
    return penalty;
  });
  return ok(result);
}
