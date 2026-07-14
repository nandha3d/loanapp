import { calculateChitAuction, roundMoney } from './calculations';
import { generateAuctionMinutes } from './auction';
import { generateChitReceiptNo } from './receipts';
import { createChitAudit } from './audit';
import { applyWinnerInterest } from './winnerInterest';

type FinalizeScope = { tenantId: string; appType: string; userId?: string | null };

// Distributes the per-ticket dividend according to the group's configuration.
// ADJUST_NEXT_DUE credits only the immediately following period; ACCUMULATE records
// the accrual on the auction period without touching dues; CASH_PAYOUT additionally
// moves cash out (receipt + account entry + branch wallet debit).
export async function applyDividendDistribution(tx: any, params: {
  scope: FinalizeScope;
  chitGroupId: string;
  periodNumber: number;
  group: {
    branchId?: string | null;
    dividendPolicy: string;
    dividendDistribution: string;
  };
  branchCode?: string | null;
  dividendPerTicket: number;
  winnerTicketNo?: string | null;
}) {
  const { scope, group } = params;
  if (params.dividendPerTicket <= 0) return;

  const members = await tx.chitMember.findMany({
    where: {
      chitGroupId: params.chitGroupId,
      ...(group.dividendPolicy === 'NON_WINNERS_ONLY' && params.winnerTicketNo
        ? { NOT: { ticketNo: params.winnerTicketNo } }
        : {}),
    },
    select: { id: true, ticketShare: true },
  });

  let totalPaidOut = 0;
  for (const member of members) {
    const amount = roundMoney(params.dividendPerTicket * Number(member.ticketShare));
    if (amount <= 0) continue;
    if (group.dividendDistribution === 'ADJUST_NEXT_DUE') {
      await tx.chitSubscription.updateMany({
        where: { memberId: member.id, periodNumber: params.periodNumber + 1, status: { not: 'paid' } },
        data: { dividendAmount: { increment: amount }, dueAmount: { decrement: amount } },
      });
    } else {
      await tx.chitSubscription.updateMany({
        where: { memberId: member.id, periodNumber: params.periodNumber },
        data: { dividendAmount: { increment: amount } },
      });
      totalPaidOut += amount;
    }
  }

  if (group.dividendDistribution === 'CASH_PAYOUT' && totalPaidOut > 0) {
    const receiptNo = await generateChitReceiptNo(tx, {
      tenantId: scope.tenantId,
      branchCode: params.branchCode,
      receiptType: 'dividend_payout',
    });
    await tx.chitReceipt.create({
      data: {
        tenantId: scope.tenantId,
        branchId: group.branchId || undefined,
        appType: scope.appType,
        receiptNo,
        receiptType: 'dividend_payout',
        entityType: 'auction',
        entityId: params.chitGroupId,
        amount: roundMoney(totalPaidOut),
        paymentMode: 'cash',
        notes: `Dividend cash payout — period ${params.periodNumber}, ${members.length} tickets`,
        issuedById: scope.userId || undefined,
      },
    });
    await tx.accountEntry.create({
      data: {
        tenantId: scope.tenantId,
        appType: scope.appType,
        entryDate: new Date(),
        type: 'chit_dividend_payout',
        category: 'cash',
        amount: roundMoney(totalPaidOut),
        description: `Chit dividend payout receipt ${receiptNo}`,
        referenceId: params.chitGroupId,
        referenceType: 'chit_group',
        createdBy: scope.userId || 'system',
        branchId: group.branchId || undefined,
      },
    });
    if (group.branchId) {
      const { chitPayoutFromBranch } = await import('@/lib/wallet');
      await chitPayoutFromBranch(tx, {
        tenantId: scope.tenantId,
        appType: scope.appType,
        branchId: group.branchId,
        amount: roundMoney(totalPaidOut),
        refId: params.chitGroupId,
        byUserId: scope.userId || 'system',
      });
    }
  }
}

// Shared winner-finalization core used by web confirm/draw actions, the mobile
// confirm/draw routes, and the foreman-ticket period-1 auto-resolution.
// Runs inside the caller's transaction and never posts the prize payout —
// that stays behind the security approval gate.
export async function finalizeAuctionInTx(tx: any, params: {
  scope: FinalizeScope;
  auction: { id: string; chitGroupId: string; periodNumber: number; auctionDate: Date };
  group: any;
  branchCode?: string | null;
  selectedBid: { id: string; memberId: string; bidAmount: any };
  winnerName: string;
  winnerTicketNo?: string | null;
  presentCount: number;
  minutesText?: string | null;
  drawEvidence?: string | null;
  auditAction: string;
}) {
  const { scope, auction, group, selectedBid } = params;
  const calc = calculateChitAuction({
    chitValue: Number(group.chitValue),
    prizeAmount: Number(selectedBid.bidAmount),
    commissionPct: Number(group.commissionPct),
    totalMembers: group.totalMembers,
    dividendPolicy: group.dividendPolicy as any,
    commissionBasis: group.commissionBasis as any,
    gstPct: group.gstPct ? Number(group.gstPct) : null,
    dividendRounding: group.dividendRounding,
  });
  const generatedMinutes = generateAuctionMinutes({
    groupName: group.name,
    periodNumber: auction.periodNumber,
    auctionDate: auction.auctionDate,
    totalMembers: group.totalMembers,
    presentCount: params.presentCount,
    winnerName: params.winnerName,
    prizeAmount: calc.prizeAmount,
    bidDiscount: calc.bidDiscount,
    commission: calc.commission,
    dividend: calc.dividend,
  });
  const minutes = [params.minutesText || generatedMinutes, params.drawEvidence]
    .filter(Boolean)
    .join('\n');

  // Demote only a previously selected winner; withdrawn/rejected bids keep their status.
  await tx.chitBid.updateMany({ where: { auctionId: auction.id, status: 'winning' }, data: { status: 'valid' } });
  await tx.chitBid.update({ where: { id: selectedBid.id }, data: { status: 'winning' } });
  const saved = await tx.chitAuction.update({
    where: { id: auction.id },
    data: {
      winnerMemberId: selectedBid.memberId,
      prizeAmount: calc.prizeAmount,
      bidDiscount: calc.bidDiscount,
      commission: calc.commission,
      dividend: calc.dividend,
      gstAmount: calc.gstAmount,
      roundingIncome: calc.roundingIncome,
      status: 'confirmed',
      payoutStatus: 'security_pending',
      completedAt: new Date(),
      confirmedAt: new Date(),
      confirmedById: scope.userId || undefined,
      minutesText: minutes,
    },
  });
  await tx.chitMember.update({ where: { id: selectedBid.memberId }, data: { hasWon: true, wonAt: new Date() } });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId: auction.id,
      type: 'winner',
      message: `${params.winnerName} won at ${calc.prizeAmount}`,
      memberId: selectedBid.memberId,
      amount: calc.prizeAmount,
      createdById: scope.userId || undefined,
    },
  });
  await tx.chitSecurity.create({
    data: {
      tenantId: scope.tenantId,
      branchId: group.branchId,
      chitGroupId: auction.chitGroupId,
      auctionId: auction.id,
      winnerMemberId: selectedBid.memberId,
      status: 'pending',
    },
  });

  await applyDividendDistribution(tx, {
    scope,
    chitGroupId: auction.chitGroupId,
    periodNumber: auction.periodNumber,
    group,
    branchCode: params.branchCode,
    dividendPerTicket: calc.dividend,
    winnerTicketNo: params.winnerTicketNo,
  });

  const winnerInterest = await applyWinnerInterest(tx, {
    chitGroupId: auction.chitGroupId,
    winnerMemberId: selectedBid.memberId,
    wonPeriodNumber: auction.periodNumber,
    group: {
      chitValue: Number(group.chitValue),
      totalMembers: group.totalMembers,
      winnerInterestType: group.winnerInterestType,
      winnerInterestValue: group.winnerInterestValue != null ? Number(group.winnerInterestValue) : null,
      winnerInterestPeriods: group.winnerInterestPeriods,
    },
  });

  await createChitAudit(tx, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    action: params.auditAction,
    entityType: 'chit_auction',
    entityId: auction.id,
    newValue: { winningBidId: selectedBid.id, calc, winnerInterest, drawEvidence: params.drawEvidence || undefined },
  });
  return { calc, auction: saved };
}
