import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildAgentWiseCollection(params: ReportBuilderParams): Promise<ReportPayload> {
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
    include: { agent: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  });

  const byAgent = new Map<string, { agentName: string; expected: number; collected: number }>();
  for (const c of collections) {
    const prev = byAgent.get(c.agentId) ?? { agentName: c.agent.name, expected: 0, collected: 0 };
    prev.expected += Number(c.totalExpected);
    prev.collected += Number(c.totalCollected);
    byAgent.set(c.agentId, prev);
  }

  let totalExpected = 0;
  let totalCollected = 0;
  let totalPending = 0;

  let topAgent = '';
  let topAgentCollected = -1;

  const rows = Array.from(byAgent.values())
    .map((v) => {
      const pending = Math.max(0, v.expected - v.collected);
      const efficiency = v.expected > 0 ? Math.round((v.collected / v.expected) * 100) : 0;

      totalExpected += v.expected;
      totalCollected += v.collected;
      totalPending += pending;

      if (v.collected > topAgentCollected) {
        topAgentCollected = v.collected;
        topAgent = v.agentName;
      }

      return {
        agentName: v.agentName,
        expected: v.expected,
        collected: v.collected,
        pending,
        efficiency,
      };
    })
    .sort((a, b) => b.collected - a.collected);

  const avgEfficiency = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  return {
    title: 'reports.agentWiseCollection.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'expected', label: 'reports.col.target', align: 'right', type: 'currency', total: true },
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
      { label: 'topAgent', value: topAgent || '—' },
      { label: 'totalTarget', value: totalExpected },
      { label: 'totalCollected', value: totalCollected },
      { label: 'avgEfficiency', value: `${avgEfficiency}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
