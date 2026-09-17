import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildLoanTypeReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, status, frequency, loanType } = params;

  const branchFilter = branchId ? { branchId } : {};

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // Group-by toggle: if a frequency filter is supplied we still group by
  // loanType (frequency acts as a filter); default grouping is by frequency.
  const groupBy: 'frequency' | 'loanType' = loanType ? 'loanType' : 'frequency';

  const where: any = {
    tenantId,
    appType,
    ...branchFilter,
    startDate: { gte: dateFrom, lte: dateTo },
    ...(status ? { status } : {}),
    ...(frequency ? { frequency } : {}),
    ...(loanType ? { loanType } : {}),
    ...(agentId ? { customer: { agentId } } : {}),
  };

  const grouped = await prisma.loan.groupBy({
    by: [groupBy],
    where,
    _count: { _all: true },
    _sum: { principal: true, totalPayable: true, totalCollected: true },
  });

  let totalCount = 0;
  let totalValue = 0;
  let totalOutstanding = 0;
  let totalCollected = 0;

  const rows = grouped.map((g: any) => {
    const count = g._count._all;
    const value = Number(g._sum.totalPayable || 0);
    const collected = Number(g._sum.totalCollected || 0);
    const outstanding = Math.max(0, value - collected);

    totalCount += count;
    totalValue += value;
    totalOutstanding += outstanding;
    totalCollected += collected;

    return {
      bucket: g[groupBy],
      count,
      value,
      outstanding,
      collected,
    };
  });

  rows.sort((a, b) => b.value - a.value);

  const collectionPct = totalValue > 0 ? Math.round((totalCollected / totalValue) * 100) : 0;

  return {
    title: 'reports.loanType.title',
    columns: [
      { key: 'bucket', label: 'reports.col.bucket', align: 'left', type: 'text' },
      { key: 'count', label: 'reports.col.count', align: 'right', type: 'number', total: true },
      { key: 'value', label: 'reports.col.value', align: 'right', type: 'currency', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'collected', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      count: totalCount,
      value: totalValue,
      outstanding: totalOutstanding,
      collected: totalCollected,
    },
    kpis: [
      { label: 'totalLoans', value: totalCount },
      { label: 'totalValue', value: totalValue },
      { label: 'totalOutstanding', value: totalOutstanding },
      { label: 'collectionPercent', value: `${collectionPct}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
