import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildLoanStatusReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, loanType, status } = params;

  const branchFilter = branchId ? { branchId } : {};

  const dateFrom = from ? new Date(from) : undefined;
  if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
  const dateTo = to ? new Date(to) : undefined;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  const where: any = {
    tenantId,
    appType,
    ...branchFilter,
    ...(dateFrom && dateTo ? { startDate: { gte: dateFrom, lte: dateTo } } : {}),
    ...(loanType ? { loanType } : {}),
    ...(agentId ? { customer: { agentId } } : {}),
    ...(status ? { status } : {}),
  };

  // Summary: one row per distinct status with count/principal/outstanding.
  const grouped = await prisma.loan.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    _sum: { principal: true, totalPayable: true, totalCollected: true },
  });

  let totalCount = 0;
  let totalPrincipal = 0;
  let totalOutstanding = 0;

  const rows = grouped.map((g) => {
    const count = g._count._all;
    const principal = Number(g._sum.principal || 0);
    const payable = Number(g._sum.totalPayable || 0);
    const collected = Number(g._sum.totalCollected || 0);
    const outstanding = Math.max(0, payable - collected);

    totalCount += count;
    totalPrincipal += principal;
    totalOutstanding += outstanding;

    return {
      status: g.status,
      count,
      principal,
      outstanding,
    };
  });

  rows.sort((a, b) => b.count - a.count);

  const kpis = rows.map((r) => ({
    label: r.status,
    value: `${r.count} (${r.outstanding.toFixed(0)})`,
  }));

  return {
    title: 'reports.loanStatus.title',
    columns: [
      { key: 'status', label: 'reports.col.status', align: 'left', type: 'badge' },
      { key: 'count', label: 'reports.col.count', align: 'right', type: 'number', total: true },
      { key: 'principal', label: 'reports.col.principal', align: 'right', type: 'currency', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      count: totalCount,
      principal: totalPrincipal,
      outstanding: totalOutstanding,
    },
    kpis,
    meta: {
      currencySymbol: '₹',
    },
  };
}
