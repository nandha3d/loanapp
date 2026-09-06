import prisma from '../../db';
import { getSetting } from '../../tenant';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildTopBorrowers(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId } = params;

  const branchFilter = branchId ? { branchId } : {};

  const topNSetting = await getSetting(tenantId, 'report_top_n', '20');
  const topN = parseInt(topNSetting, 10) || 20;

  const customerWhere: any = {
    tenantId,
    appType,
    ...branchFilter,
    ...(agentId ? { agentId } : {}),
  };

  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: { id: true, name: true },
  });
  const customerIds = customers.map((c) => c.id);
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  if (customerIds.length === 0) {
    return emptyPayload();
  }

  const grouped = await prisma.loan.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds }, tenantId, appType },
    _sum: { principal: true, totalPayable: true, totalCollected: true },
  });

  // Portfolio totals (for share %) computed over the full scoped set.
  const portfolioOutstandingTotal = grouped.reduce((sum, g) => {
    const payable = Number(g._sum.totalPayable || 0);
    const collected = Number(g._sum.totalCollected || 0);
    return sum + Math.max(0, payable - collected);
  }, 0);

  const loans = await prisma.loan.findMany({
    where: { customerId: { in: customerIds }, tenantId, appType },
    select: { customerId: true, status: true },
  });
  const activeLoansByCustomer = new Map<string, number>();
  for (const l of loans) {
    if (l.status === 'active') {
      activeLoansByCustomer.set(l.customerId, (activeLoansByCustomer.get(l.customerId) || 0) + 1);
    }
  }

  const ranked = grouped
    .map((g) => {
      const totalDisbursed = Number(g._sum.principal || 0);
      const payable = Number(g._sum.totalPayable || 0);
      const collected = Number(g._sum.totalCollected || 0);
      const outstanding = Math.max(0, payable - collected);
      return {
        customerId: g.customerId,
        totalDisbursed,
        outstanding,
        activeLoans: activeLoansByCustomer.get(g.customerId) || 0,
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, topN);

  let totalDisbursedSum = 0;
  let outstandingSum = 0;

  const rows = ranked.map((r, idx) => {
    totalDisbursedSum += r.totalDisbursed;
    outstandingSum += r.outstanding;
    const share = portfolioOutstandingTotal > 0 ? Number(((r.outstanding / portfolioOutstandingTotal) * 100).toFixed(2)) : 0;
    return {
      rank: idx + 1,
      customerName: nameById.get(r.customerId) || '',
      activeLoans: r.activeLoans,
      totalDisbursed: r.totalDisbursed,
      outstanding: r.outstanding,
      share,
    };
  });

  const top10Outstanding = rows.slice(0, 10).reduce((sum, r) => sum + r.outstanding, 0);
  const top10Share = portfolioOutstandingTotal > 0 ? Math.round((top10Outstanding / portfolioOutstandingTotal) * 100) : 0;
  const largestExposure = rows.length > 0 ? rows[0].outstanding : 0;

  return {
    title: 'reports.topBorrowers.title',
    columns: [
      { key: 'rank', label: 'reports.col.rank', align: 'center', type: 'number' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'activeLoans', label: 'reports.col.activeLoans', align: 'right', type: 'number' },
      { key: 'totalDisbursed', label: 'reports.col.totalDisbursed', align: 'right', type: 'currency', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'share', label: 'reports.col.share', align: 'right', type: 'percent' },
    ],
    rows,
    totals: {
      totalDisbursed: totalDisbursedSum,
      outstanding: outstandingSum,
    },
    kpis: [
      { label: 'top10Share', value: `${top10Share}%` },
      { label: 'largestExposure', value: largestExposure },
      { label: 'concentrationRiskPct', value: `${top10Share}%`, tone: top10Share > 50 ? 'warn' : 'good' },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}

function emptyPayload(): ReportPayload {
  return {
    title: 'reports.topBorrowers.title',
    columns: [
      { key: 'rank', label: 'reports.col.rank', align: 'center', type: 'number' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'activeLoans', label: 'reports.col.activeLoans', align: 'right', type: 'number' },
      { key: 'totalDisbursed', label: 'reports.col.totalDisbursed', align: 'right', type: 'currency', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'share', label: 'reports.col.share', align: 'right', type: 'percent' },
    ],
    rows: [],
    totals: { totalDisbursed: 0, outstanding: 0 },
    kpis: [
      { label: 'top10Share', value: '0%' },
      { label: 'largestExposure', value: 0 },
      { label: 'concentrationRiskPct', value: '0%' },
    ],
    meta: { currencySymbol: '₹' },
  };
}
