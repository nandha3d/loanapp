import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { generateChitReceiptNo } from '@/lib/chits/receipts';
import { chitContributionToBranch } from '@/lib/wallet';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; penaltyId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, penaltyId } = await params;
  const body = await req.json().catch(() => null) as any;
  const amount = Number(body?.amount || 0);
  if (!(amount > 0)) return fail('Positive amount is required', 400);

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
  const remaining = Math.max(0, Number(penalty.amount) - Number(penalty.paidAmount));
  if (amount > remaining) return fail('Amount exceeds outstanding penalty', 400);

  const result = await prisma.$transaction(async (tx) => {
    const receiptNo = await generateChitReceiptNo(tx, { tenantId: ctx.tenantId, receiptType: 'penalty' });
    const nextPaid = Number(penalty.paidAmount) + amount;
    const status = nextPaid >= Number(penalty.amount) ? 'paid' : 'partial';
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
        paymentMode: body?.paymentMode || 'cash',
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
        type: 'chit_penalty',
        category: body?.paymentMode || 'cash',
        amount,
        description: `Chit penalty collection ${receiptNo}`,
        referenceId: penalty.id,
        referenceType: 'chit_penalty',
        createdBy: ctx.userId,
        branchId: penalty.branchId || penalty.subscription.member.chitGroup.branchId || undefined,
      },
    });
    const branchId = penalty.branchId || penalty.subscription.member.chitGroup.branchId;
    if (branchId) {
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
