import { roundMoney } from './calculations';
import { generateAuctionMinutes } from './auction';
import { generateChitReceiptNo } from './receipts';
import { createChitAudit } from './audit';
import { applyWinnerInterest } from './winnerInterest';
import {
  calculateChitPeriodEngine,
  type ChitPeriodCalculationBreakdown,
} from './engineCalculator';
import { parseChitEngineConfig, resolveEngineTypeFromGroup } from './engineTypes';
import { postRoomSettlementCard } from './groupRoom';

type FinalizeScope = { tenantId: string; appType: string; userId?: string | null };

// Distributes the per-ticket dividend according to the group's configuration.
// ADJUST_NEXT_DUE credits only the immediately following period; ACCUMULATE and
// DEFERRED_BONUS_POOL record accruals without cash movement; CASH_PAYOUT moves cash.
export async function applyDividendDistribution(
  tx: any,
  params: {
    scope: FinalizeScope;
    chitGroupId: string;
    auctionId?: string;
    periodNumber: number;
    group: {
      branchId?: string | null;
      dividendPolicy: string;
      dividendDistribution: string;
    };
    branchCode?: string | null;
    dividendPerTicket: number;
    winnerTicketNo?: string | null;
    memberDividendMap?: Map<string, { dividend: number; deferred: number; forfeited: boolean }>;
  },
) {
  const { scope, group } = params;
  if (params.dividendPerTicket <= 0 && !params.memberDividendMap) return;
  if (group.dividendPolicy === 'NONE' || group.dividendDistribution === 'NONE') return;

  const members = await tx.chitMember.findMany({
    where: {
      chitGroupId: params.chitGroupId,
      ...(group.dividendPolicy === 'NON_WINNERS_ONLY' && params.winnerTicketNo && !params.memberDividendMap
        ? { NOT: { ticketNo: params.winnerTicketNo } }
        : {}),
    },
    select: { id: true, ticketShare: true },
  });

  let totalPaidOut = 0;
  let eligibleTicketCount = 0;

  for (const member of members) {
    const mapped = params.memberDividendMap?.get(member.id);
    if (mapped?.forfeited) {
      await tx.chitSubscription.updateMany({
        where: { memberId: member.id, periodNumber: params.periodNumber },
        data: { dividendForfeited: true },
      });
      continue;
    }

    const amount = mapped ? mapped.dividend : roundMoney(params.dividendPerTicket * Number(member.ticketShare));
    if (amount <= 0) continue;
    eligibleTicketCount++;

    if (group.dividendDistribution === 'ADJUST_NEXT_DUE') {
      const nextSubs = await tx.chitSubscription.findMany({
        where: { memberId: member.id, periodNumber: params.periodNumber + 1, status: { not: 'paid' } },
        select: { id: true, dueAmount: true },
      });
      for (const sub of nextSubs) {
        await tx.chitSubscription.update({
          where: { id: sub.id },
          data: {
            dividendAmount: { increment: amount },
            dueAmount: Math.max(0, roundMoney(Number(sub.dueAmount) - amount)),
          },
        });
      }
    } else if (group.dividendDistribution === 'DEFERRED_BONUS_POOL') {
      await tx.chitSubscription.updateMany({
        where: { memberId: member.id, periodNumber: params.periodNumber },
        data: {
          dividendAmount: { increment: amount },
          deferredDividendAmount: { increment: amount },
        },
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
        entityId: params.auctionId ?? params.chitGroupId,
        amount: roundMoney(totalPaidOut),
        paymentMode: 'cash',
        notes: `Dividend cash payout — period ${params.periodNumber}, ${eligibleTicketCount} tickets`,
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
// that stays behind the security approval gate (CHIT-15).
export async function finalizeAuctionInTx(
  tx: any,
  params: {
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
    multiDivisionWinners?: Array<{
      memberId: string;
      bidId?: string | null;
      winType: 'lottery' | 'auction' | string;
      prizeAmount: number;
      bidDiscount: number;
      winnerName?: string;
      winnerTicketNo?: string | null;
    }>;
    goldRatePerGram?: number | null;
    consensusReason?: string | null;
  },
) {
  const { scope, auction, group, selectedBid } = params;
  // Atomic status claim inside tx prevents concurrent double-finalization
  const claim = await tx.chitAuction.updateMany({
    where: { id: auction.id, status: { notIn: ['confirmed', 'paid', 'cancelled'] } },
    data: { status: 'finalizing' },
  });
  if (claim.count === 0) throw new Error('Auction already finalized');

  const engineType = resolveEngineTypeFromGroup(group);
  const config = parseChitEngineConfig(group.engineConfig, engineType);

  const members = await tx.chitMember.findMany({
    where: { chitGroupId: auction.chitGroupId },
    orderBy: { memberNumber: 'asc' },
    select: {
      id: true,
      ticketNo: true,
      fractionNo: true,
      ticketShare: true,
      hasWon: true,
      subscriberStatus: true,
      customer: { select: { name: true } },
    },
  });

  // Check late payers for dividend forfeiture when configured
  const lateMemberIds = new Set<string>();
  if (config.defaultRules.forfeitDividendOnLate) {
    const periodSubs = await tx.chitSubscription.findMany({
      where: {
        periodNumber: auction.periodNumber,
        member: { chitGroupId: auction.chitGroupId },
      },
      select: { memberId: true, status: true, dueDate: true, dueAmount: true, paidAmount: true },
    });
    for (const s of periodSubs) {
      if (s.status === 'missed') {
        lateMemberIds.add(s.memberId);
      } else if (
        s.status !== 'paid' &&
        s.dueDate &&
        new Date(s.dueDate).getTime() < new Date(auction.auctionDate).getTime() &&
        Number(s.paidAmount) < Number(s.dueAmount)
      ) {
        lateMemberIds.add(s.memberId);
      }
    }
  }

  const winnerMemberIds = params.multiDivisionWinners?.length
    ? params.multiDivisionWinners.map((w) => w.memberId)
    : [selectedBid.memberId];

  const breakdown: ChitPeriodCalculationBreakdown = calculateChitPeriodEngine({
    engineType,
    config,
    chitValue: Number(group.chitValue),
    monthlyContrib: Number(group.monthlyContrib),
    totalMembers: group.totalMembers,
    periodNumber: auction.periodNumber,
    commissionPct: Number(group.commissionPct),
    commissionBasis: group.commissionBasis as any,
    gstPct: group.gstPct ? Number(group.gstPct) : null,
    dividendPolicy: group.dividendPolicy,
    dividendDistribution: group.dividendDistribution,
    dividendRounding: group.dividendRounding,
    winnerInterestType: group.winnerInterestType,
    winnerInterestValue: group.winnerInterestValue != null ? Number(group.winnerInterestValue) : null,
    winnerInterestPeriods: group.winnerInterestPeriods,
    winnerMemberIds,
    prizeAmount: Number(selectedBid.bidAmount),
    fixedDiscountPct: group.fixedDiscountPct != null ? Number(group.fixedDiscountPct) : null,
    multiDivisionWinners: params.multiDivisionWinners,
    goldRatePerGram: params.goldRatePerGram ?? config.goldScheme?.defaultGoldRatePerGram ?? null,
    members: members.map((m: any) => ({
      memberId: m.id,
      memberName: m.customer.name,
      ticketNo: m.ticketNo,
      fractionNo: m.fractionNo,
      ticketShare: Number(m.ticketShare),
      hasWonBeforePeriod: Boolean(m.hasWon) && !winnerMemberIds.includes(m.id),
      isActive: m.subscriberStatus === 'active',
      isLateThisPeriod: lateMemberIds.has(m.id),
    })),
  });

  const calc = {
    chitValue: breakdown.chitValue,
    prizeAmount: breakdown.prizeAmount,
    bidDiscount: breakdown.bidDiscount,
    commission: breakdown.commission,
    gstAmount: breakdown.gstAmount,
    distributableDividend: breakdown.distributableDividend,
    dividend: breakdown.dividendPerTicket,
    dividendEligibleMembers: breakdown.dividendEligibleTickets,
    roundingIncome: breakdown.roundingIncome,
  };

  const generatedMinutes = generateAuctionMinutes({
    groupName: group.name,
    periodNumber: auction.periodNumber,
    auctionDate: auction.auctionDate,
    totalMembers: group.totalMembers,
    presentCount: params.presentCount,
    winnerName: params.multiDivisionWinners?.length
      ? params.multiDivisionWinners.map((w) => w.winnerName ?? w.memberId).join(', ')
      : params.winnerName,
    prizeAmount: calc.prizeAmount,
    bidDiscount: calc.bidDiscount,
    commission: calc.commission,
    dividend: calc.dividend,
  });
  const minutes = [
    params.minutesText || generatedMinutes,
    params.drawEvidence,
    params.consensusReason ? `Consensus reason: ${params.consensusReason}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Demote only a previously selected winner; withdrawn/rejected bids keep their status.
  await tx.chitBid.updateMany({ where: { auctionId: auction.id, status: 'winning' }, data: { status: 'valid' } });
  const winningBidIds = params.multiDivisionWinners?.length
    ? params.multiDivisionWinners.map((w) => w.bidId).filter((id): id is string => Boolean(id))
    : [selectedBid.id];
  for (const bId of winningBidIds) {
    await tx.chitBid.update({ where: { id: bId }, data: { status: 'winning' } });
  }

  // Registered chits are statutory under Chit Funds Act 1982 and never bypass winner security.
  const isRegistered = group.chitType === 'registered';
  const securityAutoApproved =
    !isRegistered &&
    config.securityRequirements.requiredForPrized === false &&
    config.securityRequirements.autoHoldPayoutUntilVerified === false;

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
      reserveFloorAmount: breakdown.reserveFloorAmount,
      goldRatePerGram: params.goldRatePerGram ?? undefined,
      calculationBreakdown: JSON.stringify(breakdown),
      status: 'confirmed',
      roomStatus: 'closed',
      payoutStatus: securityAutoApproved ? 'ready' : 'security_pending',
      completedAt: new Date(),
      confirmedAt: new Date(),
      confirmedById: scope.userId || undefined,
      minutesText: minutes,
    },
  });

  // Mark winner(s) + write ChitAuctionWinner rows when multi-division
  if (params.multiDivisionWinners?.length && breakdown.multiDivisionWinners?.length) {
    for (const mw of params.multiDivisionWinners) {
      const bdWinner = breakdown.multiDivisionWinners.find((w) => w.memberId === mw.memberId);
      await tx.chitMember.update({ where: { id: mw.memberId }, data: { hasWon: true, wonAt: new Date() } });
      await tx.chitAuctionWinner.create({
        data: {
          tenantId: scope.tenantId,
          branchId: group.branchId,
          appType: scope.appType,
          chitGroupId: auction.chitGroupId,
          auctionId: auction.id,
          memberId: mw.memberId,
          bidId: mw.bidId ?? undefined,
          winType: mw.winType,
          prizeAmount: mw.prizeAmount,
          bidDiscount: mw.bidDiscount,
          commission: bdWinner?.commission ?? 0,
          gstAmount: bdWinner?.gstAmount ?? 0,
          payoutStatus: securityAutoApproved ? 'ready' : 'security_pending',
          payoutAssetType: config.payoutAssetType,
        },
      });
      await tx.chitSecurity.create({
        data: {
          tenantId: scope.tenantId,
          branchId: group.branchId,
          chitGroupId: auction.chitGroupId,
          auctionId: auction.id,
          winnerMemberId: mw.memberId,
          securityType: securityAutoApproved ? 'NONE' : 'pending',
          status: securityAutoApproved ? 'approved' : 'pending',
          approvedById: securityAutoApproved ? scope.userId : undefined,
          approvedAt: securityAutoApproved ? new Date() : undefined,
        },
      });
    }
  } else {
    await tx.chitMember.update({ where: { id: selectedBid.memberId }, data: { hasWon: true, wonAt: new Date() } });
    await tx.chitSecurity.create({
      data: {
        tenantId: scope.tenantId,
        branchId: group.branchId,
        chitGroupId: auction.chitGroupId,
        auctionId: auction.id,
        winnerMemberId: selectedBid.memberId,
        securityType: securityAutoApproved ? 'NONE' : 'pending',
        status: securityAutoApproved ? 'approved' : 'pending',
        approvedById: securityAutoApproved ? scope.userId : undefined,
        approvedAt: securityAutoApproved ? new Date() : undefined,
      },
    });
  }

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

  const memberDividendMap = new Map<string, { dividend: number; deferred: number; forfeited: boolean }>();
  for (const row of breakdown.memberBreakdowns) {
    memberDividendMap.set(row.memberId, {
      dividend: row.dividendEarned,
      deferred: row.deferredDividend,
      forfeited: row.roleThisPeriod === 'forfeited_late',
    });
  }

  await applyDividendDistribution(tx, {
    scope,
    chitGroupId: auction.chitGroupId,
    auctionId: auction.id,
    periodNumber: auction.periodNumber,
    group: {
      branchId: group.branchId,
      dividendPolicy: breakdown.dividendPolicy,
      dividendDistribution: breakdown.dividendDistribution,
    },
    branchCode: params.branchCode,
    dividendPerTicket: calc.dividend,
    winnerTicketNo: params.winnerTicketNo,
    memberDividendMap,
  });

  // Apply post-prize differential premium for BASE_PLUS_PREMIUM / CUSTOM_MANUAL_SCHEDULE / FIXED_PAYOUT_VARIABLE_PAY
  if (
    engineType === 'BASE_PLUS_PREMIUM' &&
    config.differentialInstalment.prizedPremiumAmount > 0
  ) {
    for (const wId of winnerMemberIds) {
      const m = members.find((mem: any) => mem.id === wId);
      const share = Number(m?.ticketShare ?? 1);
      const premiumPerPeriod = roundMoney(config.differentialInstalment.prizedPremiumAmount * share);
      if (premiumPerPeriod > 0) {
        await tx.chitSubscription.updateMany({
          where: {
            memberId: wId,
            periodNumber: { gt: auction.periodNumber },
            status: { not: 'paid' },
          },
          data: {
            premiumAmount: { increment: premiumPerPeriod },
            dueAmount: { increment: premiumPerPeriod },
          },
        });
      }
    }
  } else if (
    (engineType === 'CUSTOM_MANUAL_SCHEDULE' && config.customSchedule?.length) ||
    (engineType === 'FIXED_PAYOUT_VARIABLE_PAY' && config.variableInstalments?.length)
  ) {
    const scheduleDeltas =
      engineType === 'CUSTOM_MANUAL_SCHEDULE'
        ? (config.customSchedule ?? []).map((r) => ({
            period: r.period,
            prized: r.instalmentPrized,
            nonPrized: r.instalmentNonPrized,
          }))
        : (config.variableInstalments ?? []).map((r) => ({
            period: r.period,
            prized: r.prizedDue,
            nonPrized: r.nonPrizedDue,
          }));
    for (const wId of winnerMemberIds) {
      const m = members.find((mem: any) => mem.id === wId);
      const share = Number(m?.ticketShare ?? 1);
      for (const row of scheduleDeltas) {
        if (row.period <= auction.periodNumber) continue;
        const delta = roundMoney(roundMoney(row.prized * share) - roundMoney(row.nonPrized * share));
        if (delta > 0) {
          await tx.chitSubscription.updateMany({
            where: { memberId: wId, periodNumber: row.period, status: { not: 'paid' } },
            data: { premiumAmount: { increment: delta }, dueAmount: { increment: delta } },
          });
        } else if (delta < 0) {
          const subs = await tx.chitSubscription.findMany({
            where: { memberId: wId, periodNumber: row.period, status: { not: 'paid' } },
            select: { id: true, dueAmount: true },
          });
          for (const sub of subs) {
            await tx.chitSubscription.update({
              where: { id: sub.id },
              data: { dueAmount: Math.max(0, roundMoney(Number(sub.dueAmount) + delta)) },
            });
          }
        }
      }
    }
  }

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

  await postRoomSettlementCard(tx, {
    tenantId: scope.tenantId,
    chitGroupId: auction.chitGroupId,
    auctionId: auction.id,
    periodNumber: auction.periodNumber,
    winnerName: params.winnerName,
    winnerTicketNo: params.winnerTicketNo ?? null,
    prizeAmount: calc.prizeAmount,
    bidDiscount: calc.bidDiscount,
    commission: calc.commission,
    dividendPerTicket: calc.dividend,
    monthlyContrib: Number(group.monthlyContrib),
  });

  await createChitAudit(tx, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    action: params.auditAction,
    entityType: 'chit_auction',
    entityId: auction.id,
    newValue: {
      winningBidId: selectedBid.id,
      engineType,
      calc,
      winnerInterest,
      drawEvidence: params.drawEvidence || undefined,
    },
  });
  return { calc, breakdown, auction: saved };
}
