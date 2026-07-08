import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildAreaWiseCollection(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const branchFilter = branchId ? { branchId } : {};

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // No separate "area/city/village/zone" field exists in this schema —
  // Route is the only geography dimension available, so Route.name is used
  // as the area taxonomy (per the spec's "data-driven, no hardcode" rule).
  const entries = await prisma.collectionEntry.findMany({
    where: {
      collection: { tenantId, appType, ...branchFilter },
      submittedAt: { gte: dateFrom, lte: dateTo },
      ...(agentId ? { agentId } : {}),
    },
    include: {
      customer: { select: { id: true, route: { select: { id: true, name: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
  });

  const byArea = new Map<string, { area: string; customerIds: Set<string>; expected: number; collected: number }>();
  for (const e of entries) {
    const routeId = e.customer.route?.id ?? 'unassigned';
    const areaName = e.customer.route?.name ?? 'reports.unassignedArea';
    const prev = byArea.get(routeId) ?? { area: areaName, customerIds: new Set<string>(), expected: 0, collected: 0 };
    prev.customerIds.add(e.customer.id);
    prev.expected += Number(e.dueAmount);
    prev.collected += Number(e.receivedAmount);
    byArea.set(routeId, prev);
  }

  let totalExpected = 0;
  let totalCollected = 0;
  let totalPending = 0;

  let bestArea = '';
  let bestEfficiency = -1;
  let worstArea = '';
  let worstEfficiency = 101;

  const rows = Array.from(byArea.values())
    .map((v) => {
      const pending = Math.max(0, v.expected - v.collected);
      const efficiency = v.expected > 0 ? Math.round((v.collected / v.expected) * 100) : 0;

      totalExpected += v.expected;
      totalCollected += v.collected;
      totalPending += pending;

      if (efficiency > bestEfficiency) {
        bestEfficiency = efficiency;
        bestArea = v.area;
      }
      if (efficiency < worstEfficiency) {
        worstEfficiency = efficiency;
        worstArea = v.area;
      }

      return {
        area: v.area,
        customers: v.customerIds.size,
        expected: v.expected,
        collected: v.collected,
        pending,
        efficiency,
      };
    })
    .sort((a, b) => b.collected - a.collected);

  return {
    title: 'reports.areaWiseCollection.title',
    columns: [
      { key: 'area', label: 'reports.col.area', align: 'left', type: 'text' },
      { key: 'customers', label: 'reports.col.customers', align: 'right', type: 'number' },
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
      { label: 'bestArea', value: bestArea || '—', tone: 'good' },
      { label: 'worstArea', value: worstArea || '—', tone: 'warn' },
      { label: 'totalCollected', value: totalCollected },
      { label: 'areaCount', value: rows.length },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
