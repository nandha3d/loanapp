// Full post-win summary — staff sees every member's dividend, a member sees
// only their own figures. When `auction.calculationBreakdown` was snapshotted at
// finalisation time, this serves that immutable snapshot; for legacy finalized
// auctions it re-derives cleanly using the same pure calculation engine so it
// can never drift from what finalize actually computed.
import prisma from '../db';
import { roundMoney } from './calculations';
import {
  calculateChitPeriodEngine,
  computeSubscriptionBalances,
  type ChitPeriodCalculationBreakdown,
} from './engineCalculator';
import { parseChitEngineConfig, resolveEngineTypeFromGroup } from './engineTypes';

export async function buildWinnerSummary(
  auctionId: string,
  opts: { audience: 'staff' | 'member'; memberId?: string },
) {
  const auction = await prisma.chitAuction.findUnique({
    where: { id: auctionId },
    include: {
      chitGroup: {
        select: {
          name: true,
          chitValue: true,
          monthlyContrib: true,
          commissionPct: true,
          commissionBasis: true,
          gstPct: true,
          dividendPolicy: true,
          dividendDistribution: true,
          dividendRounding: true,
          totalMembers: true,
          branchId: true,
          chitEngineType: true,
          auctionType: true,
          engineConfig: true,
          winnerInterestType: true,
          winnerInterestValue: true,
          winnerInterestPeriods: true,
        },
      },
      winnerMember: { include: { customer: { select: { name: true, phone: true } } } },
      winners: {
        include: { member: { include: { customer: { select: { name: true } } } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  // Not yet confirmed (still pending/in_progress) — nothing to summarize.
  if (!auction || !['confirmed', 'paid', 'completed'].includes(auction.status)) return null;

  const group = auction.chitGroup;
  const engineType = resolveEngineTypeFromGroup(group);
  const config = parseChitEngineConfig(group.engineConfig, engineType);

  let breakdown: ChitPeriodCalculationBreakdown | null = null;
  if (auction.calculationBreakdown) {
    try {
      const parsed = JSON.parse(auction.calculationBreakdown);
      if (parsed && typeof parsed === 'object') breakdown = parsed as ChitPeriodCalculationBreakdown;
    } catch {
      breakdown = null;
    }
  }

  if (!breakdown) {
    const members = await prisma.chitMember.findMany({
      where: { chitGroupId: auction.chitGroupId },
      orderBy: { memberNumber: 'asc' },
      select: {
        id: true,
        ticketNo: true,
        fractionNo: true,
        ticketShare: true,
        subscriberStatus: true,
        customer: { select: { name: true } },
        wonAuctions: {
          where: { periodNumber: { lt: auction.periodNumber } },
          select: { id: true },
        },
      },
    });
    const winnerIds =
      auction.winners.length > 0
        ? auction.winners.map((w) => w.memberId)
        : auction.winnerMemberId
          ? [auction.winnerMemberId]
          : [];

    breakdown = calculateChitPeriodEngine({
      engineType,
      config,
      chitValue: Number(group.chitValue),
      monthlyContrib: Number(group.monthlyContrib),
      totalMembers: group.totalMembers,
      periodNumber: auction.periodNumber,
      commissionPct: Number(group.commissionPct),
      commissionBasis: group.commissionBasis as any,
      gstPct: group.gstPct != null ? Number(group.gstPct) : null,
      dividendPolicy: group.dividendPolicy,
      dividendDistribution: group.dividendDistribution,
      dividendRounding: group.dividendRounding,
      winnerInterestType: group.winnerInterestType,
      winnerInterestValue: group.winnerInterestValue != null ? Number(group.winnerInterestValue) : null,
      winnerInterestPeriods: group.winnerInterestPeriods,
      winnerMemberIds: winnerIds,
      prizeAmount: auction.prizeAmount != null ? Number(auction.prizeAmount) : null,
      goldRatePerGram: auction.goldRatePerGram != null ? Number(auction.goldRatePerGram) : null,
      multiDivisionWinners: auction.winners.length
        ? auction.winners.map((w) => ({
            memberId: w.memberId,
            winType: w.winType,
            prizeAmount: Number(w.prizeAmount),
            bidDiscount: Number(w.bidDiscount),
          }))
        : undefined,
      members: members.map((m) => ({
        memberId: m.id,
        memberName: m.customer.name,
        ticketNo: m.ticketNo,
        fractionNo: m.fractionNo,
        ticketShare: Number(m.ticketShare),
        hasWonBeforePeriod: m.wonAuctions.length > 0,
        isActive: m.subscriberStatus === 'active',
      })),
    });
  }

  const base = {
    groupName: group.name,
    periodNumber: auction.periodNumber,
    winnerName: auction.winnerMember?.customer.name ?? null,
    winnerTicketNo: auction.winnerMember?.ticketNo ?? null,
    chitEngineType: breakdown.engineType,
    payoutAssetType: breakdown.payoutAssetType,
    foremanCompensationMode: breakdown.foremanCompensationMode,
    reserveFloorAmount: breakdown.reserveFloorAmount,
    chitValue: breakdown.chitValue,
    prizeAmount: breakdown.prizeAmount,
    bidDiscount: breakdown.bidDiscount,
    commissionPct: breakdown.commissionPct,
    commissionBasis: breakdown.commissionBasis,
    commission: breakdown.commission,
    gstPct: group.gstPct != null ? Number(group.gstPct) : null,
    gstAmount: breakdown.gstAmount,
    distributableDividend: breakdown.distributableDividend,
    dividendEligibleMembers: breakdown.dividendEligibleTickets,
    dividend: breakdown.dividendPerTicket,
    roundingIncome: breakdown.roundingIncome,
    forfeitedDividendTotal: breakdown.forfeitedDividendTotal,
    dividendPolicy: breakdown.dividendPolicy,
    dividendDistribution: breakdown.dividendDistribution,
    multiDivisionWinners: breakdown.multiDivisionWinners ?? null,
    formulaLines: breakdown.formulaLines,
  };

  if (opts.audience === 'staff') {
    let receiptNo: string | null = null;
    if (group.dividendDistribution === 'CASH_PAYOUT') {
      const receipt = await prisma.chitReceipt.findFirst({
        where: {
          entityType: 'auction',
          entityId: auction.chitGroupId,
          receiptType: 'dividend_payout',
          notes: { contains: `period ${auction.periodNumber}` },
        },
        orderBy: { issuedAt: 'desc' },
        select: { receiptNo: true },
      });
      receiptNo = receipt?.receiptNo ?? null;
    }

    const filteredRows =
      group.dividendPolicy === 'NON_WINNERS_ONLY'
        ? breakdown.memberBreakdowns.filter((r) => r.roleThisPeriod !== 'winner')
        : breakdown.memberBreakdowns;

    return {
      ...base,
      receiptNo,
      breakdown,
      memberDividends: filteredRows.map((m) => ({
        memberId: m.memberId,
        ticketNo: m.ticketNo,
        fractionNo: m.fractionNo,
        ticketShare: m.ticketShare,
        name: m.memberName,
        roleStatus: m.roleThisPeriod,
        baseInstalment: m.baseInstalment,
        dividend: m.dividendEarned,
        deferredDividend: m.deferredDividend,
        forfeitedDividend: m.forfeitedDividend,
        premiumAdded: m.premiumAdded,
        winnerInterestAdded: m.winnerInterestAdded,
        netPayableNextPeriod: m.netPayableNextPeriod,
      })),
    };
  }

  // Member audience: only "my" figures, scoped to opts.memberId — never
  // trust a body-supplied memberId, same rule as customerAuction.ts.
  const myBreakdown = opts.memberId
    ? breakdown.memberBreakdowns.find((m) => m.memberId === opts.memberId) ?? null
    : null;
  const iWon =
    auction.winnerMemberId === opts.memberId ||
    auction.winners.some((w) => w.memberId === opts.memberId);
  const excludedFromDividend =
    (group.dividendPolicy === 'NON_WINNERS_ONLY' && iWon) ||
    (breakdown.dividendPolicy === 'NON_PRIZED_ONLY' &&
      (iWon || myBreakdown?.roleThisPeriod === 'previously_prized'));

  const mySub = opts.memberId
    ? await prisma.chitSubscription.findFirst({
        where: { memberId: opts.memberId, periodNumber: auction.periodNumber + 1 },
        select: {
          dueAmount: true,
          baseDueAmount: true,
          dividendAmount: true,
          deferredDividendAmount: true,
          premiumAmount: true,
          interestAmount: true,
          penaltyAmount: true,
          paidAmount: true,
          dividendForfeited: true,
        },
      })
    : null;
  const myCurrSub = opts.memberId
    ? await prisma.chitSubscription.findFirst({
        where: { memberId: opts.memberId, periodNumber: auction.periodNumber },
        select: { goldGramsCredited: true, dividendForfeited: true },
      })
    : null;
  const myMember = opts.memberId
    ? await prisma.chitMember.findUnique({ where: { id: opts.memberId }, select: { ticketShare: true } })
    : null;

  const myDividend =
    myBreakdown != null
      ? myBreakdown.dividendEarned
      : excludedFromDividend || !myMember
        ? 0
        : roundMoney(breakdown.dividendPerTicket * Number(myMember.ticketShare));

  const nextBal = mySub ? computeSubscriptionBalances(mySub, breakdown.dividendDistribution) : null;

  return {
    ...base,
    breakdown: { ...breakdown, memberBreakdowns: myBreakdown ? [myBreakdown] : [] },
    me: {
      iWon,
      excludedFromDividend,
      forfeitedOnLate: myBreakdown?.roleThisPeriod === 'forfeited_late' || Boolean(myCurrSub?.dividendForfeited),
      ticketShare: myMember ? Number(myMember.ticketShare) : 1,
      baseInstalment: myBreakdown?.baseInstalment ?? Number(group.monthlyContrib),
      myDividend,
      myDeferredDividend: myBreakdown?.deferredDividend ?? 0,
      myPremium: myBreakdown?.premiumAdded ?? 0,
      myWinnerInterest: myBreakdown?.winnerInterestAdded ?? 0,
      myNextDue: nextBal ? nextBal.netDue : myBreakdown?.netPayableNextPeriod ?? null,
      goldGramsCredited: myCurrSub?.goldGramsCredited != null ? Number(myCurrSub.goldGramsCredited) : myBreakdown?.goldGramsCredited ?? 0,
    },
  };
}

export function formatWinnerSummaryText(
  summary: NonNullable<Awaited<ReturnType<typeof buildWinnerSummary>>>,
): string {
  const lines = [
    `${summary.groupName} — Period ${summary.periodNumber} Auction Result`,
    `Winner: ${summary.winnerName ?? '—'} (Ticket ${summary.winnerTicketNo ?? '—'})`,
    `Prize: ₹${summary.prizeAmount.toLocaleString('en-IN')}`,
    `Bid discount: ₹${summary.bidDiscount.toLocaleString('en-IN')}`,
    `Commission: ₹${summary.commission.toLocaleString('en-IN')}`,
  ];
  if (summary.gstAmount > 0) lines.push(`GST: ₹${summary.gstAmount.toLocaleString('en-IN')}`);
  lines.push(`Dividend per ticket: ₹${summary.dividend.toLocaleString('en-IN')}`);
  if ('receiptNo' in summary && summary.receiptNo) {
    lines.push(`Dividend receipt: ${summary.receiptNo}`);
  }
  if ('me' in summary) {
    const me = (summary as any).me;
    if (me.iWon) {
      lines.push(
        me.excludedFromDividend
          ? 'You won! Dividend does not apply to the winning ticket this period.'
          : `You won! Your dividend: ₹${me.myDividend.toLocaleString('en-IN')}.`,
      );
    } else {
      lines.push(
        `Your dividend: ₹${me.myDividend.toLocaleString('en-IN')}${me.myNextDue != null ? `, next due now ₹${me.myNextDue.toLocaleString('en-IN')}` : ''}.`,
      );
    }
  }
  return lines.join('\n');
}
