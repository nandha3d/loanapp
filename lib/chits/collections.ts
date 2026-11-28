import { calculateChitPayment } from './calculations';
import { calculateGoldWeightCredit } from './engineCalculator';
import { generateChitReceiptNo } from './receipts';
import {
  getCashDenominationMode,
  validateDenominationBreakdown,
  type CashDenominationMode,
} from './denominations';
import type { ChitPaymentMode } from './types';

export async function collectChitSubscriptionPayment(tx: any, input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  branchCode?: string | null;
  subscriptionId: string;
  currentPaidAmount: number;
  dueAmount: number;
  amount: number;
  mode: ChitPaymentMode;
  paymentMode: string;
  referenceNo?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  collectorId: string;
  goldRatePerGram?: number | null;
  isGoldWeightEngine?: boolean;
  denominationBreakdown?: unknown;
  denominationMode?: CashDenominationMode;
}) {
  const calc = calculateChitPayment({
    currentPaidAmount: input.currentPaidAmount,
    incomingAmount: input.amount,
    dueAmount: input.dueAmount,
    mode: input.mode,
  });
  if (calc.receivedDelta <= 0) throw new Error('No new collection amount to post');

  let validatedDenomJson: string | undefined;
  if ((input.paymentMode || 'cash').toLowerCase() === 'cash') {
    const denomMode =
      input.denominationMode ?? (await getCashDenominationMode(tx, input.tenantId));
    if (input.denominationBreakdown != null || denomMode === 'REQUIRED') {
      const checked = validateDenominationBreakdown(
        input.denominationBreakdown,
        calc.receivedDelta,
        denomMode,
      );
      if (checked.breakdown) {
        validatedDenomJson = JSON.stringify(checked.breakdown);
      }
    }
  }

  let gramsCredited: number | null = null;
  if (input.isGoldWeightEngine) {
    if (!input.goldRatePerGram || !(input.goldRatePerGram > 0)) {
      throw new Error('Gold rate per gram (> 0) is required to credit gold weight');
    }
    gramsCredited = calculateGoldWeightCredit({
      paymentAmount: calc.receivedDelta,
      goldRatePerGram: input.goldRatePerGram,
    });
  }

  const receiptNo = await generateChitReceiptNo(tx, {
    tenantId: input.tenantId,
    branchCode: input.branchCode,
    receiptType: 'collection',
  });

  const existingSub =
    gramsCredited != null
      ? await tx.chitSubscription.findUnique({
          where: { id: input.subscriptionId },
          select: { goldGramsCredited: true },
        })
      : null;
  const nextGoldGrams =
    gramsCredited != null
      ? Number((Number(existingSub?.goldGramsCredited ?? 0) + gramsCredited).toFixed(4))
      : null;

  const subscription = await tx.chitSubscription.update({
    where: { id: input.subscriptionId },
    data: {
      paidAmount: calc.newPaidAmount,
      status: calc.status,
      paidAt: calc.status === 'paid' ? new Date() : null,
      collectorId: input.collectorId,
      paymentMode: input.paymentMode,
      lastReceiptNo: receiptNo,
      lastPaymentRefNo: input.referenceNo || null,
      notes: input.notes || null,
      ...(nextGoldGrams != null
        ? {
          goldRateApplied: input.goldRatePerGram,
          goldGramsCredited: nextGoldGrams,
        }
        : {}),
    },
  });

  await tx.chitReceipt.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId || undefined,
      appType: input.appType,
      receiptNo,
      receiptType: 'collection',
      entityType: 'subscription',
      entityId: input.subscriptionId,
      amount: calc.receivedDelta,
      paymentMode: input.paymentMode,
      referenceNo: input.referenceNo || undefined,
      cashDenominationsJson: validatedDenomJson,
      idempotencyKey: input.idempotencyKey || undefined,
      notes: input.notes || undefined,
      issuedById: input.collectorId,
    },
  });

  await tx.accountEntry.create({
    data: {
      tenantId: input.tenantId,
      appType: input.appType,
      entryDate: new Date(),
      type: 'collection',
      category: input.paymentMode || 'cash',
      amount: calc.receivedDelta,
      description: `Chit contribution receipt ${receiptNo}`,
      referenceId: input.subscriptionId,
      referenceType: 'chit_subscription',
      createdBy: input.collectorId,
      branchId: input.branchId || undefined,
    },
  });

  // Credit branch physical cash only when collection was received in cash (MONEY-17)
  if (input.branchId && (input.paymentMode || 'cash') === 'cash') {
    const { chitContributionToBranch } = await import('@/lib/wallet');
    await chitContributionToBranch(tx, {
      tenantId: input.tenantId,
      appType: input.appType,
      branchId: input.branchId,
      amount: calc.receivedDelta,
      refId: input.subscriptionId,
      byUserId: input.collectorId,
    });
  }

  return {
    subscription,
    receiptNo,
    receivedDelta: calc.receivedDelta,
    status: calc.status,
    goldGramsCredited: gramsCredited,
    denominationBreakdown: validatedDenomJson ? JSON.parse(validatedDenomJson) : null,
  };
}
