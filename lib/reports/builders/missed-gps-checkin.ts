import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildMissedGpsCheckin(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const agents = await prisma.user.findMany({
    where: {
      tenantId,
      appType,
      role: 'agent',
      status: 'active',
      ...branchFilter,
      ...(agentId ? { id: agentId } : {}),
    },
    select: { id: true, name: true, branchId: true, branch: { select: { name: true } } },
  });
  const agentIds = agents.map((a) => a.id);

  // All pings for these agents up to the end of range (used both to detect "checked in that day"
  // and to compute "last seen" before/within the range).
  const pings = await prisma.agentLocationPing.findMany({
    where: {
      tenantId,
      agentId: { in: agentIds },
      capturedAt: { lte: dateTo },
    },
    select: { agentId: true, capturedAt: true },
    orderBy: { capturedAt: 'asc' },
  });

  const pingDaysByAgent = new Map<string, Set<string>>();
  const lastSeenByAgent = new Map<string, Date>();
  pings.forEach((p) => {
    const dayKey = p.capturedAt.toISOString().slice(0, 10);
    if (!pingDaysByAgent.has(p.agentId)) pingDaysByAgent.set(p.agentId, new Set());
    pingDaysByAgent.get(p.agentId)!.add(dayKey);

    const prevLast = lastSeenByAgent.get(p.agentId);
    if (!prevLast || p.capturedAt > prevLast) {
      lastSeenByAgent.set(p.agentId, p.capturedAt);
    }
  });

  // Build list of working days in range (every calendar day — no holiday calendar in scope here).
  const days: Date[] = [];
  for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const rows: Record<string, any>[] = [];
  let missedToday = 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const agentsWithNoActivity3d = new Set<string>();

  days.forEach((day) => {
    const dayKey = day.toISOString().slice(0, 10);
    agents.forEach((agent) => {
      const pingDays = pingDaysByAgent.get(agent.id);
      const hasPing = pingDays?.has(dayKey) ?? false;
      if (hasPing) return;

      const lastSeen = lastSeenByAgent.get(agent.id) || null;
      const daysSince = lastSeen
        ? Math.floor((day.getTime() - lastSeen.getTime()) / 86400000)
        : null;

      if (dayKey === todayKey) missedToday += 1;
      if (daysSince === null || daysSince >= 3) agentsWithNoActivity3d.add(agent.id);

      rows.push({
        agentName: agent.name,
        date: day,
        branchName: agent.branch?.name || '—',
        lastSeen,
        daysSince: daysSince ?? '—',
      });
    });
  });

  rows.sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalAgentDays = days.length * agents.length;
  const coveragePct =
    totalAgentDays > 0 ? Math.round(((totalAgentDays - rows.length) / totalAgentDays) * 100) : 0;

  return {
    title: 'reports.missedGpsCheckin.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'date', label: 'reports.col.date', align: 'center', type: 'date' },
      { key: 'branchName', label: 'reports.col.branch', align: 'left', type: 'text' },
      { key: 'lastSeen', label: 'reports.col.lastSeen', align: 'center', type: 'date' },
      { key: 'daysSince', label: 'reports.col.daysSince', align: 'right', type: 'number' },
    ],
    rows,
    kpis: [
      { label: 'missedToday', value: missedToday, tone: missedToday > 0 ? 'warn' : 'good' },
      { label: 'noActivity3d', value: agentsWithNoActivity3d.size, tone: agentsWithNoActivity3d.size > 0 ? 'bad' : 'good' },
      { label: 'coveragePct', value: `${coveragePct}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
