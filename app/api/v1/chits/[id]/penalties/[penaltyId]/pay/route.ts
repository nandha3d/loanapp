import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { canCollectChits } from '@/lib/chits/access';
import { generateChitReceiptNo } from '@/lib/chits/receipts';
import { chitContributionToBranch } from '@/lib/wallet';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; penaltyId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!canCollectChits(ctx.role)) return fail('Forbidden', 403);
  const { id, penaltyId } = await params;
  const body = await req.json().catch(() => null) as any;
  const amount = Number(body?.amount || 0);
  if (!(amount > 0)) return fail('Positive amount is required', 400);
  const paymentMode = String(body?.paymentMode || 'cash');

  const penalty = await prisma.chitPenalty.findFirst({
    where: {
      id: penaltyId,
      tenantId: ctx.tenantId,
      subscription: {
        member: {
          chitGroup: { id, tenantId: ctx.tenantId, appType: 'chitfunds', deletedAt: null, ...scopedBranchWhere(ctx) },
        },
      },
    },
    include: { subscription: { include: { member: { include: { chitGroup: true } } } } },
  });
  if (!penalty) return fail('Penalty not found', 404);
  if (penalty.status === 'waived') return fail('Cannot pay a waived penalty', 400);
  const remaining = Math.max(0, Number(penalty.amount) - Number(penalty.paidAmount));
  if (amount > remaining) return fail('Amount exceeds outstanding penalty', 400);

  const result = await prisma.$transaction(async (tx) => {
    const freshPenalty = await tx.chitPenalty.findUnique({ where: { id: penalty.id } });
    if (!freshPenalty || freshPenalty.status === 'waived') throw new Error('Cannot pay a waived penalty');
    const freshRemaining = Math.max(0, Number(freshPenalty.amount) - Number(freshPenalty.paidAmount));
    if (amount > freshRemaining) throw new Error('Amount exceeds outstanding penalty');

    const receiptNo = await generateChitReceiptNo(tx, { tenantId: ctx.tenantId, receiptType: 'penalty' });
    const nextPaid = Number(freshPenalty.paidAmount) + amount;
    const status = nextPaid >= Number(freshPenalty.amount) ? 'paid' : 'partial';
    const updated = await tx.chitPenalty.update({
      where: { id: penalty.id },
      data: { paidAmount: nextPaid, status },
    });
    await tx.chitReceipt.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: penalty.branchId || penalty.subscription.member.chitGroup.branchId || undefined,
        appType: 'chitfunds',
        receiptNo,
        receiptType: 'penalty',
        entityType: 'penalty',
        entityId: penalty.id,
        amount,
        paymentMode,
        referenceNo: body?.referenceNo || undefined,
        notes: body?.notes || undefined,
        issuedById: ctx.userId,
      },
    });
    await tx.accountEntry.create({
      data: {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        entryDate: new Date(),
        type: 'penalty_collection',
        category: paymentMode,
        amount,
        description: `Chit penalty collection ${receiptNo}`,
        referenceId: penalty.id,
        referenceType: 'chit_penalty',
        createdBy: ctx.userId,
        branchId: penalty.branchId || penalty.subscription.member.chitGroup.branchId || undefined,
      },
    });
    const branchId = penalty.branchId || penalty.subscription.member.chitGroup.branchId;
    if (branchId && paymentMode === 'cash') {
      await chitContributionToBranch(tx, {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        branchId,
        amount,
        refId: penalty.id,
        byUserId: ctx.userId,
      });
    }
    return updated;
  });
  return ok(result);
}
