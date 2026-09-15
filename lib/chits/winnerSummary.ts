// Full post-win summary — staff sees every member's dividend, a member sees
// only their own figures. Every number here is already persisted on
// ChitAuction at finalize time (lib/chits/finalize.ts); this module only
// re-derives the distributable/eligible-members breakdown (via the same
// pure calculateChitAuction using the persisted prizeAmount as input, so it
// can never drift from what finalize actually computed) and formats it.
import prisma from '../db';
import { calculateChitAuction, roundMoney } from './calculations';

export async function buildWinnerSummary(
  auctionId: string,
  opts: { audience: 'staff' | 'member'; memberId?: string },
) {
  const auction = await prisma.chitAuction.findUnique({
    where: { id: auctionId },
    include: {
      chitGroup: {
        select: {
          name: true, chitValue: true, commissionPct: true, commissionBasis: true,
          gstPct: true, dividendPolicy: true, dividendDistribution: true, dividendRounding: true,
          totalMembers: true, branchId: true,
        },
      },
      winnerMember: { include: { customer: { select: { name: true, phone: true } } } },
    },
  });
  // Not yet confirmed (still pending/in_progress) — nothing to summarize.
  if (!auction || !['confirmed', 'paid', 'completed'].includes(auction.status)) return null;

  const group = auction.chitGroup;
  const calc = calculateChitAuction({
    chitValue: Number(group.chitValue),
    prizeAmount: Number(auction.prizeAmount),
    commissionPct: Number(group.commissionPct),
    totalMembers: group.totalMembers,
    dividendPolicy: group.dividendPolicy as any,
    commissionBasis: group.commissionBasis as any,
    gstPct: group.gstPct != null ? Number(group.gstPct) : null,
    dividendRounding: group.dividendRounding,
  });

  const base = {
    groupName: group.name,
    periodNumber: auction.periodNumber,
    winnerName: auction.winnerMember?.customer.name ?? null,
    winnerTicketNo: auction.winnerMember?.ticketNo ?? null,
    chitValue: calc.chitValue,
    prizeAmount: calc.prizeAmount,
    bidDiscount: calc.bidDiscount,
    commissionPct: Number(group.commissionPct),
    commissionBasis: group.commissionBasis as 'BID_DISCOUNT' | 'CHIT_VALUE',
    commission: calc.commission,
    gstPct: group.gstPct != null ? Number(group.gstPct) : null,
    gstAmount: calc.gstAmount,
    distributableDividend: calc.distributableDividend,
    dividendEligibleMembers: calc.dividendEligibleMembers,
    dividend: calc.dividend,
    roundingIncome: calc.roundingIncome,
    dividendPolicy: group.dividendPolicy,
    dividendDistribution: group.dividendDistribution,
  };

  if (opts.audience === 'staff') {
    // Full per-member dividend table — reuses applyDividendDistribution's
    // member-selection rule (NON_WINNERS_ONLY excludes the winner ticket),
    // read-only here, no writes.
    const members = await prisma.chitMember.findMany({
      where: {
        chitGroupId: auction.chitGroupId,
        ...(group.dividendPolicy === 'NON_WINNERS_ONLY' && auction.winnerMember?.ticketNo
          ? { NOT: { ticketNo: auction.winnerMember.ticketNo } }
          : {}),
      },
      select: { id: true, ticketNo: true, ticketShare: true, customer: { select: { name: true } } },
    });
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
    return {
      ...base,
      receiptNo,
      memberDividends: members.map((m) => ({
        ticketNo: m.ticketNo,
        name: m.customer.name,
        dividend: roundMoney(calc.dividend * Number(m.ticketShare)),
      })),
    };
  }

  // Member audience: only "my" figures, scoped to opts.memberId — never
  // trust a body-supplied memberId, same rule as customerAuction.ts.
  const iWon = auction.winnerMemberId === opts.memberId;
  const excludedFromDividend = group.dividendPolicy === 'NON_WINNERS_ONLY' && iWon;
  const mySub = await prisma.chitSubscription.findFirst({
    where: { memberId: opts.memberId, periodNumber: auction.periodNumber + 1 },
    select: { dueAmount: true },
  });
  const myMember = opts.memberId
    ? await prisma.chitMember.findUnique({ where: { id: opts.memberId }, select: { ticketShare: true } })
    : null;
  const myDividend = excludedFromDividend || !myMember
    ? 0
    : roundMoney(calc.dividend * Number(myMember.ticketShare));

  return {
    ...base,
    me: {
      iWon,
      excludedFromDividend,
      myDividend,
      myNextDue: mySub ? Number(mySub.dueAmount) : null,
    },
  };
}

export function formatWinnerSummaryText(summary: NonNullable<Awaited<ReturnType<typeof buildWinnerSummary>>>): string {
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
      lines.push(me.excludedFromDividend
        ? 'You won! Dividend does not apply to the winning ticket this period.'
        : `You won! Your dividend: ₹${me.myDividend.toLocaleString('en-IN')}.`);
    } else {
      lines.push(`Your dividend: ₹${me.myDividend.toLocaleString('en-IN')}${me.myNextDue != null ? `, next due now ₹${me.myNextDue.toLocaleString('en-IN')}` : ''}.`);
    }
  }
  return lines.join('\n');
}
