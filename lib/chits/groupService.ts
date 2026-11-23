// Shared transaction-safe Chit Group lifecycle service (STRUCT-3) — used by
// both web server actions and /api/v1/chits/* routes so activation, multi-division
// confirmation, non-auction draws, and Jameen guarantor checks share one implementation.

import { calculateFixedDiscountPrize, roundMoney } from './calculations';
import { calculateReserveFloor } from './engineCalculator';
import {
  isBiddingEnabledForPeriod,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
} from './engineTypes';
import { finalizeAuctionInTx } from './finalize';
import { nextPeriodDate, parseFrequency } from './frequency';
import { drawLotteryWinner, formatDrawEvidence } from './lottery';

type ServiceScope = { tenantId: string; appType: string; userId?: string | null };

function scheduledDateTime(baseDate: Date, auctionTime?: string | null) {
  const scheduled = new Date(baseDate);
  if (auctionTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(auctionTime)) {
    const [hours, minutes] = auctionTime.split(':').map(Number);
    scheduled.setHours(hours, minutes, 0, 0);
  }
  return scheduled;
}

export async function activateChitGroupInTx(
  tx: any,
  params: {
    scope: ServiceScope;
    group: any;
    members: Array<{
      id: string;
      ticketNo: string | null;
      ticketShare: any;
      isForemanTicket: boolean;
      hasWon: boolean;
      customer: { name: string };
    }>;
  },
) {
  const { scope, group, members } = params;
  const engineType = resolveEngineTypeFromGroup(group);
  const config = parseChitEngineConfig(group.engineConfig, engineType);
  const freq = parseFrequency(group);
  const periodCount = group.totalMembers;

  const existingSubscriptions = await tx.chitSubscription.count({
    where: { member: { chitGroupId: group.id } },
  });
  const existingAuctions = await tx.chitAuction.count({ where: { chitGroupId: group.id } });

  const resolvePeriodDate = (period: number): Date => {
    if (config.collectionFrequency === 'SEASONAL_HARVEST' && config.seasonalDates?.[period - 1]) {
      const parsed = new Date(config.seasonalDates[period - 1]);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return nextPeriodDate(group.startDate, period, freq);
  };

  if (!existingSubscriptions) {
    for (let period = 1; period <= periodCount; period++) {
      const dueDate = resolvePeriodDate(period);
      for (const member of members) {
        let baseFull = Number(group.monthlyContrib);
        if (engineType === 'BASE_PLUS_PREMIUM' && config.differentialInstalment.baseInstalment > 0) {
          baseFull = config.differentialInstalment.baseInstalment;
        } else if (engineType === 'CUSTOM_MANUAL_SCHEDULE' && config.customSchedule?.length) {
          const row = config.customSchedule.find((r) => r.period === period);
          if (row) baseFull = row.instalmentNonPrized;
        } else if (engineType === 'FIXED_PAYOUT_VARIABLE_PAY' && config.variableInstalments?.length) {
          const row = config.variableInstalments.find((r) => r.period === period);
          if (row) baseFull = row.nonPrizedDue;
        }

        const amount = roundMoney(baseFull * Number(member.ticketShare));
        await tx.chitSubscription.create({
          data: {
            memberId: member.id,
            periodNumber: period,
            dueDate,
            dueAmount: amount,
            baseDueAmount: amount,
            status: 'upcoming',
          },
        });
      }
    }
  }

  if (!existingAuctions) {
    for (let period = 1; period <= periodCount; period++) {
      const auctionDate = resolvePeriodDate(period);
      let reserveFloorAmount: number | undefined;
      if (engineType === 'AUCTION_RESERVE_PRICE' && config.discountRules.reservePriceStepPct > 0) {
        reserveFloorAmount = calculateReserveFloor({
          chitValue: Number(group.chitValue),
          totalPeriods: periodCount,
          periodNumber: period,
          reservePriceStepPct: config.discountRules.reservePriceStepPct,
          maxDiscountPct: config.discountRules.uncapped ? null : config.discountRules.maxDiscountPct,
        }).reserveFloorAmount;
      }

      await tx.chitAuction.create({
        data: {
          chitGroupId: group.id,
          periodNumber: period,
          auctionDate,
          scheduledAt: scheduledDateTime(auctionDate, group.auctionTime),
          reserveFloorAmount,
          status: 'pending',
        },
      });
    }
  }

  const updatedGroup = await tx.chitGroup.update({
    where: { id: group.id },
    data: { status: 'active', complianceStatus: 'active' },
  });

  // Foreman/company ticket takes period 1 automatically without auction
  const foremanAutoPeriod1 =
    group.hasForemanTicket ||
    config.foremanCompensation.mode === 'FREE_TICKET_CYCLE_1' ||
    (config.foremanCompensation.mode === 'HYBRID' &&
      config.foremanCompensation.reservedForemanCycles.includes(1));

  const foremanMember = foremanAutoPeriod1
    ? members.find((member) => member.isForemanTicket && !member.hasWon)
    : null;

  if (foremanMember) {
    const periodOne = await tx.chitAuction.findFirst({
      where: { chitGroupId: group.id, periodNumber: 1, status: 'pending', winnerMemberId: null },
    });
    if (periodOne) {
      const fixed = calculateFixedDiscountPrize({
        chitValue: Number(group.chitValue),
        fixedDiscountPct:
          config.foremanCompensation.mode === 'FREE_TICKET_CYCLE_1'
            ? 0
            : group.fixedDiscountPct
              ? Number(group.fixedDiscountPct)
              : 0,
      });
      const branch = group.branchId
        ? await tx.branch.findUnique({ where: { id: group.branchId }, select: { code: true } })
        : null;
      const bid = await tx.chitBid.create({
        data: {
          tenantId: scope.tenantId,
          branchId: group.branchId,
          auctionId: periodOne.id,
          chitGroupId: group.id,
          memberId: foremanMember.id,
          bidAmount: fixed.prizeAmount,
          bidDiscount: fixed.bidDiscount,
          remarks: 'Foreman ticket — period 1 prize taken without auction',
          createdById: scope.userId || undefined,
        },
      });
      await finalizeAuctionInTx(tx, {
        scope,
        auction: periodOne,
        group,
        branchCode: branch?.code,
        selectedBid: bid,
        winnerName: foremanMember.customer.name,
        winnerTicketNo: foremanMember.ticketNo,
        presentCount: 0,
        drawEvidence: 'Foreman ticket — period 1 prize taken without auction.',
        auditAction: 'foreman_ticket_resolve',
      });
    }
  }

  return updatedGroup;
}

export async function resolveNonAuctionPeriodInTx(
  tx: any,
  params: {
    scope: ServiceScope;
    auction: any;
    group: any;
    branchCode?: string | null;
    presentCount: number;
    selectedMemberId?: string | null;
    consensusReason?: string | null;
    goldRatePerGram?: number | null;
  },
) {
  const { scope, auction, group } = params;
  const engineType = resolveEngineTypeFromGroup(group);
  const config = parseChitEngineConfig(group.engineConfig, engineType);

  if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) {
    throw new Error('Auction is locked');
  }

  // Bidding engines only allow draw when in a reserved cycle OR reserve-price fallback with 0 valid bids
  const biddingActive = isBiddingEnabledForPeriod(group, auction.periodNumber);
  if (biddingActive && engineType !== 'AUCTION_RESERVE_PRICE') {
    throw new Error('Draw is only available for non-auction cycles or reserve-floor fallback');
  }

  const eligible = await tx.chitMember.findMany({
    where: {
      chitGroupId: auction.chitGroupId,
      hasWon: false,
      subscriberStatus: 'active',
      ticketNo: { not: null },
    },
    include: { customer: true },
  });
  if (!eligible.length) throw new Error('No eligible tickets for this period');

  // If AUCTION_RESERVE_PRICE has valid bids >= floor, require confirm instead of fallback draw
  if (engineType === 'AUCTION_RESERVE_PRICE') {
    const validBidCount = await tx.chitBid.count({
      where: { auctionId: auction.id, status: 'valid' },
    });
    if (validBidCount > 0) {
      throw new Error('Valid bids exist above the reserve floor — use Confirm Auction instead of fallback lottery');
    }
  }

  let winnerMember: (typeof eligible)[number] | undefined;
  let drawEvidence = '';

  if (engineType === 'NEED_BASED_CONSENSUS') {
    if (!params.selectedMemberId) {
      throw new Error('Consensus allocation requires selecting an eligible member');
    }
    winnerMember = eligible.find((m: any) => m.id === params.selectedMemberId);
    if (!winnerMember) throw new Error('Selected member is not eligible for consensus allocation');
    drawEvidence = `Need-based consensus: ticket ${winnerMember.ticketNo} selected${params.consensusReason ? ` (${params.consensusReason})` : ''}.`;
  } else if (
    engineType === 'FIXED_ROTATION' ||
    group.auctionType === 'fixed_rotation' ||
    ['GOLD_VALUE_ACCUMULATION', 'GOLD_WEIGHT_ACCUMULATION', 'FESTIVAL_COMMODITY', 'ASCA_SHG_REVOLVING', 'CUSTOM_MANUAL_SCHEDULE'].includes(engineType)
  ) {
    if (config.rotationOrder?.length) {
      const nextTicket = config.rotationOrder.find((t) => eligible.some((e: any) => e.ticketNo === t || e.id === t));
      winnerMember = nextTicket
        ? eligible.find((e: any) => e.ticketNo === nextTicket || e.id === nextTicket)
        : undefined;
    }
    if (!winnerMember) {
      winnerMember = [...eligible].sort((a: any, b: any) =>
        (a.ticketNo as string).localeCompare(b.ticketNo as string, undefined, { numeric: true }),
      )[0];
    }
    drawEvidence = `${engineType}: ticket ${winnerMember.ticketNo} resolved in scheduled order.`;
  } else if (engineType === 'HYBRID_SPLIT_PHASE' && auction.periodNumber <= (config.hybridSplitPhase?.reservedCyclesCount ?? 0)) {
    const assigned = config.hybridSplitPhase?.reservedTicketAssignments?.[String(auction.periodNumber)];
    winnerMember =
      (assigned && eligible.find((e: any) => e.ticketNo === assigned || e.id === assigned)) ||
      eligible.find((e: any) => e.isForemanTicket) ||
      [...eligible].sort((a: any, b: any) =>
        (a.ticketNo as string).localeCompare(b.ticketNo as string, undefined, { numeric: true }),
      )[0];
    drawEvidence = `Hybrid Phase 1 (Cycle ${auction.periodNumber}): pre-booked allocation to ticket ${winnerMember.ticketNo}.`;
  } else {
    const draw = drawLotteryWinner({
      auctionId: auction.id,
      candidates: eligible.map((member: any) => ({
        memberId: member.id,
        ticketNo: member.ticketNo as string,
        memberName: member.customer.name,
      })),
    });
    winnerMember = eligible.find((member: any) => member.id === draw.winner.memberId);
    drawEvidence = formatDrawEvidence(draw);
  }

  if (!winnerMember) throw new Error('Unable to determine eligible winner');

  const chitValue = Number(group.chitValue);
  let prizeAmount = chitValue;
  let bidDiscount = 0;

  if (engineType === 'AUCTION_RESERVE_PRICE') {
    const floor = calculateReserveFloor({
      chitValue,
      totalPeriods: group.totalMembers,
      periodNumber: auction.periodNumber,
      reservePriceStepPct: config.discountRules.reservePriceStepPct,
      maxDiscountPct: config.discountRules.uncapped ? null : config.discountRules.maxDiscountPct,
    });
    bidDiscount = floor.reserveFloorAmount;
    prizeAmount = Math.max(1, roundMoney(chitValue - bidDiscount));
    drawEvidence = `Reserve-price lottery fallback at floor discount ${bidDiscount}. ${drawEvidence}`;
  } else if (engineType === 'FIXED_CHART_ESCALATING') {
    const chartRow = config.escalatingPayouts?.find((r) => r.period === auction.periodNumber);
    prizeAmount = chartRow ? roundMoney(chartRow.payoutAmount) : chitValue;
    bidDiscount = Math.max(0, roundMoney(chitValue - prizeAmount));
  } else if (engineType === 'CUSTOM_MANUAL_SCHEDULE') {
    const row = config.customSchedule?.find((r) => r.period === auction.periodNumber);
    prizeAmount = row ? roundMoney(row.payoutAmount) : chitValue;
    bidDiscount = Math.max(0, roundMoney(chitValue - prizeAmount));
  } else if (engineType === 'HYBRID_SPLIT_PHASE') {
    const pct = config.hybridSplitPhase?.reservedDiscountPct ?? 0;
    const fixed = calculateFixedDiscountPrize({ chitValue, fixedDiscountPct: pct });
    prizeAmount = fixed.prizeAmount;
    bidDiscount = fixed.bidDiscount;
  } else if (engineType === 'FIXED_DIVIDEND') {
    const row = config.fixedDividends?.find((r) => r.period === auction.periodNumber);
    const fixedDiv = row ? row.dividendPerTicket : 0;
    const estComm = roundMoney((chitValue * Number(group.commissionPct)) / 100);
    const estDiscount = roundMoney(fixedDiv * group.totalMembers + estComm);
    bidDiscount = Math.min(chitValue - 1, Math.max(0, estDiscount));
    prizeAmount = roundMoney(chitValue - bidDiscount);
  } else {
    const fixed = calculateFixedDiscountPrize({
      chitValue,
      fixedDiscountPct: group.fixedDiscountPct ? Number(group.fixedDiscountPct) : 0,
    });
    prizeAmount = fixed.prizeAmount;
    bidDiscount = fixed.bidDiscount;
  }

  const bid = await tx.chitBid.create({
    data: {
      tenantId: scope.tenantId,
      branchId: group.branchId,
      auctionId: auction.id,
      chitGroupId: auction.chitGroupId,
      memberId: winnerMember.id,
      bidAmount: prizeAmount,
      bidDiscount,
      remarks: drawEvidence,
      createdById: scope.userId || undefined,
    },
  });

  const result = await finalizeAuctionInTx(tx, {
    scope,
    auction,
    group,
    branchCode: params.branchCode,
    selectedBid: bid,
    winnerName: winnerMember.customer.name,
    winnerTicketNo: winnerMember.ticketNo,
    presentCount: params.presentCount,
    drawEvidence,
    consensusReason: params.consensusReason,
    goldRatePerGram: params.goldRatePerGram,
    auditAction: engineType === 'NEED_BASED_CONSENSUS' ? 'consensus_allocate' : 'draw_winner',
  });

  return {
    auction: result.auction,
    winnerMember,
    drawEvidence,
    calc: result.calc,
  };
}

export async function confirmMultiDivisionAuctionInTx(
  tx: any,
  params: {
    scope: ServiceScope;
    auction: any;
    group: any;
    branchCode?: string | null;
    bids: Array<any>;
    presentCount: number;
    minutesText?: string | null;
  },
) {
  const { scope, auction, group, bids } = params;
  const config = parseChitEngineConfig(group.engineConfig, 'AUCTION_MULTI_DIVISION');
  const lotteryCount = Math.max(0, config.multiDivision.lotteryWinnersPerCycle);
  const auctionCount = Math.max(1, config.multiDivision.auctionWinnersPerCycle);
  const chitValue = Number(group.chitValue);
  const commPerTicket = roundMoney((chitValue * Number(group.commissionPct)) / 100);

  // Deduplicate top auction bids by member
  const validSorted = bids
    .filter((b) => b.status === 'valid' && !b.member?.hasWon)
    .sort((a, b) => {
      const diff = Number(b.bidDiscount) - Number(a.bidDiscount);
      if (diff !== 0) return diff;
      return new Date(a.bidTime).getTime() - new Date(b.bidTime).getTime();
    });

  const pickedAuctionBids: any[] = [];
  const pickedMemberIds = new Set<string>();
  for (const b of validSorted) {
    if (pickedMemberIds.has(b.memberId)) continue;
    pickedAuctionBids.push(b);
    pickedMemberIds.add(b.memberId);
    if (pickedAuctionBids.length >= auctionCount) break;
  }

  if (pickedAuctionBids.length === 0) {
    throw new Error('At least one valid auction bid is required for multi-division confirmation');
  }

  const multiWinners: Array<{
    memberId: string;
    bidId?: string | null;
    winType: 'lottery' | 'auction';
    prizeAmount: number;
    bidDiscount: number;
    winnerName: string;
    winnerTicketNo?: string | null;
  }> = [];

  const drawEvidences: string[] = [];

  if (lotteryCount > 0) {
    let remainingEligible = await tx.chitMember.findMany({
      where: {
        chitGroupId: auction.chitGroupId,
        hasWon: false,
        subscriberStatus: 'active',
        ticketNo: { not: null },
        id: { notIn: Array.from(pickedMemberIds) },
      },
      include: { customer: true },
    });

    for (let i = 0; i < lotteryCount && remainingEligible.length > 0; i++) {
      const draw = drawLotteryWinner({
        auctionId: `${auction.id}:lot:${i + 1}`,
        candidates: remainingEligible.map((m: any) => ({
          memberId: m.id,
          ticketNo: m.ticketNo as string,
          memberName: m.customer.name,
        })),
      });
      const winMem = remainingEligible.find((m: any) => m.id === draw.winner.memberId);
      if (!winMem) break;
      drawEvidences.push(`Lottery #${i + 1}: ${formatDrawEvidence(draw)}`);
      pickedMemberIds.add(winMem.id);
      remainingEligible = remainingEligible.filter((m: any) => m.id !== winMem.id);

      const lotteryPrize = Math.max(1, roundMoney(chitValue - commPerTicket));
      const syntheticBid = await tx.chitBid.create({
        data: {
          tenantId: scope.tenantId,
          branchId: group.branchId,
          auctionId: auction.id,
          chitGroupId: auction.chitGroupId,
          memberId: winMem.id,
          bidAmount: lotteryPrize,
          bidDiscount: 0,
          remarks: `Multi-division lottery winner #${i + 1}`,
          createdById: scope.userId || undefined,
        },
      });
      multiWinners.push({
        memberId: winMem.id,
        bidId: syntheticBid.id,
        winType: 'lottery',
        prizeAmount: lotteryPrize,
        bidDiscount: 0,
        winnerName: winMem.customer.name,
        winnerTicketNo: winMem.ticketNo,
      });
    }
  }

  for (const ab of pickedAuctionBids) {
    multiWinners.push({
      memberId: ab.memberId,
      bidId: ab.id,
      winType: 'auction',
      prizeAmount: Number(ab.bidAmount),
      bidDiscount: Number(ab.bidDiscount),
      winnerName: ab.member.customer.name,
      winnerTicketNo: ab.member.ticketNo,
    });
  }

  const lead = pickedAuctionBids[0];
  return finalizeAuctionInTx(tx, {
    scope,
    auction,
    group,
    branchCode: params.branchCode,
    selectedBid: lead,
    winnerName: multiWinners.map((w) => `${w.winnerName} (${w.winType})`).join(', '),
    winnerTicketNo: lead.member.ticketNo,
    presentCount: params.presentCount,
    minutesText: params.minutesText,
    drawEvidence: drawEvidences.join(' | ') || undefined,
    multiDivisionWinners: multiWinners,
    auditAction: 'confirm_multi_division_auction',
  });
}

/**
 * Within-module Internal Guarantor (Jameen) Lock check (`SCOPE-17` compliant):
 * Returns a lock object if `memberId` stands as guarantor for another prized
 * member in the same chit group who still has unpaid instalments.
 */
export async function findActiveGuaranteeLock(
  dbOrTx: any,
  params: { chitGroupId: string; memberId: string },
): Promise<{ guaranteedMemberName: string; guaranteedTicketNo: string | null; unpaidPeriods: number } | null> {
  const guarantees = await dbOrTx.chitSecurity.findMany({
    where: {
      chitGroupId: params.chitGroupId,
      guarantorMemberId: params.memberId,
      status: { in: ['pending', 'submitted', 'verified', 'approved'] },
      winnerMemberId: { not: params.memberId },
    },
    select: { winnerMemberId: true },
  });
  if (!guarantees.length) return null;

  for (const g of guarantees) {
    const unpaidCount = await dbOrTx.chitSubscription.count({
      where: { memberId: g.winnerMemberId, status: { not: 'paid' } },
    });
    if (unpaidCount > 0) {
      const winner = await dbOrTx.chitMember.findUnique({
        where: { id: g.winnerMemberId },
        select: { ticketNo: true, customer: { select: { name: true } } },
      });
      return {
        guaranteedMemberName: winner?.customer?.name ?? 'Subscriber',
        guaranteedTicketNo: winner?.ticketNo ?? null,
        unpaidPeriods: unpaidCount,
      };
    }
  }
  return null;
}

export async function assertMemberSubstitutionAllowed(
  dbOrTx: any,
  params: { group: { id: string; totalMembers: number; engineConfig?: string | null; chitEngineType?: string | null; auctionType?: string | null } },
) {
  const engineType = resolveEngineTypeFromGroup(params.group);
  const config = parseChitEngineConfig(params.group.engineConfig, engineType);
  const cutoffPct = config.defaultRules.substitutionCutoffPct;
  if (!(cutoffPct > 0) || cutoffPct >= 100) return;

  const completedCount = await dbOrTx.chitAuction.count({
    where: {
      chitGroupId: params.group.id,
      status: { in: ['confirmed', 'paid', 'completed'] },
    },
  });
  const elapsedPct = params.group.totalMembers > 0 ? (completedCount / params.group.totalMembers) * 100 : 0;
  if (elapsedPct > cutoffPct) {
    throw new Error(
      `Member substitution disallowed after ${cutoffPct}% tenure completion (currently ${Math.round(elapsedPct)}%).`,
    );
  }
}
