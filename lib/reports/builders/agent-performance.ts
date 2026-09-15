import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { haversineDistance } from '../../gps/locationVerifier';
import { getSetting } from '../../tenant';

export async function buildAgentPerformance(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Fetch agents
  const agents = await prisma.user.findMany({
    where: {
      tenantId,
      appType,
      role: 'agent',
      status: 'active',
      ...branchFilter,
      ...(agentId ? { id: agentId } : {}),
    },
    select: { id: true, name: true },
  });

  const agentIds = agents.map(a => a.id);

  // Group customers by agent
  const customerCounts = await prisma.customer.groupBy({
    by: ['agentId'],
    where: { tenantId, appType, agentId: { in: agentIds } },
    _count: true,
  });
  const customerCountMap = new Map(customerCounts.map(c => [c.agentId, c._count]));

  // Get collections within period
  const instalments = await prisma.instalment.findMany({
    where: {
      agentId: { in: agentIds },
      dueDate: { gte: dateFrom, lte: dateTo },
      loan: { tenantId, appType },
    },
    select: {
      agentId: true,
      dueAmount: true,
      receivedAmount: true,
      status: true,
    },
  });

  // Get visits (count of CollectionEntry submitted)
  const visits = await prisma.collectionEntry.groupBy({
    by: ['agentId'],
    where: {
      agentId: { in: agentIds },
      submittedAt: { gte: dateFrom, lte: dateTo },
    },
    _count: true,
  });
  const visitsMap = new Map(visits.map(v => [v.agentId, v._count]));

  // Get GPS pings to calculate distance
  const pings = await prisma.agentLocationPing.findMany({
    where: {
      agentId: { in: agentIds },
      capturedAt: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { capturedAt: 'asc' },
    select: { agentId: true, lat: true, lng: true, capturedAt: true },
  });

  // Group pings by agent
  const pingsByAgent = new Map<string, typeof pings>();
  pings.forEach(p => {
    if (!pingsByAgent.has(p.agentId)) {
      pingsByAgent.set(p.agentId, []);
    }
    pingsByAgent.get(p.agentId)!.push(p);
  });

  // Calculate distance for each agent
  const distanceMap = new Map<string, number>();
  pingsByAgent.forEach((agentPings, aId) => {
    let dist = 0;
    for (let i = 1; i < agentPings.length; i++) {
      const p1 = agentPings[i - 1];
      const p2 = agentPings[i];
      // Skip if time difference is huge (e.g. overnight or more than 1 hour)
      const diffHr = (p2.capturedAt.getTime() - p1.capturedAt.getTime()) / 3600000;
      if (diffHr < 1) {
        dist += haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      }
    }
    distanceMap.set(aId, dist / 1000); // in km
  });

  // Calculate attendance (distinct days with a ping or entry / total working days)
  const totalDays = Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / 86400000));
  
  const attendanceMap = new Map<string, number>();
  agentIds.forEach(aId => {
    const activeDates = new Set<string>();
    
    // Check pings
    const agentPings = pingsByAgent.get(aId) || [];
    agentPings.forEach(p => {
      activeDates.add(p.capturedAt.toISOString().slice(0, 10));
    });

    const attPct = Math.min(100, Math.round((activeDates.size / totalDays) * 100));
    attendanceMap.set(aId, attPct);
  });

  // Aggregate expected/collected per agent
  const expectedMap = new Map<string, number>();
  const collectedMap = new Map<string, number>();

  instalments.forEach(inst => {
    if (!inst.agentId) return;
    const due = Number(inst.dueAmount);
    const rec = Number(inst.receivedAmount || 0);

    expectedMap.set(inst.agentId, (expectedMap.get(inst.agentId) || 0) + due);
    collectedMap.set(inst.agentId, (collectedMap.get(inst.agentId) || 0) + rec);
  });

  let grandCustomers = 0;
  let grandCollected = 0;
  let grandPending = 0;
  let grandVisits = 0;
  let grandDistance = 0;

  const rows = agents.map(agent => {
    const custCount = customerCountMap.get(agent.id) || 0;
    const collected = collectedMap.get(agent.id) || 0;
    const expected = expectedMap.get(agent.id) || 0;
    const pending = Math.max(0, expected - collected);
    const recovery = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    const visitCount = visitsMap.get(agent.id) || 0;
    const distanceKm = Math.round((distanceMap.get(agent.id) || 0) * 10) / 10;
    const attendancePct = attendanceMap.get(agent.id) || 0;

    grandCustomers += custCount;
    grandCollected += collected;
    grandPending += pending;
    grandVisits += visitCount;
    grandDistance += distanceKm;

    return {
      agentName: agent.name,
      customers: custCount,
      collected,
      pending,
      recovery,
      visits: visitCount,
      attendancePct,
      distanceKm,
    };
  });

  // Find top performer based on recovery rate or total collected
  let topPerformer = '—';
  if (rows.length > 0) {
    const sorted = [...rows].sort((a, b) => b.collected - a.collected);
    if (sorted[0].collected > 0) {
      topPerformer = sorted[0].agentName;
    }
  }

  const avgRecovery = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.recovery, 0) / rows.length) : 0;

  return {
    title: 'reports.agentPerformance.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'customers', label: 'reports.col.loansAssigned', align: 'right', type: 'number', total: true },
      { key: 'collected', label: 'reports.col.collections', align: 'right', type: 'currency', total: true },
      { key: 'pending', label: 'reports.col.pending', align: 'right', type: 'currency', total: true },
      { key: 'recovery', label: 'reports.col.recovery', align: 'right', type: 'percent' },
      { key: 'visits', label: 'reports.col.visits', align: 'right', type: 'number', total: true },
      { key: 'attendancePct', label: 'reports.col.attendance', align: 'right', type: 'percent' },
      { key: 'distanceKm', label: 'reports.col.distance', align: 'right', type: 'number', total: true },
    ],
    rows,
    totals: {
      customers: grandCustomers,
      collected: grandCollected,
      pending: grandPending,
      visits: grandVisits,
      distanceKm: Math.round(grandDistance * 10) / 10,
    },
    kpis: [
      { label: 'topPerformer', value: topPerformer },
      { label: 'avgRecoveryRate', value: `${avgRecovery}%` },
      { label: 'totalVisits', value: grandVisits },
      { label: 'totalDistanceKm', value: `${Math.round(grandDistance * 10) / 10} km` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
