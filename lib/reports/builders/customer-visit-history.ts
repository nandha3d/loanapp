import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildCustomerVisitHistory(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, customerId, agentId } = params;

  if (!customerId) {
    return {
      title: 'reports.customerVisits.title',
      columns: [
        { key: 'visitedAt', label: 'reports.col.visitedAt', align: 'left', type: 'date' },
        { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
        { key: 'distanceFromCustomerM', label: 'reports.col.distFromCust', align: 'right', type: 'number' },
        { key: 'durationMin', label: 'reports.col.durationMin', align: 'right', type: 'number' },
        { key: 'locationStatus', label: 'reports.col.geoStatus', align: 'center', type: 'badge' },
        { key: 'receivedAmount', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      ],
      rows: [],
      kpis: [
        { label: 'totalVisits', value: 0 },
        { label: 'onLocationPct', value: '0%' },
        { label: 'avgDuration', value: 0 },
        { label: 'lastVisit', value: '—' },
      ],
      meta: { currencySymbol: '₹' },
    };
  }

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const entries = await prisma.collectionEntry.findMany({
    where: {
      tenantId,
      customerId,
      ...(agentId ? { agentId } : {}),
      submittedAt: { gte: dateFrom, lte: dateTo },
    },
    include: { agent: { select: { name: true } } },
    orderBy: { submittedAt: 'asc' },
  });

  let onLocationCount = 0;
  let grandCollected = 0;
  let durationSum = 0;
  let durationCount = 0;

  const rows = entries.map((entry, idx) => {
    const next = entries[idx + 1];
    // Duration = gap between this visit and the next stop's submission (best-effort).
    let durationMin = 0;
    if (next) {
      durationMin = Math.max(
        0,
        Math.round((next.submittedAt.getTime() - entry.submittedAt.getTime()) / 60000),
      );
      durationSum += durationMin;
      durationCount += 1;
    }

    if (entry.locationStatus === 'verified' || entry.locationStatus === 'on_location') {
      onLocationCount += 1;
    }

    const receivedAmount = Number(entry.receivedAmount);
    grandCollected += receivedAmount;

    return {
      visitedAt: entry.submittedAt,
      agentName: entry.agent?.name || 'Unknown',
      distanceFromCustomerM: entry.distanceFromCustomerM != null ? Math.round(entry.distanceFromCustomerM) : null,
      durationMin,
      locationStatus: entry.locationStatus,
      receivedAmount,
    };
  });

  const totalVisits = entries.length;
  const onLocationPct = totalVisits > 0 ? Math.round((onLocationCount / totalVisits) * 100) : 0;
  const avgDuration = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;
  const lastVisit = entries.length > 0 ? entries[entries.length - 1].submittedAt : null;

  return {
    title: 'reports.customerVisits.title',
    columns: [
      { key: 'visitedAt', label: 'reports.col.visitedAt', align: 'left', type: 'date' },
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'distanceFromCustomerM', label: 'reports.col.distFromCust', align: 'right', type: 'number' },
      { key: 'durationMin', label: 'reports.col.durationMin', align: 'right', type: 'number' },
      { key: 'locationStatus', label: 'reports.col.geoStatus', align: 'center', type: 'badge' },
      { key: 'receivedAmount', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      receivedAmount: grandCollected,
    },
    kpis: [
      { label: 'totalVisits', value: totalVisits },
      { label: 'onLocationPct', value: `${onLocationPct}%` },
      { label: 'avgDuration', value: avgDuration },
      { label: 'lastVisit', value: lastVisit ? lastVisit.toISOString() : '—' },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
