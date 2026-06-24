import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { chitContributionToBranch } from '@/lib/wallet';

/**
 * Record a chit subscription payment (contribution) from mobile — parity with the
 * web recordChitPayment. Posts a 'collection' AccountEntry for the newly received
 * delta and credits the branch cash pool so chit cash flows into accounting.
 *
 * POST /api/v1/chits/:id/payments  { memberId, periodNumber, paidAmount }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }
  const { id: chitGroupId } = await params;

  try {
    const body = await req.json();
    const memberId = String(body.memberId || '');
    const periodNumber = Number(body.periodNumber);
    const paidAmount = Number(body.paidAmount);
    if (!memberId || !periodNumber || !(paidAmount >= 0)) {
      return fail('memberId, periodNumber and paidAmount are required', 400);
    }

    // Subscription must belong to a member of this group, in the caller's tenant.
    const sub = await prisma.chitSubscription.findFirst({
      where: {
        memberId,
        periodNumber,
        member: { chitGroupId, chitGroup: { tenantId: ctx.tenantId } },
      },
      include: { member: { include: { chitGroup: { select: { branchId: true } } } } },
    });
    if (!sub) return fail('Subscription not found', 404);

    const branchId = sub.member.chitGroup.branchId;
    const delta = Math.max(0, paidAmount - Number(sub.paidAmount));
    const newStatus = paidAmount >= Number(sub.dueAmount) ? 'paid' : 'partial';

    await prisma.$transaction(async (tx) => {
      await tx.chitSubscription.update({
        where: { id: sub.id },
        data: { paidAmount, status: newStatus, paidAt: new Date() },
      });
      if (delta > 0) {
        await tx.accountEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryDate: new Date(),
            type: 'collection',
            category: 'cash',
            amount: delta,
            description: `Chit contribution — period ${periodNumber}`,
            referenceId: sub.id,
            referenceType: 'chit_subscription',
            createdBy: ctx.userId,
            branchId: branchId || undefined,
          },
        });
        if (branchId) {
          await chitContributionToBranch(tx, { tenantId: ctx.tenantId, branchId, amount: delta, refId: sub.id, byUserId: ctx.userId });
        }
      }
    });

    return ok({ id: sub.id, status: newStatus, paidAmount, delta });
  } catch (e: any) {
    return fail(e?.message ?? 'Chit payment failed', 500);
  }
}
