import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildDailyCollection(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, paymentMode } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const entries = await prisma.collectionEntry.findMany({
    where: {
      collection: {
        tenantId,
        appType,
        ...branchFilter,
      },
      submittedAt: { gte: dateFrom, lte: dateTo },
      ...(agentId ? { agentId } : {}),
      ...(paymentMode ? { paymentMode } : {}),
    },
    include: {
      agent: { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });

  let totalDue = 0;
  let totalCollected = 0;
  let totalPending = 0;

  const rows = entries.map((e) => {
    const due = Number(e.dueAmount);
    const collected = Number(e.receivedAmount);
    const pending = Math.max(0, due - collected);

    totalDue += due;
    totalCollected += collected;
    totalPending += pending;

    return {
      agentName: e.agent?.name || '—',
      customerName: e.customer?.name || '—',
      dueAmount: due,
      receivedAmount: collected,
      pending,
      paymentMode: e.paymentMode,
      submittedAt: e.submittedAt,
    };
  });

  const efficiency = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

  return {
    title: 'reports.dailyCollection.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customer', align: 'left', type: 'text' },
      { key: 'dueAmount', label: 'reports.col.amountDue', align: 'right', type: 'currency', total: true },
      { key: 'receivedAmount', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'pending', label: 'reports.col.pending', align: 'right', type: 'currency', total: true },
      { key: 'paymentMode', label: 'reports.col.mode', align: 'center', type: 'badge' },
      { key: 'submittedAt', label: 'reports.col.time', align: 'center', type: 'date' },
    ],
    rows,
    totals: {
      dueAmount: totalDue,
      receivedAmount: totalCollected,
      pending: totalPending,
    },
    kpis: [
      { label: 'totalCollected', value: totalCollected },
      { label: 'totalExpected', value: totalDue },
      { label: 'entryCount', value: entries.length },
      { label: 'efficiencyPercent', value: `${efficiency}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
