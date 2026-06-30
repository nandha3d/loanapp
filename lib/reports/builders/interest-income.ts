import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildInterestIncome(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, loanType } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Fetch instalments within period
  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: dateFrom, lte: dateTo },
      loan: {
        tenantId,
        appType,
        ...branchFilter,
        ...(loanType ? { loanType } : {}),
      },
    },
    include: {
      loan: {
        select: {
          principal: true,
          totalPayable: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Group by Date (YYYY-MM-DD)
  const groupMap = new Map<string, { count: number; accrued: number; collected: number }>();

  instalments.forEach((inst) => {
    const key = inst.dueDate.toISOString().slice(0, 10);
    if (!groupMap.has(key)) {
      groupMap.set(key, { count: 0, accrued: 0, collected: 0 });
    }

    const principal = Number(inst.loan.principal);
    const payable = Number(inst.loan.totalPayable);
    
    // Interest fraction
    const interestRatio = payable > 0 ? (payable - principal) / payable : 0;

    const accruedInterest = Number(inst.dueAmount) * interestRatio;
    const collectedInterest = Number(inst.receivedAmount || 0) * interestRatio;

    const item = groupMap.get(key)!;
    item.count++;
    item.accrued += accruedInterest;
    item.collected += collectedInterest;
  });

  let grandLoans = 0;
  let grandAccrued = 0;
  let grandCollected = 0;
  let grandPending = 0;

  const rows = Array.from(groupMap.entries()).map(([dateStr, item]) => {
    const pending = Math.max(0, item.accrued - item.collected);
    grandLoans += item.count;
    grandAccrued += item.accrued;
    grandCollected += item.collected;
    grandPending += pending;

    return {
      period: dateStr,
      loans: item.count,
      accrued: item.accrued,
      collected: item.collected,
      pending,
    };
  });

  const successRate = grandAccrued > 0 ? Math.round((grandCollected / grandAccrued) * 100) : 0;

  return {
    title: 'reports.interestIncome.title',
    columns: [
      { key: 'period', label: 'reports.col.period', align: 'left', type: 'text' },
      { key: 'loans', label: 'reports.col.loans', align: 'right', type: 'number' },
      { key: 'accrued', label: 'reports.col.accrued', align: 'right', type: 'currency', total: true },
      { key: 'collected', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'pending', label: 'reports.col.pending', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      accrued: grandAccrued,
      collected: grandCollected,
      pending: grandPending,
    },
    kpis: [
      { label: 'periodInterestIncome', value: grandCollected },
      { label: 'collectedVsAccrued', value: `${successRate}%` },
      { label: 'pendingInterest', value: grandPending },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
