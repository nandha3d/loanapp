import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildGpsRoute(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  let targetAgentId = agentId;
  if (!targetAgentId) {
    // Fallback to the first agent if not specified
    const firstAgent = await prisma.user.findFirst({
      where: { tenantId, appType, role: 'agent' },
      select: { id: true },
    });
    if (firstAgent) {
      targetAgentId = firstAgent.id;
    }
  }

  if (!targetAgentId) {
    throw new Error('Agent ID is required for GPS Route report');
  }

  const entries = await prisma.collectionEntry.findMany({
    where: {
      agentId: targetAgentId,
      submittedAt: { gte: dateFrom, lte: dateTo },
      tenantId,
      collection: { appType },
    },
    include: {
      customer: { select: { name: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  let totalCollected = 0;
  let matchCount = 0;

  const rows = entries.map((e, idx) => {
    const amount = Number(e.receivedAmount || 0);
    totalCollected += amount;

    const lat = e.lat ? Number(e.lat).toFixed(6) : null;
    const lng = e.lng ? Number(e.lng).toFixed(6) : null;
    const coords = lat && lng ? `${lat}, ${lng}` : '—';

    const dist = e.distanceFromCustomerM ? Number(e.distanceFromCustomerM) : null;

    if (e.locationStatus === 'on_location') {
      matchCount++;
    }

    return {
      seq: idx + 1,
      gpsCapturedAt: e.submittedAt,
      customerName: e.customer?.name || '—',
      coords,
      distanceFromCustomerM: dist !== null ? Math.round(dist) : null,
      locationStatus: e.locationStatus || 'unknown',
      receivedAmount: amount,
    };
  });

  const matchPct = entries.length > 0 ? Math.round((matchCount / entries.length) * 100) : 0;

  return {
    title: 'reports.gpsRoute.title',
    columns: [
      { key: 'seq', label: 'reports.col.seq', align: 'center', type: 'number' },
      { key: 'gpsCapturedAt', label: 'reports.col.time', align: 'center', type: 'date' },
      { key: 'customerName', label: 'reports.col.customer', align: 'left', type: 'text' },
      { key: 'coords', label: 'reports.col.coords', align: 'left', type: 'text' },
      { key: 'distanceFromCustomerM', label: 'reports.col.distFromCust', align: 'right', type: 'number' },
      { key: 'locationStatus', label: 'reports.col.geoStatus', align: 'center', type: 'badge' },
      { key: 'receivedAmount', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      receivedAmount: totalCollected,
    },
    kpis: [
      { label: 'totalStops', value: entries.length },
      { label: 'onLocationPercentage', value: `${matchPct}%` },
      { label: 'totalCollected', value: totalCollected },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
