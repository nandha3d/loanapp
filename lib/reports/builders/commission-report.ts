import prisma from '../../db';
import { getSetting } from '../../tenant';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildCommissionReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const commissionEnabled = await getSetting(tenantId, 'commission_enabled', 'false');

  if (commissionEnabled !== 'true') {
    return {
      title: 'reports.commission.title',
      columns: [
        { key: 'agentName', label: 'reports.col.agentName', align: 'left', type: 'text' },
        { key: 'basisAmount', label: 'reports.col.basisAmount', align: 'right', type: 'currency', total: true },
        { key: 'rate', label: 'reports.col.rate', align: 'right', type: 'percent' },
        { key: 'commission', label: 'reports.col.commission', align: 'right', type: 'currency', total: true },
        { key: 'period', label: 'reports.col.period', align: 'center', type: 'text' },
      ],
      rows: [],
      totals: { basisAmount: 0, commission: 0 },
      kpis: [
        { label: 'commissionDisabled', value: 'Commission tracking is disabled for this tenant', tone: 'warn' },
      ],
      meta: {
        currencySymbol: '₹',
      },
    };
  }

  const rateSetting = await getSetting(tenantId, 'commission_rate', '0');
  const rate = parseFloat(rateSetting) || 0;
  const basis = await getSetting(tenantId, 'commission_basis', 'collected'); // 'collected' | 'disbursed'

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const agentWhere: any = {
    tenantId,
    appType,
    ...branchFilter,
    role: 'agent',
    ...(agentId ? { id: agentId } : {}),
  };

  const agents = await prisma.user.findMany({
    where: agentWhere,
    select: { id: true, name: true },
  });
  const agentIds = agents.map((a) => a.id);
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  if (agentIds.length === 0) {
    return {
      title: 'reports.commission.title',
      columns: [
        { key: 'agentName', label: 'reports.col.agentName', align: 'left', type: 'text' },
        { key: 'basisAmount', label: 'reports.col.basisAmount', align: 'right', type: 'currency', total: true },
        { key: 'rate', label: 'reports.col.rate', align: 'right', type: 'percent' },
        { key: 'commission', label: 'reports.col.commission', align: 'right', type: 'currency', total: true },
        { key: 'period', label: 'reports.col.period', align: 'center', type: 'text' },
      ],
      rows: [],
      totals: { basisAmount: 0, commission: 0 },
      kpis: [{ label: 'agentsCounted', value: 0 }],
      meta: { currencySymbol: '₹' },
    };
  }

  const basisAmountByAgent = new Map<string, number>();

  if (basis === 'disbursed') {
    const grouped = await prisma.loan.groupBy({
      by: ['createdById'],
      where: {
        tenantId,
        appType,
        ...branchFilter,
        createdById: { in: agentIds },
        startDate: { gte: dateFrom, lte: dateTo },
      },
      _sum: { principal: true },
    });
    for (const g of grouped) {
      if (g.createdById) basisAmountByAgent.set(g.createdById, Number(g._sum.principal || 0));
    }
  } else {
    const grouped = await prisma.collectionEntry.groupBy({
      by: ['agentId'],
      where: {
        tenantId,
        agentId: { in: agentIds },
        submittedAt: { gte: dateFrom, lte: dateTo },
      },
      _sum: { receivedAmount: true },
    });
    for (const g of grouped) {
      basisAmountByAgent.set(g.agentId, Number(g._sum.receivedAmount || 0));
    }
  }

  const period = `${from} - ${to}`;
  let totalBasisAmount = 0;
  let totalCommission = 0;

  const rows = agents
    .map((a) => {
      const basisAmount = basisAmountByAgent.get(a.id) || 0;
      const commission = Number(((basisAmount * rate) / 100).toFixed(2));
      return { agentName: a.name, basisAmount, rate, commission, period, _commission: commission };
    })
    .filter((r) => r.basisAmount > 0)
    .sort((a, b) => b._commission - a._commission)
    .map(({ _commission, ...rest }) => rest);

  for (const r of rows) {
    totalBasisAmount += r.basisAmount;
    totalCommission += r.commission;
  }

  const topEarner = rows.length > 0 ? rows[0].agentName : '';

  return {
    title: 'reports.commission.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agentName', align: 'left', type: 'text' },
      { key: 'basisAmount', label: 'reports.col.basisAmount', align: 'right', type: 'currency', total: true },
      { key: 'rate', label: 'reports.col.rate', align: 'right', type: 'percent' },
      { key: 'commission', label: 'reports.col.commission', align: 'right', type: 'currency', total: true },
      { key: 'period', label: 'reports.col.period', align: 'center', type: 'text' },
    ],
    rows,
    totals: {
      basisAmount: totalBasisAmount,
      commission: totalCommission,
    },
    kpis: [
      { label: 'totalCommissionPayable', value: totalCommission },
      { label: 'topEarner', value: topEarner },
      { label: 'agentsCounted', value: rows.length },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
