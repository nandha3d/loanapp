import { roundMoney } from './calculations';
import { generateChitReceiptNo } from './receipts';
import {
  STANDARD_CASH_DENOMINATIONS,
  formatCashDenominationsSummary,
  getCashDenominationMode,
  normalizeCashDenominations,
  sumCashDenominations,
  validateDenominationBreakdown,
  type CashDenominationMode,
} from './denominations';

export {
  STANDARD_CASH_DENOMINATIONS,
  formatCashDenominationsSummary,
  normalizeCashDenominations,
  sumCashDenominations,
};

export interface OverdueCycleItem {
  subscriptionId: string;
  periodNumber: number;
  dueDate: Date | string;
  dueAmount: number;
  paidAmount: number;
  unpaidSubscriptionAmount: number;
  pendingPenaltyAmount: number;
  penalties: Array<{
    penaltyId: string;
    remainingAmount: number;
  }>;
}

export interface ArrearsAllocationEntry {
  subscriptionId: string;
  periodNumber: number;
  subscriptionAllocated: number;
  penaltyAllocated: number;
  penaltiesSettled: Array<{ penaltyId: string; amount: number }>;
  newPaidAmount: number;
  newStatus: 'paid' | 'partial';
}

export interface ArrearsFifoResult {
  grossPrizeAmount: number;
  totalOverdueSubscriptions: number;
  totalOverduePenalties: number;
  maxDeductible: number;
  arrearsDeductedAmount: number;
  penaltyDeductedAmount: number;
  totalOffsetAmount: number;
  netPayableAmount: number;
  waivedPenaltyAmount: number;
  allocations: ArrearsAllocationEntry[];
}

/**
 * Pure FIFO arrears allocator: settles oldest unpaid subscription periods & active
 * penalties first, bounded cleanly by `grossPrizeAmount` and `maxDeductible`.
 */
export function allocateArrearsFifo(input: {
  grossPrizeAmount: number;
  overdueCycles: OverdueCycleItem[];
  deductArrears?: boolean;
  customArrearsAmount?: number | null;
  waivePenalties?: boolean;
}): ArrearsFifoResult {
  const grossPrizeAmount = roundMoney(Math.max(0, Number(input.grossPrizeAmount) || 0));
  const sorted = [...input.overdueCycles].sort((a, b) => a.periodNumber - b.periodNumber);

  const totalOverdueSubscriptions = roundMoney(
    sorted.reduce((s, c) => s + Math.max(0, roundMoney(c.unpaidSubscriptionAmount)), 0),
  );
  const totalOverduePenalties = input.waivePenalties
    ? 0
    : roundMoney(sorted.reduce((s, c) => s + Math.max(0, roundMoney(c.pendingPenaltyAmount)), 0));
  const rawPenaltiesTotal = roundMoney(
    sorted.reduce((s, c) => s + Math.max(0, roundMoney(c.pendingPenaltyAmount)), 0),
  );
  const waivedPenaltyAmount = input.waivePenalties ? rawPenaltiesTotal : 0;

  const maxDeductible = roundMoney(totalOverdueSubscriptions + totalOverduePenalties);
  const deductArrears = input.deductArrears !== false;

  let targetOffset = deductArrears ? Math.min(grossPrizeAmount, maxDeductible) : 0;
  if (deductArrears && input.customArrearsAmount != null) {
    const custom = Number(input.customArrearsAmount);
    if (!Number.isFinite(custom) || custom < 0 || custom > Math.min(grossPrizeAmount, maxDeductible) + 0.01) {
      throw new Error(
        `Custom arrears deduction (${input.customArrearsAmount}) must be between 0 and ${Math.min(grossPrizeAmount, maxDeductible)}.`,
      );
    }
    targetOffset = roundMoney(custom);
  }

  let budget = targetOffset;
  let arrearsDeductedAmount = 0;
  let penaltyDeductedAmount = 0;
  const allocations: ArrearsAllocationEntry[] = [];

  for (const cycle of sorted) {
    if (budget <= 0) break;
    const unpaidSub = Math.max(0, roundMoney(cycle.unpaidSubscriptionAmount));
    const subAlloc = Math.min(budget, unpaidSub);
    budget = roundMoney(budget - subAlloc);
    arrearsDeductedAmount = roundMoney(arrearsDeductedAmount + subAlloc);

    let penAlloc = 0;
    const penaltiesSettled: Array<{ penaltyId: string; amount: number }> = [];
    if (!input.waivePenalties && budget > 0) {
      for (const pen of cycle.penalties) {
        if (budget <= 0) break;
        const penRem = Math.max(0, roundMoney(pen.remainingAmount));
        const pPay = Math.min(budget, penRem);
        if (pPay > 0) {
          penAlloc = roundMoney(penAlloc + pPay);
          budget = roundMoney(budget - pPay);
          penaltyDeductedAmount = roundMoney(penaltyDeductedAmount + pPay);
          penaltiesSettled.push({ penaltyId: pen.penaltyId, amount: pPay });
        }
      }
    }

    if (subAlloc > 0 || penAlloc > 0) {
      const newPaidAmount = roundMoney(Number(cycle.paidAmount) + subAlloc);
      const newStatus: 'paid' | 'partial' =
        newPaidAmount + 0.01 >= Number(cycle.dueAmount) ? 'paid' : 'partial';
      allocations.push({
        subscriptionId: cycle.subscriptionId,
        periodNumber: cycle.periodNumber,
        subscriptionAllocated: subAlloc,
        penaltyAllocated: penAlloc,
        penaltiesSettled,
        newPaidAmount,
        newStatus,
      });
    }
  }

  const totalOffsetAmount = roundMoney(arrearsDeductedAmount + penaltyDeductedAmount);
  const netPayableAmount = Math.max(0, roundMoney(grossPrizeAmount - totalOffsetAmount));

  return {
    grossPrizeAmount,
    totalOverdueSubscriptions,
    totalOverduePenalties,
    maxDeductible,
    arrearsDeductedAmount,
    penaltyDeductedAmount,
    totalOffsetAmount,
    netPayableAmount,
    waivedPenaltyAmount,
    allocations,
  };
}

export interface ChitPayoutAccountingLine {
  accountKey: 'prize_payable' | 'subscriptions_receivable' | 'penalty_income' | 'cash_or_bank' | 'prize_payable_remaining';
  side: 'DEBIT' | 'CREDIT';
  amount: number;
  label: string;
}

/**
 * Pure balanced double-entry plan builder for winner prize settlement & split payout.
 * Always asserts Debits === Credits to paisa precision (ACC-3).
 */
export function buildChitPayoutAccountingLines(input: {
  grossPrizeAmount: number;
  arrearsDeductedAmount: number;
  penaltyDeductedAmount: number;
  disbursedNowAmount: number;
  remainingPayableAfterTranche: number;
  paymentMode: string;
}): ChitPayoutAccountingLine[] {
  const gross = roundMoney(input.grossPrizeAmount);
  const arrears = roundMoney(input.arrearsDeductedAmount);
  const penalty = roundMoney(input.penaltyDeductedAmount);
  const disbursed = roundMoney(input.disbursedNowAmount);
  const remaining = roundMoney(input.remainingPayableAfterTranche);

  const lines: ChitPayoutAccountingLine[] = [
    {
      accountKey: 'prize_payable',
      side: 'DEBIT',
      amount: gross,
      label: 'Chit Prize Payable / Chit Pool',
    },
  ];
  if (arrears > 0) {
    lines.push({
      accountKey: 'subscriptions_receivable',
      side: 'CREDIT',
      amount: arrears,
      label: 'Member Subscriptions Receivable (Payout Offset)',
    });
  }
  if (penalty > 0) {
    lines.push({
      accountKey: 'penalty_income',
      side: 'CREDIT',
      amount: penalty,
      label: 'Penalty Income (Payout Offset)',
    });
  }
  if (disbursed > 0) {
    lines.push({
      accountKey: 'cash_or_bank',
      side: 'CREDIT',
      amount: disbursed,
      label: `${input.paymentMode.toUpperCase()} Payout Disbursement`,
    });
  }
  if (remaining > 0) {
    lines.push({
      accountKey: 'prize_payable_remaining',
      side: 'CREDIT',
      amount: remaining,
      label: 'Remaining Prize Payable Liability',
    });
  }

  const totalDebit = roundMoney(lines.filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0));
  const totalCredit = roundMoney(lines.filter((l) => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced chit payout ledger plan: debit=${totalDebit}, credit=${totalCredit}`);
  }
  return lines;
}

export async function calculateWinnerPayoutSummary(
  db: any,
  tenantId: string,
  auctionId: string,
  options?: {
    deductArrears?: boolean;
    customArrearsAmount?: number | null;
    waivePenalties?: boolean;
  },
) {
  const auction = await db.chitAuction.findFirst({
    where: {
      id: auctionId,
      chitGroup: { tenantId, appType: 'chitfunds', deletedAt: null },
    },
    include: {
      chitGroup: { select: { id: true, name: true, groupCode: true, branchId: true } },
      winnerMember: {
        include: { customer: { select: { id: true, name: true, customerCode: true, phone: true } } },
      },
      payoutDisbursements: { orderBy: { trancheNumber: 'asc' } },
    },
  });
  if (!auction) throw new Error('Auction not found');
  if (!auction.winnerMemberId) throw new Error('Auction winner is not selected yet');

  const grossPrizeAmount = roundMoney(
    Number(auction.grossPrizeAmount ?? auction.prizeAmount ?? 0),
  );
  const disbursements = (auction.payoutDisbursements ?? []).map((d: any) => ({
    id: d.id,
    trancheNumber: d.trancheNumber,
    amount: roundMoney(Number(d.amount)),
    paymentMode: d.paymentMode,
    referenceNumber: d.referenceNumber ?? null,
    denominationBreakdown: d.denominationBreakdown ? JSON.parse(d.denominationBreakdown) : null,
    notes: d.notes ?? null,
    paidAt: d.paidAt,
  }));

  const subs = await db.chitSubscription.findMany({
    where: {
      memberId: auction.winnerMemberId,
      periodNumber: { lte: auction.periodNumber },
    },
    include: {
      penalties: {
        where: { tenantId, status: { in: ['due', 'partial'] } },
      },
    },
    orderBy: { periodNumber: 'asc' },
  });

  const overdueCycles: OverdueCycleItem[] = subs
    .map((s: any) => {
      const due = roundMoney(Number(s.dueAmount));
      const paid = roundMoney(Number(s.paidAmount));
      const unpaidSub = Math.max(0, roundMoney(due - paid));
      const penalties = (s.penalties ?? [])
        .map((p: any) => ({
          penaltyId: p.id,
          remainingAmount: Math.max(0, roundMoney(Number(p.amount) - Number(p.paidAmount))),
        }))
        .filter((p: any) => p.remainingAmount > 0);
      const pendingPen = roundMoney(penalties.reduce((sum: number, p: any) => sum + p.remainingAmount, 0));
      return {
        subscriptionId: s.id,
        periodNumber: s.periodNumber,
        dueDate: s.dueDate,
        dueAmount: due,
        paidAmount: paid,
        unpaidSubscriptionAmount: unpaidSub,
        pendingPenaltyAmount: pendingPen,
        penalties,
      };
    })
    .filter((c: OverdueCycleItem) => c.unpaidSubscriptionAmount > 0 || c.pendingPenaltyAmount > 0);

  const nettingLocked = auction.netPayableAmount != null || disbursements.length > 0;
  if (nettingLocked) {
    const arrearsDeducted = roundMoney(Number(auction.arrearsDeductedAmount ?? 0));
    const penaltyDeducted = roundMoney(Number(auction.penaltyDeductedAmount ?? 0));
    const netPayable = roundMoney(Number(auction.netPayableAmount ?? grossPrizeAmount));
    const totalDisbursed = roundMoney(Number(auction.totalDisbursedAmount ?? 0));
    const remaining = roundMoney(
      Number(auction.remainingPayableAmount ?? Math.max(0, netPayable - totalDisbursed)),
    );
    const savedBreakdown = auction.arrearsBreakdownJson
      ? JSON.parse(auction.arrearsBreakdownJson)
      : [];

    return {
      auctionId: auction.id,
      periodNumber: auction.periodNumber,
      chitGroupId: auction.chitGroupId,
      winnerMemberId: auction.winnerMemberId,
      winnerName: auction.winnerMember?.customer?.name ?? 'Winner',
      winnerTicketNo: auction.winnerMember?.ticketNo ?? String(auction.winnerMember?.memberNumber ?? ''),
      payoutStatus: auction.payoutStatus,
      nettingLocked: true,
      grossPrizeAmount,
      totalOverdueSubscriptions: roundMoney(overdueCycles.reduce((s, c) => s + c.unpaidSubscriptionAmount, 0)),
      totalOverduePenalties: roundMoney(overdueCycles.reduce((s, c) => s + c.pendingPenaltyAmount, 0)),
      maxDeductible: roundMoney(arrearsDeducted + penaltyDeducted),
      arrearsDeductedAmount: arrearsDeducted,
      penaltyDeductedAmount: penaltyDeducted,
      netPayableAmount: netPayable,
      totalDisbursedAmount: totalDisbursed,
      remainingPayableAmount: remaining,
      overdueCycles,
      settledAllocations: savedBreakdown,
      disbursements,
    };
  }

  const fifo = allocateArrearsFifo({
    grossPrizeAmount,
    overdueCycles,
    deductArrears: options?.deductArrears ?? true,
    customArrearsAmount: options?.customArrearsAmount ?? null,
    waivePenalties: options?.waivePenalties ?? false,
  });

  return {
    auctionId: auction.id,
    periodNumber: auction.periodNumber,
    chitGroupId: auction.chitGroupId,
    winnerMemberId: auction.winnerMemberId,
    winnerName: auction.winnerMember?.customer?.name ?? 'Winner',
    winnerTicketNo: auction.winnerMember?.ticketNo ?? String(auction.winnerMember?.memberNumber ?? ''),
    payoutStatus: auction.payoutStatus,
    nettingLocked: false,
    grossPrizeAmount: fifo.grossPrizeAmount,
    totalOverdueSubscriptions: fifo.totalOverdueSubscriptions,
    totalOverduePenalties: fifo.totalOverduePenalties,
    maxDeductible: fifo.maxDeductible,
    arrearsDeductedAmount: fifo.arrearsDeductedAmount,
    penaltyDeductedAmount: fifo.penaltyDeductedAmount,
    netPayableAmount: fifo.netPayableAmount,
    totalDisbursedAmount: 0,
    remainingPayableAmount: fifo.netPayableAmount,
    overdueCycles,
    settledAllocations: fifo.allocations,
    disbursements,
  };
}

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
  idempotencyKey?: string | null;
  cashDenominations?: Record<string | number, unknown> | string | null;
  denominationMode?: CashDenominationMode;
  deductArrears?: boolean;
  customArrearsAmount?: number | null;
  waivePenalties?: boolean;
  disburseNowAmount?: number | null;
}) {
  const idem = input.idempotencyKey?.trim() ? input.idempotencyKey.trim().slice(0, 191) : null;
  if (idem) {
    const existingDisb = await tx.chitPayoutDisbursement.findFirst({
      where: { tenantId: input.tenantId, idempotencyKey: idem },
    });
    if (existingDisb) {
      if (existingDisb.auctionId !== input.auctionId) {
        throw new Error('Idempotency key already used for another auction payout');
      }
      const existingReceipt = await tx.chitReceipt.findFirst({
        where: {
          tenantId: input.tenantId,
          entityType: 'auction',
          entityId: input.auctionId,
          receiptType: 'payout',
          idempotencyKey: idem,
        },
      });
      const auctionRow = await tx.chitAuction.findUnique({ where: { id: input.auctionId } });
      return {
        idempotentReplay: true,
        receiptNo: existingReceipt?.receiptNo ?? null,
        cashDenominations: existingDisb.denominationBreakdown
          ? normalizeCashDenominations(existingDisb.denominationBreakdown)
          : null,
        disbursement: existingDisb,
        auction: auctionRow,
      };
    }
  }

  const auction = await tx.chitAuction.findFirst({
    where: {
      id: input.auctionId,
      chitGroup: { tenantId: input.tenantId, appType: input.appType, deletedAt: null },
    },
    include: {
      payoutDisbursements: { orderBy: { trancheNumber: 'asc' } },
    },
  });
  if (!auction) throw new Error('Auction not found');
  if (!auction.winnerMemberId) throw new Error('Auction winner is missing');

  const summary = await calculateWinnerPayoutSummary(tx, input.tenantId, input.auctionId, {
    deductArrears: input.deductArrears,
    customArrearsAmount: input.customArrearsAmount,
    waivePenalties: input.waivePenalties,
  });

  const paymentMode = (input.paymentMode || 'cash').toLowerCase();
  const isFirstSettlement = !summary.nettingLocked;
  const remainingBefore = summary.remainingPayableAmount;
  const disburseNow = roundMoney(
    input.disburseNowAmount != null ? Number(input.disburseNowAmount) : remainingBefore,
  );

  if (remainingBefore <= 0 && !isFirstSettlement) {
    throw new Error('Prize payout already fully settled for this auction');
  }
  if (disburseNow < 0) {
    throw new Error('Disbursement amount cannot be negative');
  }
  if (disburseNow > remainingBefore + 0.01) {
    throw new Error(
      `Disbursement amount (${disburseNow}) exceeds remaining payable (${remainingBefore})`,
    );
  }
  if (remainingBefore > 0 && disburseNow <= 0) {
    throw new Error('Disbursement amount must be greater than zero when remaining payable is positive');
  }

  // Validate cash denominations if paymentMode is cash
  let validatedDenomJson: string | null = null;
  let legacyDenomMap: Record<number, number> | null = null;
  if (paymentMode === 'cash' && disburseNow > 0) {
    const denomMode =
      input.denominationMode ?? (await getCashDenominationMode(tx, input.tenantId));
    if (input.cashDenominations != null || denomMode === 'REQUIRED') {
      const checked = validateDenominationBreakdown(
        input.cashDenominations,
        disburseNow,
        denomMode,
      );
      if (checked.breakdown) {
        validatedDenomJson = JSON.stringify(checked.breakdown);
        legacyDenomMap = normalizeCashDenominations(checked.breakdown.counts);
      }
    }
  }

  // Verify ledger plan balances on first settlement
  const remainingAfter = Math.max(0, roundMoney(remainingBefore - disburseNow));
  if (isFirstSettlement) {
    buildChitPayoutAccountingLines({
      grossPrizeAmount: summary.grossPrizeAmount,
      arrearsDeductedAmount: summary.arrearsDeductedAmount,
      penaltyDeductedAmount: summary.penaltyDeductedAmount,
      disbursedNowAmount: disburseNow,
      remainingPayableAfterTranche: remainingAfter,
      paymentMode,
    });
  }

  // Step A: Settle overdue subscriptions & penalties in FIFO order on first tranche
  let offsetReceiptNo: string | null = null;
  if (isFirstSettlement && (summary.arrearsDeductedAmount > 0 || summary.penaltyDeductedAmount > 0 || input.waivePenalties)) {
    const settledCycleIds: Array<{ subscriptionId: string; periodNumber: number; subscriptionAllocated: number; penaltyAllocated: number }> = [];
    for (const alloc of summary.settledAllocations) {
      if (alloc.subscriptionAllocated > 0) {
        await tx.chitSubscription.update({
          where: { id: alloc.subscriptionId },
          data: {
            paidAmount: alloc.newPaidAmount,
            status: alloc.newStatus,
            paidAt: alloc.newStatus === 'paid' ? new Date() : undefined,
            paymentMode: 'PAYOUT_ADJUSTMENT',
            settledByAuctionId: input.auctionId,
            collectorId: input.userId,
            notes: `Auto-netted against Period ${input.periodNumber} prize payout`,
          },
        });
      }
      for (const ps of alloc.penaltiesSettled) {
        const penRow = await tx.chitPenalty.findUnique({ where: { id: ps.penaltyId } });
        if (penRow) {
          const nextPaid = roundMoney(Number(penRow.paidAmount) + ps.amount);
          await tx.chitPenalty.update({
            where: { id: ps.penaltyId },
            data: {
              paidAmount: nextPaid,
              status: nextPaid + 0.01 >= Number(penRow.amount) ? 'paid' : 'partial',
            },
          });
        }
      }
      settledCycleIds.push({
        subscriptionId: alloc.subscriptionId,
        periodNumber: alloc.periodNumber,
        subscriptionAllocated: alloc.subscriptionAllocated,
        penaltyAllocated: alloc.penaltyAllocated,
      });
    }

    if (input.waivePenalties) {
      for (const c of summary.overdueCycles) {
        for (const pen of c.penalties) {
          await tx.chitPenalty.update({
            where: { id: pen.penaltyId },
            data: {
              status: 'waived',
              waivedById: input.userId,
              waivedAt: new Date(),
              reason: `Waived during Period ${input.periodNumber} winner payout settlement`,
            },
          });
        }
      }
    }

    const totalOffset = roundMoney(summary.arrearsDeductedAmount + summary.penaltyDeductedAmount);
    if (totalOffset > 0) {
      offsetReceiptNo = await generateChitReceiptNo(tx, {
        tenantId: input.tenantId,
        receiptType: 'payout',
      });
      await tx.chitReceipt.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId || undefined,
          appType: input.appType,
          receiptNo: offsetReceiptNo,
          receiptType: 'payout_adjustment',
          entityType: 'auction',
          entityId: input.auctionId,
          amount: totalOffset,
          paymentMode: 'PAYOUT_ADJUSTMENT',
          notes: `Arrears (${summary.arrearsDeductedAmount}) + Penalty (${summary.penaltyDeductedAmount}) netted from prize`,
          issuedById: input.userId,
        },
      });
      await tx.accountEntry.create({
        data: {
          tenantId: input.tenantId,
          appType: input.appType,
          entryDate: new Date(),
          type: 'chit_payout_adjustment',
          category: 'adjustment',
          amount: totalOffset,
          description: `Chit prize arrears/penalty offset - period ${input.periodNumber}`,
          referenceId: input.auctionId,
          referenceType: 'chit_auction',
          createdBy: input.userId,
          branchId: input.branchId || undefined,
        },
      });
    }
  }

  // Step B: Create disbursement tranche + cash/bank receipt + branch float debit (MONEY-17)
  const trancheNumber = (summary.disbursements?.length ?? 0) + 1;
  const disbursement = await tx.chitPayoutDisbursement.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId || undefined,
      appType: input.appType,
      chitGroupId: auction.chitGroupId,
      auctionId: input.auctionId,
      trancheNumber,
      amount: disburseNow,
      paymentMode,
      referenceNumber: input.referenceNo || null,
      denominationBreakdown: validatedDenomJson,
      idempotencyKey: idem,
      notes: input.notes || null,
      paidByUserId: input.userId,
    },
  });

  let receiptNo: string | null = null;
  if (disburseNow > 0) {
    receiptNo = await generateChitReceiptNo(tx, {
      tenantId: input.tenantId,
      receiptType: 'payout',
    });

    await tx.accountEntry.create({
      data: {
        tenantId: input.tenantId,
        appType: input.appType,
        entryDate: new Date(),
        type: 'chit_payout',
        category: paymentMode,
        amount: disburseNow,
        description: `Chit prize payout (Tranche #${trancheNumber}) - period ${input.periodNumber}`,
        referenceId: disbursement.id,
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
        amount: disburseNow,
        paymentMode,
        referenceNo: input.referenceNo || undefined,
        cashDenominationsJson: validatedDenomJson || undefined,
        idempotencyKey: idem || undefined,
        notes: input.notes || undefined,
        issuedById: input.userId,
      },
    });

    if (input.branchId && paymentMode === 'cash') {
      const { chitPayoutFromBranch } = await import('@/lib/wallet');
      await chitPayoutFromBranch(tx, {
        tenantId: input.tenantId,
        appType: input.appType,
        branchId: input.branchId,
        amount: disburseNow,
        refId: disbursement.id,
        byUserId: input.userId,
      });
    }
  }

  // Step C: Persist cumulative payout balances on ChitAuction
  const newTotalDisbursed = roundMoney(summary.totalDisbursedAmount + disburseNow);
  const newRemaining = Math.max(0, roundMoney(summary.netPayableAmount - newTotalDisbursed));
  const nextPayoutStatus = newRemaining <= 0.01 ? 'paid' : 'partially_paid';
  const nextAuctionStatus = newRemaining <= 0.01 ? 'paid' : 'payout_pending';

  const updatedAuction = await tx.chitAuction.update({
    where: { id: input.auctionId },
    data: {
      grossPrizeAmount: summary.grossPrizeAmount,
      arrearsDeductedAmount: summary.arrearsDeductedAmount,
      penaltyDeductedAmount: summary.penaltyDeductedAmount,
      netPayableAmount: summary.netPayableAmount,
      totalDisbursedAmount: newTotalDisbursed,
      remainingPayableAmount: newRemaining,
      arrearsBreakdownJson: JSON.stringify(
        summary.settledAllocations.map((a: any) => ({
          subscriptionId: a.subscriptionId,
          periodNumber: a.periodNumber,
          subscriptionAllocated: a.subscriptionAllocated,
          penaltyAllocated: a.penaltyAllocated,
        })),
      ),
      payoutStatus: nextPayoutStatus,
      status: nextAuctionStatus,
    },
  });

  return {
    receiptNo: receiptNo ?? offsetReceiptNo,
    offsetReceiptNo,
    disbursement,
    auction: updatedAuction,
    cashDenominations: legacyDenomMap,
    grossPrizeAmount: summary.grossPrizeAmount,
    arrearsDeductedAmount: summary.arrearsDeductedAmount,
    penaltyDeductedAmount: summary.penaltyDeductedAmount,
    netPayableAmount: summary.netPayableAmount,
    totalDisbursedAmount: newTotalDisbursed,
    remainingPayableAmount: newRemaining,
    payoutStatus: nextPayoutStatus,
  };
}
