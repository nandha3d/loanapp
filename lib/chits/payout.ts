import { generateChitReceiptNo } from './receipts';
import {
  STANDARD_CASH_DENOMINATIONS,
  formatCashDenominationsSummary,
  normalizeCashDenominations,
  sumCashDenominations,
} from './denominations';

export {
  STANDARD_CASH_DENOMINATIONS,
  formatCashDenominationsSummary,
  normalizeCashDenominations,
  sumCashDenominations,
};

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
  cashDenominations?: Record<string | number, unknown> | string | null;
}) {
  const existingEntry = await tx.accountEntry.findFirst({
    where: {
      tenantId: input.tenantId,
      referenceId: input.auctionId,
      referenceType: 'chit_auction',
      type: 'chit_payout',
    },
  });
  if (existingEntry) throw new Error('Prize payout already posted for this auction');

  const cleanDenoms = normalizeCashDenominations(input.cashDenominations);
  const cashTotal = sumCashDenominations(cleanDenoms);
  if (cleanDenoms && cashTotal > input.amount + 0.01) {
    throw new Error(`Cash denominations total (${cashTotal}) cannot exceed payout amount (${input.amount}).`);
  }

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
      cashDenominationsJson: cleanDenoms ? JSON.stringify(cleanDenoms) : undefined,
      notes: input.notes || undefined,
      issuedById: input.userId,
    },
  });

  // Deduct from branch cash account only for physical cash payouts (MONEY-17)
  if (input.branchId && (input.paymentMode || 'cash') === 'cash') {
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

  return { receiptNo, cashDenominations: cleanDenoms };
}
