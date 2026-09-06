import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildCollectionModeReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, paymentMode } = params;

  const branchFilter = branchId ? { branchId } : {};

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const grouped = await prisma.collectionEntry.groupBy({
    by: ['paymentMode'],
    where: {
      collection: { tenantId, appType, ...branchFilter },
      submittedAt: { gte: dateFrom, lte: dateTo },
      ...(agentId ? { agentId } : {}),
      ...(paymentMode ? { paymentMode } : {}),
    },
    _count: { _all: true },
    _sum: { receivedAmount: true },
  });

  const totalAmount = grouped.reduce((sum, g) => sum + Number(g._sum.receivedAmount || 0), 0);

  let totalCount = 0;
  let cashTotal = 0;
  let digitalTotal = 0;

  const rows = grouped
    .map((g) => {
      const count = g._count._all;
      const amount = Number(g._sum.receivedAmount || 0);
      const share = totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;

      totalCount += count;
      if (g.paymentMode === 'cash') {
        cashTotal += amount;
      } else {
        digitalTotal += amount;
      }

      return {
        paymentMode: g.paymentMode,
        count,
        amount,
        share,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const cashShare = totalAmount > 0 ? Math.round((cashTotal / totalAmount) * 100) : 0;

  return {
    title: 'reports.collectionMode.title',
    columns: [
      { key: 'paymentMode', label: 'reports.col.mode', align: 'left', type: 'badge' },
      { key: 'count', label: 'reports.col.count', align: 'right', type: 'number', total: true },
      { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'share', label: 'reports.col.share', align: 'right', type: 'percent' },
    ],
    rows,
    totals: {
      count: totalCount,
      amount: totalAmount,
    },
    kpis: [
      { label: 'cashTotal', value: cashTotal },
      { label: 'digitalTotal', value: digitalTotal },
      { label: 'cashSharePercent', value: `${cashShare}%` },
      { label: 'transactionCount', value: totalCount },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
