import prisma from '../../db';
import { getSetting } from '../../tenant';
import { ReportBuilderParams, ReportPayload } from '../types';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function buildAgentAttendance(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const minHoursSetting = await getSetting(tenantId, 'report_present_min_hours', '4');
  const minPresentHours = parseFloat(minHoursSetting) || 4;

  const agentWhere: any = {
    tenantId,
    appType,
    ...branchFilter,
    role: 'agent',
    ...(agentId ? { id: agentId } : {}),
  };

  const agents = await prisma.user.findMany({
    where: agentWhere,
    select: { id: true, name: true },
  });
  const agentIds = agents.map((a) => a.id);
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  if (agentIds.length === 0) {
    return emptyPayload();
  }

  const pings = await prisma.agentLocationPing.findMany({
    where: {
      tenantId,
      agentId: { in: agentIds },
      capturedAt: { gte: dateFrom, lte: dateTo },
    },
    select: { agentId: true, capturedAt: true },
    orderBy: { capturedAt: 'asc' },
  });

  // Group by agentId + date
  const groups = new Map<string, { agentId: string; date: string; first: Date; last: Date; count: number }>();
  for (const p of pings) {
    const key = `${p.agentId}|${dateKey(p.capturedAt)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { agentId: p.agentId, date: dateKey(p.capturedAt), first: p.capturedAt, last: p.capturedAt, count: 1 });
    } else {
      if (p.capturedAt < existing.first) existing.first = p.capturedAt;
      if (p.capturedAt > existing.last) existing.last = p.capturedAt;
      existing.count++;
    }
  }

  let totalWorkingHours = 0;
  let totalVisits = 0;
  let presentCount = 0;
  let absentCount = 0;
  let partialCount = 0;

  const rows = Array.from(groups.values())
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.agentId.localeCompare(b.agentId)))
    .map((g) => {
      const hours = Number(((g.last.getTime() - g.first.getTime()) / (1000 * 60 * 60)).toFixed(2));
      let status: 'present' | 'absent' | 'partial';
      if (hours >= minPresentHours) {
        status = 'present';
        presentCount++;
      } else if (hours > 0) {
        status = 'partial';
        partialCount++;
      } else {
        status = 'absent';
        absentCount++;
      }
      totalWorkingHours += hours;
      totalVisits += g.count;

      return {
        agentName: nameById.get(g.agentId) || '',
        date: g.date,
        firstActivity: g.first,
        lastActivity: g.last,
        workingHours: hours,
        visits: g.count,
        status,
      };
    });

  const avgWorkingHours = rows.length > 0 ? Number((totalWorkingHours / rows.length).toFixed(2)) : 0;

  return {
    title: 'reports.agentAttendance.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agentName', align: 'left', type: 'text' },
      { key: 'date', label: 'reports.col.date', align: 'center', type: 'date' },
      { key: 'firstActivity', label: 'reports.col.login', align: 'center', type: 'date' },
      { key: 'lastActivity', label: 'reports.col.logout', align: 'center', type: 'date' },
      { key: 'workingHours', label: 'reports.col.workingHours', align: 'right', type: 'number', total: true },
      { key: 'visits', label: 'reports.col.visits', align: 'right', type: 'number', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      workingHours: Number(totalWorkingHours.toFixed(2)),
      visits: totalVisits,
    },
    kpis: [
      { label: 'presentCount', value: presentCount },
      { label: 'avgWorkingHours', value: avgWorkingHours },
      { label: 'absentCount', value: absentCount },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}

function emptyPayload(): ReportPayload {
  return {
    title: 'reports.agentAttendance.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agentName', align: 'left', type: 'text' },
      { key: 'date', label: 'reports.col.date', align: 'center', type: 'date' },
      { key: 'firstActivity', label: 'reports.col.login', align: 'center', type: 'date' },
      { key: 'lastActivity', label: 'reports.col.logout', align: 'center', type: 'date' },
      { key: 'workingHours', label: 'reports.col.workingHours', align: 'right', type: 'number', total: true },
      { key: 'visits', label: 'reports.col.visits', align: 'right', type: 'number', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows: [],
    totals: { workingHours: 0, visits: 0 },
    kpis: [
      { label: 'presentCount', value: 0 },
      { label: 'avgWorkingHours', value: 0 },
      { label: 'absentCount', value: 0 },
    ],
    meta: { currencySymbol: '₹' },
  };
}
