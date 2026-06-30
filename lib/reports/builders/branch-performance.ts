import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildBranchPerformance(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, loanType } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // Multi-branch rollup — intentionally spans ALL branches for this tenant (branchId filter ignored).
  const branches = await prisma.branch.findMany({
    where: { tenantId, status: 'active' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const branchIds = branches.map((b) => b.id);

  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      deletedAt: null,
      branchId: { in: branchIds },
      ...(loanType ? { loanType } : {}),
      startDate: { gte: dateFrom, lte: dateTo },
    },
    select: {
      branchId: true,
      status: true,
      principal: true,
      totalPayable: true,
      totalCollected: true,
    },
  });

  const collections = await prisma.dailyCollection.findMany({
    where: {
      tenantId,
      appType,
      branchId: { in: branchIds },
      date: { gte: dateFrom, lte: dateTo },
    },
    select: { branchId: true, totalExpected: true, totalCollected: true },
  });

  const byBranch = new Map<
    string,
    { activeLoans: number; disbursed: number; collected: number; outstanding: number; expected: number; collectedInRange: number }
  >();
  branchIds.forEach((id) =>
    byBranch.set(id, { activeLoans: 0, disbursed: 0, collected: 0, outstanding: 0, expected: 0, collectedInRange: 0 }),
  );

  loans.forEach((loan) => {
    if (!loan.branchId) return;
    const entry = byBranch.get(loan.branchId);
    if (!entry) return;
    const principal = Number(loan.principal);
    const payable = Number(loan.totalPayable);
    const collected = Number(loan.totalCollected || 0);
    if (loan.status === 'active' || loan.status === 'overdue') {
      entry.activeLoans += 1;
    }
    entry.disbursed += principal;
    entry.collected += collected;
    entry.outstanding += Math.max(0, payable - collected);
  });

  collections.forEach((c) => {
    if (!c.branchId) return;
    const entry = byBranch.get(c.branchId);
    if (!entry) return;
    entry.expected += Number(c.totalExpected);
    entry.collectedInRange += Number(c.totalCollected);
  });

  let grandActiveLoans = 0;
  let grandDisbursed = 0;
  let grandCollected = 0;
  let grandOutstanding = 0;

  let bestBranchName = '—';
  let bestRecovery = -1;
  let recoverySum = 0;

  const rows = branches.map((b) => {
    const entry = byBranch.get(b.id)!;
    const recovery = entry.expected > 0 ? Math.round((entry.collectedInRange / entry.expected) * 100) : 0;

    grandActiveLoans += entry.activeLoans;
    grandDisbursed += entry.disbursed;
    grandCollected += entry.collected;
    grandOutstanding += entry.outstanding;
    recoverySum += recovery;

    if (recovery > bestRecovery) {
      bestRecovery = recovery;
      bestBranchName = b.name;
    }

    return {
      branchName: b.name,
      activeLoans: entry.activeLoans,
      disbursed: entry.disbursed,
      collected: entry.collected,
      outstanding: entry.outstanding,
      recovery,
    };
  });

  const avgRecovery = rows.length > 0 ? Math.round(recoverySum / rows.length) : 0;

  return {
    title: 'reports.branchPerformance.title',
    columns: [
      { key: 'branchName', label: 'reports.col.branch', align: 'left', type: 'text' },
      { key: 'activeLoans', label: 'reports.col.activeLoans', align: 'right', type: 'number', total: true },
      { key: 'disbursed', label: 'reports.col.disbursed', align: 'right', type: 'currency', total: true },
      { key: 'collected', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'recovery', label: 'reports.col.recovery', align: 'right', type: 'percent' },
    ],
    rows,
    totals: {
      activeLoans: grandActiveLoans,
      disbursed: grandDisbursed,
      collected: grandCollected,
      outstanding: grandOutstanding,
    },
    kpis: [
      { label: 'bestBranch', value: bestBranchName },
      { label: 'totalOutstanding', value: grandOutstanding },
      { label: 'avgRecovery', value: `${avgRecovery}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
