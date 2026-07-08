import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildDateWiseCollection(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const branchFilter = branchId ? { branchId } : {};

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const collections = await prisma.dailyCollection.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      date: { gte: dateFrom, lte: dateTo },
      ...(agentId ? { agentId } : {}),
    },
    orderBy: { date: 'asc' },
  });

  const byDate = new Map<string, { expected: number; collected: number }>();
  for (const c of collections) {
    const key = c.date.toISOString().split('T')[0];
    const prev = byDate.get(key) ?? { expected: 0, collected: 0 };
    prev.expected += Number(c.totalExpected);
    prev.collected += Number(c.totalCollected);
    byDate.set(key, prev);
  }

  let totalExpected = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let efficiencySum = 0;

  const rows = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => {
      const pending = Math.max(0, v.expected - v.collected);
      const efficiency = v.expected > 0 ? Math.round((v.collected / v.expected) * 100) : 0;

      totalExpected += v.expected;
      totalCollected += v.collected;
      totalPending += pending;
      efficiencySum += efficiency;

      return {
        date,
        expected: v.expected,
        collected: v.collected,
        pending,
        efficiency,
      };
    });

  const avgEfficiency = rows.length > 0 ? Math.round(efficiencySum / rows.length) : 0;

  return {
    title: 'reports.dateWiseCollection.title',
    columns: [
      { key: 'date', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'expected', label: 'reports.col.expected', align: 'right', type: 'currency', total: true },
      { key: 'collected', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'pending', label: 'reports.col.pending', align: 'right', type: 'currency', total: true },
      { key: 'efficiency', label: 'reports.col.efficiency', align: 'right', type: 'percent' },
    ],
    rows,
    totals: {
      expected: totalExpected,
      collected: totalCollected,
      pending: totalPending,
    },
    kpis: [
      { label: 'totalExpected', value: totalExpected },
      { label: 'totalCollected', value: totalCollected },
      { label: 'totalPending', value: totalPending },
      { label: 'avgEfficiency', value: `${avgEfficiency}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
