import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildCollectionEfficiency(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, routeId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Fetch agents first to map names in-memory (Instalment has no agent relation directly)
  const agentsList = await prisma.user.findMany({
    where: { tenantId, role: 'agent' },
    select: { id: true, name: true },
  });
  const agentMap = new Map<string, string>(agentsList.map(a => [a.id, a.name]));

  // Find all instalments in scope
  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: dateFrom, lte: dateTo },
      loan: {
        tenantId,
        appType,
        ...branchFilter,
        ...(routeId ? { customer: { routeId } } : {}),
      },
      ...(agentId ? { agentId } : {}),
    },
    select: {
      dueAmount: true,
      receivedAmount: true,
      status: true,
      agentId: true,
    },
  });

  // Group by agent
  const groupsMap = new Map<string, { expected: number; collected: number; name: string }>();

  instalments.forEach(inst => {
    const aId = inst.agentId || 'unassigned';
    const aName = agentMap.get(aId) || 'Unassigned';

    if (!groupsMap.has(aId)) {
      groupsMap.set(aId, { expected: 0, collected: 0, name: aName });
    }

    const due = Number(inst.dueAmount);
    const rec = Number(inst.receivedAmount || 0);

    const grp = groupsMap.get(aId)!;
    grp.expected += due;
    grp.collected += rec;
  });

  let grandExpected = 0;
  let grandCollected = 0;
  let grandPending = 0;

  const rows = Array.from(groupsMap.values()).map(grp => {
    const expected = grp.expected;
    const collected = grp.collected;
    const pending = Math.max(0, expected - collected);
    const efficiency = expected > 0 ? Math.round((collected / expected) * 100) : 0;

    grandExpected += expected;
    grandCollected += collected;
    grandPending += pending;

    return {
      group: grp.name,
      expected,
      collected,
      pending,
      efficiency,
    };
  });

  const overallEfficiency = grandExpected > 0 ? Math.round((grandCollected / grandExpected) * 100) : 0;

  return {
    title: 'reports.collectionEfficiency.title',
    columns: [
      { key: 'group', label: 'reports.col.group', align: 'left', type: 'text' },
      { key: 'expected', label: 'reports.col.expected', align: 'right', type: 'currency', total: true },
      { key: 'collected', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'pending', label: 'reports.col.pending', align: 'right', type: 'currency', total: true },
      { key: 'efficiency', label: 'reports.col.efficiency', align: 'right', type: 'percent' },
    ],
    rows,
    totals: {
      expected: grandExpected,
      collected: grandCollected,
      pending: grandPending,
    },
    kpis: [
      { label: 'overallEfficiency', value: `${overallEfficiency}%` },
      { label: 'totalExpected', value: grandExpected },
      { label: 'totalCollected', value: grandCollected },
      { label: 'totalPending', value: grandPending },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
