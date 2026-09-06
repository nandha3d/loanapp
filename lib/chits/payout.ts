import { HttpError } from '@/lib/httpError';
import { generateChitReceiptNo } from './receipts';

export async function releaseChitPrizePayout(tx: any, input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  auctionId: string;
  amount: number;
  periodNumber: number;
  userId: string;
  paymentMode?: string;
  referenceNo?: string | null;
  notes?: string | null;
}) {
  const existingEntry = await tx.accountEntry.findFirst({
    where: {
      tenantId: input.tenantId,
      referenceId: input.auctionId,
      referenceType: 'chit_auction',
      type: 'chit_payout',
    },
  });
  if (existingEntry) throw new HttpError(409, 'Prize payout already posted for this auction');

  const receiptNo = await generateChitReceiptNo(tx, {
    tenantId: input.tenantId,
    receiptType: 'payout',
  });

  await tx.accountEntry.create({
    data: {
      tenantId: input.tenantId,
      appType: input.appType,
      entryDate: new Date(),
      type: 'chit_payout',
      category: input.paymentMode || 'cash',
      amount: input.amount,
      description: `Chit prize payout - period ${input.periodNumber}`,
      referenceId: input.auctionId,
      referenceType: 'chit_auction',
      createdBy: input.userId,
      branchId: input.branchId || undefined,
    },
  });

  await tx.chitReceipt.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId || undefined,
      appType: input.appType,
      receiptNo,
      receiptType: 'payout',
      entityType: 'auction',
      entityId: input.auctionId,
      amount: input.amount,
      paymentMode: input.paymentMode || 'cash',
      referenceNo: input.referenceNo || undefined,
      notes: input.notes || undefined,
      issuedById: input.userId,
    },
  });

  if (input.branchId) {
    const { chitPayoutFromBranch } = await import('@/lib/wallet');
    await chitPayoutFromBranch(tx, {
      tenantId: input.tenantId,
      appType: input.appType,
      branchId: input.branchId,
      amount: input.amount,
      refId: input.auctionId,
      byUserId: input.userId,
    });
  }

  return { receiptNo };
}