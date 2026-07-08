import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { calculateChitPayment } from '@/lib/chits/calculations';
import { generateChitReceiptNo } from '@/lib/chits/receipts';
import { reverseChitContributionFromBranch } from '@/lib/wallet';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { receiptId } = await params;
  const body = await req.json().catch(() => null) as any;
  const reason = body?.reason?.trim();
  if (!reason) return fail('Reversal reason is required', 400);

  try {
    const receipt = await prisma.chitReceipt.findFirst({
      where: { id: receiptId, tenantId: ctx.tenantId, appType: ctx.appType, status: 'active', ...scopedBranchWhere(ctx) },
    });
    if (!receipt) return fail('Receipt not found', 404);
    const result = await prisma.$transaction(async (tx) => {
      const reversalNo = await generateChitReceiptNo(tx, {
        tenantId: ctx.tenantId,
        receiptType: 'reversal',
      });
      const reversal = await tx.chitReceipt.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: receipt.branchId,
          appType: ctx.appType,
          receiptNo: reversalNo,
          receiptType: 'reversal',
          entityType: receipt.entityType,
          entityId: receipt.entityId,
          amount: receipt.amount,
          paymentMode: receipt.paymentMode,
          referenceNo: receipt.referenceNo,
          notes: reason,
          issuedById: ctx.userId,
        },
      });
      await tx.chitReceipt.update({
        where: { id: receipt.id },
        data: { status: 'reversed', reversedById: ctx.userId, reversedAt: new Date(), reversalReason: reason },
      });
      if (receipt.receiptType === 'collection' && receipt.entityType === 'subscription') {
        const sub = await tx.chitSubscription.findUnique({ where: { id: receipt.entityId } });
        if (sub) {
          const calc = calculateChitPayment({
            currentPaidAmount: Number(sub.paidAmount),
            incomingAmount: Math.max(0, Number(sub.paidAmount) - Number(receipt.amount)),
            dueAmount: Number(sub.dueAmount),
            mode: 'SET_TOTAL_PAID',
          });
          await tx.chitSubscription.update({
            where: { id: sub.id },
            data: { paidAmount: calc.newPaidAmount, status: calc.status, paidAt: calc.status === 'paid' ? sub.paidAt : null },
          });
        }
        if (receipt.branchId) {
          await reverseChitContributionFromBranch(tx, {
            tenantId: ctx.tenantId,
            appType: ctx.appType,
            branchId: receipt.branchId,
            amount: Number(receipt.amount),
            refId: receipt.id,
            byUserId: ctx.userId,
          });
        }
      }
      await tx.accountEntry.create({
        data: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          entryDate: new Date(),
          type: 'reversal',
          category: receipt.paymentMode,
          amount: Number(receipt.amount) * -1,
          description: `Chit receipt reversal ${reversalNo}`,
          referenceId: receipt.id,
          referenceType: 'chit_receipt',
          createdBy: ctx.userId,
          branchId: receipt.branchId || undefined,
        },
      });
      return reversal;
    });
    return ok(result);
  } catch (e: any) {
    return fail(e?.message ?? 'Receipt reversal failed', 500);
  }
}
