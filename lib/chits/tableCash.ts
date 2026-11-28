import { roundMoney } from './calculations';
import { collectChitSubscriptionPayment } from './collections';
import { parseChitEngineConfig, resolveEngineTypeFromGroup } from './engineTypes';

export type TableCashStatus = 'paid' | 'partial' | 'pending' | 'waived';

export interface TableCashMemberRow {
  memberId: string;
  ticketNo: number;
  memberName: string;
  customerPhone: string | null;
  hasWon: boolean;
  isCurrentWinner: boolean;
  subscriptionId: string | null;
  dueAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: TableCashStatus;
  receiptNo: string | null;
  paymentMode: string | null;
}

export interface AuctionTableCashSummary {
  enabled: boolean;
  allowWinnerSettleAfterAuction: boolean;
  periodNumber: number;
  totalTickets: number;
  settledTickets: number;
  pendingTickets: number;
  totalDueAmount: number;
  totalCollectedAmount: number;
  totalPendingAmount: number;
  allSettled: boolean;
  winnerRow: TableCashMemberRow | null;
  rows: TableCashMemberRow[];
}

export interface TableCashMemberInput {
  id: string;
  memberNumber: number;
  ticketNo: number | null;
  ticketShare?: number | string | null;
  hasWon: boolean;
  subscriberStatus?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
  } | null;
}

export interface TableCashSubscriptionInput {
  id: string;
  memberId: string;
  dueAmount: number | string;
  paidAmount: number | string;
  status: string;
  lastReceiptNo?: string | null;
  paymentMode?: string | null;
}

/**
 * Pure deterministic server computation of Period Table Cash status across
 * enrolled members (STABLE-8: calculations live in lib/ and never in JSX).
 */
export function computeTableCashSummaryFromData(params: {
  enabled: boolean;
  allowWinnerSettleAfterAuction?: boolean;
  periodNumber: number;
  monthlyContrib: number;
  winnerMemberId?: string | null;
  members: TableCashMemberInput[];
  subscriptions: TableCashSubscriptionInput[];
}): AuctionTableCashSummary {
  const {
    enabled,
    allowWinnerSettleAfterAuction = true,
    periodNumber,
    monthlyContrib,
    winnerMemberId,
    members,
    subscriptions,
  } = params;

  const activeMembers = members.filter(
    (m) => !m.subscriberStatus || m.subscriberStatus === 'active',
  );
  const subByMemberId = new Map(subscriptions.map((s) => [s.memberId, s]));

  const rows: TableCashMemberRow[] = activeMembers
    .map((m) => {
      const sub = subByMemberId.get(m.id);
      const share = Number(m.ticketShare ?? 1) || 1;
      const fallbackDue = roundMoney(Number(monthlyContrib) * share);
      const dueAmount = sub ? roundMoney(Number(sub.dueAmount)) : fallbackDue;
      const paidAmount = sub ? roundMoney(Number(sub.paidAmount)) : 0;
      const rawStatus = sub?.status ?? 'pending';
      const status: TableCashStatus =
        rawStatus === 'waived'
          ? 'waived'
          : paidAmount >= dueAmount && dueAmount > 0
            ? 'paid'
            : paidAmount > 0
              ? 'partial'
              : 'pending';
      const remainingAmount =
        status === 'waived' || status === 'paid'
          ? 0
          : roundMoney(Math.max(0, dueAmount - paidAmount));

      return {
        memberId: m.id,
        ticketNo: Number(m.ticketNo ?? m.memberNumber),
        memberName: m.customer?.name ?? `Member #${m.ticketNo ?? m.memberNumber}`,
        customerPhone: m.customer?.phone ?? null,
        hasWon: Boolean(m.hasWon),
        isCurrentWinner: Boolean(winnerMemberId && winnerMemberId === m.id),
        subscriptionId: sub?.id ?? null,
        dueAmount,
        paidAmount,
        remainingAmount,
        status,
        receiptNo: sub?.lastReceiptNo ?? null,
        paymentMode: sub?.paymentMode ?? null,
      };
    })
    .sort((a, b) => a.ticketNo - b.ticketNo);

  const settledTickets = rows.filter(
    (r) => r.status === 'paid' || r.status === 'waived' || r.remainingAmount <= 0,
  ).length;
  const totalTickets = rows.length;
  const pendingTickets = Math.max(0, totalTickets - settledTickets);
  const totalDueAmount = roundMoney(rows.reduce((sum, r) => sum + r.dueAmount, 0));
  const totalCollectedAmount = roundMoney(rows.reduce((sum, r) => sum + r.paidAmount, 0));
  const totalPendingAmount = roundMoney(rows.reduce((sum, r) => sum + r.remainingAmount, 0));
  const winnerRow = rows.find((r) => r.isCurrentWinner) ?? null;

  return {
    enabled,
    allowWinnerSettleAfterAuction,
    periodNumber,
    totalTickets,
    settledTickets,
    pendingTickets,
    totalDueAmount,
    totalCollectedAmount,
    totalPendingAmount,
    allSettled: enabled ? (totalTickets > 0 && pendingTickets === 0) : true,
    winnerRow,
    rows,
  };
}

/**
 * Loads the current cycle's Table Cash settlement status from the database.
 */
export async function loadAuctionTableCashSummary(
  db: any,
  params: {
    chitGroupId: string;
    periodNumber: number;
    monthlyContrib: number | string;
    winnerMemberId?: string | null;
    chitEngineType?: string | null;
    auctionType?: string | null;
    engineConfig?: string | null;
  },
): Promise<AuctionTableCashSummary> {
  const engineType = resolveEngineTypeFromGroup({
    chitEngineType: params.chitEngineType,
    auctionType: params.auctionType,
  });
  const cfg = parseChitEngineConfig(params.engineConfig, engineType);
  const enabled = Boolean(cfg.tableCash?.enabled);
  const allowWinnerSettleAfterAuction = cfg.tableCash?.allowWinnerSettleAfterAuction !== false;

  const [members, subscriptions] = await Promise.all([
    db.chitMember.findMany({
      where: { chitGroupId: params.chitGroupId },
      select: {
        id: true,
        memberNumber: true,
        ticketNo: true,
        ticketShare: true,
        hasWon: true,
        subscriberStatus: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: [{ ticketNo: 'asc' }, { memberNumber: 'asc' }],
    }),
    db.chitSubscription.findMany({
      where: {
        periodNumber: params.periodNumber,
        member: { chitGroupId: params.chitGroupId },
      },
      select: {
        id: true,
        memberId: true,
        dueAmount: true,
        paidAmount: true,
        status: true,
        lastReceiptNo: true,
        paymentMode: true,
      },
    }),
  ]);

  return computeTableCashSummaryFromData({
    enabled,
    allowWinnerSettleAfterAuction,
    periodNumber: params.periodNumber,
    monthlyContrib: Number(params.monthlyContrib) || 0,
    winnerMemberId: params.winnerMemberId ?? null,
    members,
    subscriptions,
  });
}

/**
 * Atomically settles a member's period Table Cash installment inside an open Prisma
 * transaction using canonical `collectChitSubscriptionPayment` (CHIT-23..25, MONEY-17).
 */
export async function settleAuctionTableCashMemberInTx(
  tx: any,
  params: {
    tenantId: string;
    appType: string;
    chitGroupId: string;
    periodNumber: number;
    memberId: string;
    collectorId: string;
    paymentMode: string;
    amount?: number;
    notes?: string | null;
  },
): Promise<{ skipped: boolean; receiptNo?: string }> {
  const [group, member, auction] = await Promise.all([
    tx.chitGroup.findUnique({
      where: { id: params.chitGroupId },
      select: {
        id: true,
        monthlyContrib: true,
        chitEngineType: true,
        auctionType: true,
        engineConfig: true,
        branchId: true,
        branch: { select: { code: true } },
      },
    }),
    tx.chitMember.findFirst({
      where: { id: params.memberId, chitGroupId: params.chitGroupId },
      select: { id: true, ticketShare: true },
    }),
    tx.chitAuction.findFirst({
      where: { chitGroupId: params.chitGroupId, periodNumber: params.periodNumber },
      select: { id: true, auctionDate: true },
    }),
  ]);

  if (!group || !member) {
    throw new Error('Chit group or member not found');
  }

  let sub = await tx.chitSubscription.findFirst({
    where: { memberId: member.id, periodNumber: params.periodNumber },
  });

  if (!sub) {
    const share = Number(member.ticketShare ?? 1) || 1;
    const dueAmount = roundMoney(Number(group.monthlyContrib) * share);
    sub = await tx.chitSubscription.create({
      data: {
        tenantId: params.tenantId,
        appType: params.appType,
        branchId: group.branchId,
        memberId: member.id,
        auctionId: auction?.id ?? null,
        periodNumber: params.periodNumber,
        dueDate: auction?.auctionDate ?? new Date(),
        dueAmount,
        paidAmount: 0,
        dividendApplied: 0,
        status: 'pending',
      },
    });
  }

  const dueAmount = roundMoney(Number(sub.dueAmount));
  const currentPaidAmount = roundMoney(Number(sub.paidAmount));
  const remaining = roundMoney(Math.max(0, dueAmount - currentPaidAmount));
  if (sub.status === 'paid' || sub.status === 'waived' || remaining <= 0) {
    return { skipped: true };
  }

  const targetAmount =
    params.amount != null && params.amount > 0
      ? Math.min(remaining, roundMoney(params.amount))
      : remaining;
  if (!(targetAmount > 0)) {
    return { skipped: true };
  }

  const engineType = resolveEngineTypeFromGroup(group);
  const engineCfg = parseChitEngineConfig(group.engineConfig, engineType);
  const goldRatePerGram = engineCfg.goldScheme?.defaultGoldRatePerGram ?? null;

  const result = await collectChitSubscriptionPayment(tx, {
    tenantId: params.tenantId,
    appType: params.appType,
    branchId: group.branchId,
    branchCode: group.branch?.code ?? null,
    subscriptionId: sub.id,
    currentPaidAmount,
    dueAmount,
    amount: targetAmount,
    mode: 'ADD_PAYMENT',
    paymentMode: params.paymentMode || 'cash',
    notes: params.notes ?? `Table Cash — Period ${params.periodNumber}`,
    collectorId: params.collectorId,
    isGoldWeightEngine: engineType === 'GOLD_WEIGHT_ACCUMULATION',
    goldRatePerGram,
    denominationBreakdown: null,
    denominationMode: 'OPTIONAL',
  });

  return { skipped: false, receiptNo: result.receiptNo };
}
