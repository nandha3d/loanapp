import prisma from '@/lib/db';
import { calculateChitAccountingMetrics } from '@/lib/accounting/chitSummary';
import { startOfBusinessDate } from '@/lib/businessTime';

export type AccountingRange = { from?: string | null; to?: string | null };

/** [from 00:00 IST, to+1 00:00 IST) — the IST days the web date filter picks. */
function inRange(value: Date | string, range: AccountingRange): boolean {
  const t = new Date(value).getTime();
  if (range.from && t < startOfBusinessDate(range.from).getTime()) return false;
  if (range.to && t >= startOfBusinessDate(range.to).getTime() + 24 * 60 * 60 * 1000) return false;
  return true;
}

/**
 * The KPI figures of the Accounting page for a date range — exactly the maths
 * AccountingClient ran in the browser, now on the server for web and mobile.
 */
export function computeAccountingMetrics(
  input: {
    entries: Array<{ type: string; amount: unknown; entryDate: Date | string }>;
    releases: Array<{ amount: unknown; createdAt: Date | string }>;
    loans: Array<{ startDate: Date | string; principal: unknown; deduction: unknown; totalPayable: unknown }>;
  },
  range: AccountingRange = {},
) {
  let capitalIn = 0;
  let capitalOut = 0;
  let totalDisbursed = 0;
  let totalCollected = 0;
  let totalExpenses = 0;
  let chitOutflows = 0;
  let penaltyIncome = 0;
  for (const e of input.entries) {
    if (!inRange(e.entryDate, range)) continue;
    const amt = Number(e.amount);
    switch (e.type) {
      case 'capital_add': capitalIn += amt; break;
      case 'capital_withdraw': capitalOut += amt; break;
      case 'loan_disburse': totalDisbursed += amt; break;
      case 'collection': totalCollected += amt; break;
      // DEC-06: penalty collected = cash in and revenue.
      case 'penalty_collection': penaltyIncome += amt; break;
      case 'expense': totalExpenses += amt; break;
      case 'chit_payout':
      case 'chit_dividend_payout': chitOutflows += amt; break;
    }
  }
  const releasedToAgents = input.releases
    .filter((r) => inRange(r.createdAt, range))
    .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);
  const loans = input.loans.filter((l) => inRange(l.startDate, range));
  const totalDeductions = loans.reduce((sum, l) => sum + Number(l.deduction), 0);
  const totalInterest = loans.reduce((sum, l) => sum + Number(l.totalPayable) - Number(l.principal), 0);
  const projectedRevenue = totalDeductions + totalInterest + penaltyIncome;
  return {
    capitalIn,
    capitalOut,
    totalDisbursed,
    totalCollected,
    totalExpenses,
    releasedToAgents,
    currentCapital: capitalIn - capitalOut - totalDisbursed + totalCollected + penaltyIncome - totalExpenses - chitOutflows,
    totalDeductions,
    totalInterest,
    penaltyIncome,
    projectedRevenue,
    projectedProfit: projectedRevenue - totalExpenses,
  };
}

/**
 * ACC-01 (D1): the accounting summary both clients render — the web Accounting
 * page and GET /api/v1/accounting. Loans in EVERY status count towards projected
 * revenue (D1). `metrics` are the date-ranged KPI figures the web page used to
 * compute in the browser; they are computed here once (MONEY-1).
 */
export async function getAccountingSummary(
  tenantId: string,
  appType: string,
  branchId?: string | null,
  range: AccountingRange = {},
) {
  const isChit = appType === 'chitfunds';
  // Get all entries for the tenant + active module
  const entries = await prisma.accountEntry.findMany({
    where: { tenantId, appType, ...(branchId ? { branchId } : {}) },
    orderBy: { entryDate: 'desc' },
    include: { user: { select: { name: true } } },
  });

  // Calculate totals
  let capitalIn = 0;
  let capitalOut = 0;
  // NET cash that physically left the business at disbursement (principal − upfront
  // fee). Used only for the capital/cash balance — NOT the "Total Disbursed" KPI,
  // which reports the gross loan book (see totalDisbursed below).
  let netDisbursed = 0;
  let totalCollected = 0;
  let totalExpenses = 0;
  let chitPayouts = 0; // prize money paid out to chit winners (cash out)
  let chitDividendPayouts = 0;
  let penaltyIncome = 0; // DEC-06

  for (const entry of entries) {
    const amt = Number(entry.amount);
    switch (entry.type) {
      case 'capital_add':
        capitalIn += amt;
        break;
      case 'capital_withdraw':
        capitalOut += amt;
        break;
      case 'loan_disburse':
        netDisbursed += amt;
        break;
      case 'collection':
        totalCollected += amt;
        break;
      case 'penalty_collection':
        penaltyIncome += amt;
        break;
      case 'expense':
        totalExpenses += amt;
        break;
      case 'chit_payout':
        chitPayouts += amt;
        break;
      case 'chit_dividend_payout':
        chitDividendPayouts += amt;
        break;
    }
  }

  // Capital/cash balance uses NET disbursed (actual cash out). e.g. 10,000 − 900
  // (net out) + 100 (collected) = 9,200. Chit prize payouts are cash out too.
  const currentCapital = capitalIn - capitalOut - netDisbursed + totalCollected + penaltyIncome - totalExpenses - chitPayouts - chitDividendPayouts;

  const loans = isChit ? [] : await prisma.loan.findMany({
    where: { tenantId, appType, ...(branchId ? { branchId } : {}) },
    select: {
      startDate: true,
      principal: true,
      deduction: true,
      totalPayable: true,
    },
  });

  const chitScope = {
    tenantId,
    appType: 'chitfunds',
    deletedAt: null,
    ...(branchId ? { branchId } : {}),
  };
  const [chitGroups, chitSubscriptions, chitAuctions] = isChit
    ? await Promise.all([
        prisma.chitGroup.findMany({
          where: chitScope,
          select: { status: true, chitValue: true, startDate: true },
        }),
        prisma.chitSubscription.findMany({
          where: { member: { chitGroup: chitScope } },
          select: {
            dueDate: true,
            paidAt: true,
            dueAmount: true,
            dividendAmount: true,
            interestAmount: true,
            penaltyAmount: true,
            paidAmount: true,
          },
        }),
        prisma.chitAuction.findMany({
          where: { chitGroup: chitScope },
          select: {
            auctionDate: true,
            completedAt: true,
            status: true,
            prizeAmount: true,
            dividend: true,
          },
        }),
      ])
    : [[], [], []];

  // Total Disbursed KPI = GROSS loan book (principal), e.g. 1,000 — not the net
  // cash (900). Profit = interest income recognized at disbursement: the upfront
  // fee (deduction) for upfront loans + (totalPayable − principal) for EMI loans.
  const totalDisbursed = loans.reduce((sum, l) => sum + Number(l.principal), 0);
  const interestIncome = loans.reduce(
    (sum, l) => sum + Number(l.deduction) + Math.max(0, Number(l.totalPayable) - Number(l.principal)),
    0,
  );
  const grossProfit = interestIncome + penaltyIncome;
  const netProfit = grossProfit - totalExpenses;
  const agentIds = branchId
    ? await prisma.user.findMany({
        where: { tenantId, branchId, role: 'agent' },
        select: { id: true },
      }).then((rows) => rows.map((row) => row.id))
    : null;
  const releaseWhere = {
    tenantId,
    appType,
    accountKind: 'branch',
    type: 'release',
    ...(branchId ? { branchId } : {}),
  };
  const [releasedAgg, releaseEntries, branchCashAgg, agentFloatAgg, allReleases] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: releaseWhere,
      _sum: { amount: true },
    }),
    prisma.walletTransaction.findMany({
      where: releaseWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.branchCashAccount.aggregate({
      where: { tenantId, appType, ...(branchId ? { branchId } : {}) },
      _sum: { balance: true },
    }),
    prisma.agentAccount.aggregate({
      where: { tenantId, appType, ...(agentIds ? { agentId: { in: agentIds } } : {}) },
      _sum: { balance: true },
    }),
    // Every release (not just the 100 listed) for the ranged KPI (ACC-01).
    prisma.walletTransaction.findMany({ where: releaseWhere, select: { amount: true, createdAt: true } }),
  ]);
  const releasedToAgents = Math.abs(Number(releasedAgg._sum.amount ?? 0));

  // Loan Book Outstanding = amount borrowers still owe (unpaid instalments on
  // live loans). This is the receivable asset — the cash you lent that is still
  // yours, just in someone else's hands.
  const outstandingAgg = isChit ? null : await prisma.instalment.aggregate({
    where: { loan: { tenantId, appType, status: { in: ['active', 'overdue'] }, ...(branchId ? { branchId } : {}) } },
    _sum: { dueAmount: true, receivedAmount: true },
  });
  const loanOutstanding = Math.max(
    0,
    Number(outstandingAgg?._sum.dueAmount ?? 0) - Number(outstandingAgg?._sum.receivedAmount ?? 0),
  );

  const branchCashAvailable = Number(branchCashAgg._sum.balance ?? 0);
  const agentFloat = Number(agentFloatAgg._sum.balance ?? 0);
  // Liquid Cash = all cash physically held (office safe + agents in the field).
  const liquidCash = branchCashAvailable + agentFloat;
  // Net Worth (Capital) = cash on hand + receivable. Stays flat when you lend
  // (cash drops, receivable rises by the same amount).
  const chitMetrics = calculateChitAccountingMetrics({
    groups: chitGroups,
    subscriptions: chitSubscriptions,
    auctions: chitAuctions,
  });
  const netWorth = liquidCash + (isChit ? chitMetrics.subscriptionReceivable : loanOutstanding);

  const commonSummary = {
    capitalIn,
    capitalOut,
    totalDisbursed,
    totalCollected,
    totalExpenses,
    currentCapital,
    liquidCash,
    loanOutstanding,
    netWorth,
    grossProfit,
    netProfit,
    penaltyIncome,
    releasedToAgents,
    branchCashAvailable,
    agentFloat,
    releaseEntries,
    entries,
    metrics: computeAccountingMetrics({ entries, releases: allReleases, loans }, range),
    range,
  };

  if (isChit) {
    return {
      ...commonSummary,
      kind: 'chit' as const,
      loans: [],
      chitGroups,
      chitSubscriptions,
      chitAuctions,
      chitMetrics,
    };
  }

  return {
    ...commonSummary,
    kind: 'lending' as const,
    loans,
  };
}
