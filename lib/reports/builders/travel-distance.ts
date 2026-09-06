import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km between two lat/lng points (haversine). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export async function buildTravelDistance(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId, agentId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const pings = await prisma.agentLocationPing.findMany({
    where: {
      tenantId,
      ...branchFilter,
      ...(agentId ? { agentId } : {}),
      capturedAt: { gte: dateFrom, lte: dateTo },
    },
    include: { agent: { select: { name: true } } },
    orderBy: { capturedAt: 'asc' },
  });

  // Group pings by agent + calendar day
  type Group = {
    agentName: string;
    pings: { lat: number; lng: number; capturedAt: Date }[];
  };
  const groups = new Map<string, Group>();

  pings.forEach((p) => {
    const dayKey = p.capturedAt.toISOString().slice(0, 10);
    const key = `${p.agentId}|${dayKey}`;
    if (!groups.has(key)) {
      groups.set(key, { agentName: p.agent?.name || 'Unknown', pings: [] });
    }
    groups.get(key)!.pings.push({ lat: p.lat, lng: p.lng, capturedAt: p.capturedAt });
  });

  let grandDistance = 0;
  const perAgentDistance = new Map<string, number>();

  const rows = Array.from(groups.entries())
    .map(([key, g]) => {
      const [, dayKey] = key.split('|');
      let distanceKm = 0;
      for (let i = 1; i < g.pings.length; i++) {
        const p1 = g.pings[i - 1];
        const p2 = g.pings[i];
        distanceKm += haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
      }
      distanceKm = Math.round(distanceKm * 10) / 10;
      grandDistance += distanceKm;
      perAgentDistance.set(g.agentName, (perAgentDistance.get(g.agentName) || 0) + distanceKm);

      return {
        agentName: g.agentName,
        date: new Date(dayKey),
        stops: g.pings.length,
        distanceKm,
        firstPing: g.pings[0]?.capturedAt || null,
        lastPing: g.pings[g.pings.length - 1]?.capturedAt || null,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.agentName.localeCompare(b.agentName));

  const grandStops = rows.reduce((sum, r) => sum + r.stops, 0);
  const avgPerAgent = perAgentDistance.size > 0 ? Math.round((grandDistance / perAgentDistance.size) * 10) / 10 : 0;
  let longestRouteAgent = '—';
  let longestRouteKm = 0;
  rows.forEach((r) => {
    if (r.distanceKm > longestRouteKm) {
      longestRouteKm = r.distanceKm;
      longestRouteAgent = r.agentName;
    }
  });

  return {
    title: 'reports.travelDistance.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'date', label: 'reports.col.date', align: 'center', type: 'date' },
      { key: 'stops', label: 'reports.col.stops', align: 'right', type: 'number', total: true },
      { key: 'distanceKm', label: 'reports.col.distanceKm', align: 'right', type: 'number', total: true },
      { key: 'firstPing', label: 'reports.col.firstPing', align: 'center', type: 'date' },
      { key: 'lastPing', label: 'reports.col.lastPing', align: 'center', type: 'date' },
    ],
    rows,
    totals: {
      stops: grandStops,
      distanceKm: Math.round(grandDistance * 10) / 10,
    },
    kpis: [
      { label: 'totalDistanceKm', value: `${Math.round(grandDistance * 10) / 10} km` },
      { label: 'avgPerAgentKm', value: `${avgPerAgent} km` },
      { label: 'longestRoute', value: longestRouteAgent === '—' ? '—' : `${longestRouteAgent} (${longestRouteKm} km)` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
