import { prisma } from '@/lib/db';
import { getPeriodKey } from '@/lib/accounting/premium';

/**
 * Operational summary — reads directly from CollectionEntry / Loan / AccountEntry.
 * Used when JournalEntry data is absent or supplementary.
 */
export async function getOperationalSummary(
  tenantId: string,
  branchId: string | null,
  period: { from: Date; to: Date },
) {
  const branchWhere = branchId ? { branchId } : {};
  const collectionBranchWhere = branchId ? { loan: { branchId } } : {};

  const [collectedRows, disbursedRows, expenseRows, loansOutstanding] = await Promise.all([
    // Verified collections in period
    prisma.collectionEntry.aggregate({
      where: {
        tenantId,
        ...collectionBranchWhere,
        verificationStatus: 'verified',
        submittedAt: { gte: period.from, lte: period.to },
      },
      _sum: { receivedAmount: true },
    }),
    // Account entries for loan disbursals in period
    prisma.accountEntry.aggregate({
      where: {
        tenantId,
        ...branchWhere,
        type: 'loan_disburse',
        entryDate: { gte: period.from, lte: period.to },
      },
      _sum: { amount: true },
    }),
    // Expenses in period
    prisma.accountEntry.aggregate({
      where: {
        tenantId,
        ...branchWhere,
        type: 'expense',
        entryDate: { gte: period.from, lte: period.to },
      },
      _sum: { amount: true },
    }),
    // Outstanding principal on active loans
    prisma.loan.aggregate({
      where: {
        tenantId,
        ...branchWhere,
        status: { in: ['active', 'overdue'] },
      },
      _sum: { principal: true },
    }),
  ]);

  const collected   = Number(collectedRows._sum?.receivedAmount ?? 0);
  const disbursed   = Number(disbursedRows._sum?.amount ?? 0);
  const expenses    = Number(expenseRows._sum?.amount ?? 0);
  const outstanding = Number(loansOutstanding._sum?.principal ?? 0);

  return { collected, disbursed, expenses, outstanding, netProfit: collected - expenses };
}

/** Daily cashflow from operational data (CollectionEntry + AccountEntry) */
export async function getOperationalCashflowSeries(
  tenantId: string,
  branchId: string | null,
  from: Date,
  to: Date,
): Promise<Array<{ date: string; inflow: number; outflow: number }>> {
  const branchWhere = branchId ? { branchId } : {};
  const collectionBranchWhere = branchId ? { loan: { branchId } } : {};

  const [collections, disbursals, expenses] = await Promise.all([
    prisma.collectionEntry.findMany({
      where: { tenantId, ...collectionBranchWhere, verificationStatus: 'verified', submittedAt: { gte: from, lte: to } },
      select: { receivedAmount: true, submittedAt: true },
    }),
    prisma.accountEntry.findMany({
      where: { tenantId, ...branchWhere, type: 'loan_disburse', entryDate: { gte: from, lte: to } },
      select: { amount: true, entryDate: true },
    }),
    prisma.accountEntry.findMany({
      where: { tenantId, ...branchWhere, type: 'expense', entryDate: { gte: from, lte: to } },
      select: { amount: true, entryDate: true },
    }),
  ]);

  const map = new Map<string, { inflow: number; outflow: number }>();
  const add = (dateStr: string, inflow: number, outflow: number) => {
    const e = map.get(dateStr) ?? { inflow: 0, outflow: 0 };
    e.inflow += inflow; e.outflow += outflow;
    map.set(dateStr, e);
  };

  for (const c of collections) add(c.submittedAt.toISOString().slice(0,10), Number(c.receivedAmount), 0);
  for (const d of disbursals)  add(d.entryDate.toISOString().slice(0,10), 0, Number(d.amount));
  for (const e of expenses)    add(e.entryDate.toISOString().slice(0,10), 0, Number(e.amount));

  const filled: Array<{ date: string; inflow: number; outflow: number }> = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const ds = cursor.toISOString().slice(0,10);
    const entry = map.get(ds);
    filled.push({ date: ds, inflow: entry?.inflow ?? 0, outflow: entry?.outflow ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return filled;
}

export async function getCashBankBalance(
  tenantId: string,
  branchId: string | null,
  asOfDate: Date,
): Promise<number> {
  const periodKey = getPeriodKey(asOfDate);

  const balances = await prisma.accountBalance.findMany({
    where: {
      tenantId,
      periodKey,
      account: {
        tenantId,
        subType: { in: ['cash', 'bank'] },
        isActive: true,
      },
    },
    select: { closingDr: true, closingCr: true },
  });

  return balances.reduce(
    (sum, b) => sum + Number(b.closingDr) - Number(b.closingCr),
    0,
  );
}

export async function getNetProfit(
  tenantId: string,
  branchId: string | null,
  period: { from: Date; to: Date },
): Promise<number> {
  const entryWhere: Record<string, unknown> = {
    tenantId,
    status: 'posted',
    entryDate: { gte: period.from, lte: period.to },
    ...(branchId ? { branchId } : {}),
  };

  const incomeLines = await prisma.journalLine.findMany({
    where: {
      entry: entryWhere,
      account: { tenantId, classType: 'income' },
    },
    select: { debit: true, credit: true },
  });

  const expenseLines = await prisma.journalLine.findMany({
    where: {
      entry: entryWhere,
      account: { tenantId, classType: 'expense' },
    },
    select: { debit: true, credit: true },
  });

  const income = incomeLines.reduce(
    (sum, l) => sum + Number(l.credit) - Number(l.debit),
    0,
  );
  const expense = expenseLines.reduce(
    (sum, l) => sum + Number(l.debit) - Number(l.credit),
    0,
  );

  return income - expense;
}

export async function getAccountBalance(
  tenantId: string,
  branchId: string | null,
  code: string,
  asOfDate: Date,
): Promise<number> {
  const periodKey = getPeriodKey(asOfDate);

  const account = await prisma.account.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  if (!account) return 0;

  const balance = await prisma.accountBalance.findUnique({
    where: { accountId_periodKey: { accountId: account.id, periodKey } },
    select: { closingDr: true, closingCr: true },
  });
  if (!balance) return 0;

  return Number(balance.closingDr) - Number(balance.closingCr);
}

export async function getOpenBillsTotal(
  tenantId: string,
  branchId: string | null,
  asOfDate: Date,
): Promise<number> {
  const bills = await prisma.bill.findMany({
    where: {
      tenantId,
      status: { in: ['unpaid', 'partial'] },
      billDate: { lte: asOfDate },
    },
    select: { totalAmount: true, paidAmount: true },
  });

  return bills.reduce(
    (sum, b) => sum + Number(b.totalAmount) - Number(b.paidAmount),
    0,
  );
}

export async function getDailyCashflowSeries(
  tenantId: string,
  branchId: string | null,
  from: Date,
  to: Date,
): Promise<Array<{ date: string; inflow: number; outflow: number }>> {
  const lines = await prisma.journalLine.findMany({
    where: {
      account: { tenantId, subType: { in: ['cash', 'bank'] } },
      entry: {
        tenantId,
        status: 'posted',
        entryDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
    },
    select: {
      debit: true,
      credit: true,
      entry: { select: { entryDate: true } },
    },
  });

  // Aggregate lines into a date -> {inflow, outflow} map
  const map = new Map<string, { inflow: number; outflow: number }>();

  for (const line of lines) {
    const dateStr = line.entry.entryDate.toISOString().slice(0, 10);
    const existing = map.get(dateStr) ?? { inflow: 0, outflow: 0 };
    existing.inflow += Number(line.debit);
    existing.outflow += Number(line.credit);
    map.set(dateStr, existing);
  }

  // Fill every day in [from, to] — zero if no transactions
  const filled: Array<{ date: string; inflow: number; outflow: number }> = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const entry = map.get(dateStr);
    filled.push({ date: dateStr, inflow: entry?.inflow ?? 0, outflow: entry?.outflow ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return filled;
}

export async function getTopExpenses(
  tenantId: string,
  branchId: string | null,
  period: { from: Date; to: Date },
  limit: number,
): Promise<Array<{ accountId: string; name: string; total: number }>> {
  const entryWhere: Record<string, unknown> = {
    tenantId,
    status: 'posted',
    entryDate: { gte: period.from, lte: period.to },
    ...(branchId ? { branchId } : {}),
  };

  const grouped = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      entry: entryWhere,
      account: { tenantId, classType: 'expense' },
    },
    _sum: { debit: true, credit: true },
  });

  const accountIds = grouped.map((g) => g.accountId);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, name: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  const results = grouped
    .map((g) => ({
      accountId: g.accountId,
      name: accountMap.get(g.accountId) ?? g.accountId,
      total: Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return results;
}

export async function getPendingApprovalsForUser(
  userId: string,
  tenantId: string,
  branchId: string | null,
  limit: number,
): Promise<any[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const role = user?.role ?? '';

  const approvals = await prisma.accountingApproval.findMany({
    where: {
      tenantId,
      status: 'pending',
      ...(['superadmin', 'developer'].includes(role)
        ? {}
        : { approverRole: role }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      requestedBy: { select: { name: true } },
    },
  });

  return approvals;
}

export async function getBillsDueWithin(
  tenantId: string,
  branchId: string | null,
  days: number,
): Promise<any[]> {
  const today = new Date();
  const dueThreshold = new Date(today);
  dueThreshold.setDate(today.getDate() + days);

  const bills = await prisma.bill.findMany({
    where: {
      tenantId,
      status: { in: ['unpaid', 'partial'] },
      dueDate: { lte: dueThreshold },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
    include: {
      vendor: { select: { name: true } },
    },
  });

  return bills;
}

export async function getPeriodStatus(
  tenantId: string,
  from: Date,
): Promise<{ status: string; lastLockedAt: Date | null } | null> {
  const periodKey = getPeriodKey(from);

  const period = await prisma.accountingPeriod.findUnique({
    where: { tenantId_periodKey: { tenantId, periodKey } },
    select: { status: true, lockedAt: true },
  });

  if (!period) return null;

  return {
    status: period.status,
    lastLockedAt: period.lockedAt ?? null,
  };
}
