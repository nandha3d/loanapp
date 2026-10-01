import prisma from '@/lib/db';
import { branchScopeWhere } from '@/lib/branchScope';
import { startOfBusinessToday, startOfBusinessTomorrow } from '@/lib/businessTime';

export function gpsAgentWhere(input: { tenantId: string; appType: string; branchId?: string | null }) {
  return {
    tenantId: input.tenantId,
    appType: input.appType,
    role: 'agent',
    status: 'active',
    ...branchScopeWhere(input.branchId),
  };
}

export function gpsEntryWhere(input: { tenantId: string; appType: string; branchId?: string | null }) {
  return {
    tenantId: input.tenantId,
    loan: {
      tenantId: input.tenantId,
      appType: input.appType,
      ...branchScopeWhere(input.branchId),
    },
  };
}


function minutesSince(date: Date | null | undefined) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
}

export async function getRouteProgressForBranch(input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  date?: Date;
}) {
  const dayStart = startOfBusinessToday(input.date);
  const dayEnd = startOfBusinessTomorrow(input.date);

  const agents = await prisma.user.findMany({
    where: gpsAgentWhere(input),
    select: { id: true, name: true, branchId: true },
    orderBy: { name: 'asc' },
  });

  const [pings, entries] = await Promise.all([
    prisma.agentLocationPing.findMany({
      where: {
        tenantId: input.tenantId,
        capturedAt: { gte: dayStart, lt: dayEnd },
        agentId: { in: agents.map((agent) => agent.id) },
      },
      orderBy: { capturedAt: 'asc' },
    }),
    prisma.collectionEntry.findMany({
      where: {
        ...gpsEntryWhere(input),
        submittedAt: { gte: dayStart, lt: dayEnd },
        agentId: { in: agents.map((agent) => agent.id) },
      },
      select: {
        id: true,
        agentId: true,
        lat: true,
        lng: true,
        locationStatus: true,
        receivedAmount: true,
        submittedAt: true,
        customer: { select: { name: true, profilePhoto: true } },
      },
      orderBy: { submittedAt: 'asc' },
    }),
  ]);

  return agents.map((agent) => {
    const agentPings = pings.filter((ping) => ping.agentId === agent.id);
    const last = agentPings.length ? agentPings[agentPings.length - 1] : null;
    const agentEntries = entries.filter((entry) => entry.agentId === agent.id);
    const mismatchCount = agentEntries.filter((entry) => entry.locationStatus === 'mismatch').length;
    const lastSeenMinutes = minutesSince(last?.capturedAt);
    const alerts = [
      lastSeenMinutes !== null && lastSeenMinutes >= 120 ? 'not_moved_2h' : null,
      lastSeenMinutes !== null && lastSeenMinutes >= 30 ? 'offline_30m' : null,
      mismatchCount >= 3 ? 'multiple_mismatches' : null,
    ].filter((x): x is string => Boolean(x));

    return {
      agentId: agent.id,
      agentName: agent.name,
      branchId: agent.branchId,
      lastLocation: last ? { lat: last.lat, lng: last.lng, time: last.capturedAt } : null,
      minutesSinceLastPing: lastSeenMinutes,
      collectionsDoneToday: agentEntries.length,
      alerts,
      path: agentPings.map((ping) => ({
        lat: ping.lat,
        lng: ping.lng,
        time: ping.capturedAt,
        type: ping.pingType,
        accuracyM: ping.accuracyM,
        isMocked: ping.isMocked,
      })),
      collectionPoints: agentEntries
        .filter((entry) => entry.lat !== null && entry.lng !== null)
        .map((entry) => ({
          id: entry.id,
          lat: entry.lat!,
          lng: entry.lng!,
          customerName: entry.customer.name,
          customerPhoto: entry.customer?.profilePhoto ?? null,
          amount: Number(entry.receivedAmount),
          time: entry.submittedAt,
          locationStatus: entry.locationStatus,
        })),
    };
  });
}
