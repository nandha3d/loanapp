import prisma from '@/lib/db';

function startOfDay(date = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function minutesSince(date: Date | null | undefined) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
}

export async function getRouteProgressForBranch(input: {
  tenantId: string;
  branchId?: string | null;
  date?: Date;
}) {
  const dayStart = startOfDay(input.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const agents = await prisma.user.findMany({
    where: {
      tenantId: input.tenantId,
      role: 'agent',
      status: 'active',
      ...(input.branchId ? { branchId: input.branchId } : {}),
    },
    select: { id: true, name: true, branchId: true },
    orderBy: { name: 'asc' },
  });

  const [pings, entries] = await Promise.all([
    prisma.agentLocationPing.findMany({
      where: {
        tenantId: input.tenantId,
        serverTime: { gte: dayStart, lt: dayEnd },
        agentId: { in: agents.map((agent) => agent.id) },
      },
      orderBy: { serverTime: 'asc' },
    }),
    prisma.collectionEntry.findMany({
      where: {
        tenantId: input.tenantId,
        submittedAt: { gte: dayStart, lt: dayEnd },
        agentId: { in: agents.map((agent) => agent.id) },
      },
      select: {
        id: true,
        agentId: true,
        latitude: true,
        longitude: true,
        locationStatus: true,
        receivedAmount: true,
        submittedAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { submittedAt: 'asc' },
    }),
  ]);

  return agents.map((agent) => {
    const agentPings = pings.filter((ping) => ping.agentId === agent.id);
    const last = agentPings.length ? agentPings[agentPings.length - 1] : null;
    const agentEntries = entries.filter((entry) => entry.agentId === agent.id);
    const mismatchCount = agentEntries.filter((entry) => entry.locationStatus === 'mismatch').length;
    const lastSeenMinutes = minutesSince(last?.serverTime);
    const alerts = [
      lastSeenMinutes !== null && lastSeenMinutes >= 120 ? 'not_moved_2h' : null,
      lastSeenMinutes !== null && lastSeenMinutes >= 30 ? 'offline_30m' : null,
      mismatchCount >= 3 ? 'multiple_mismatches' : null,
    ].filter(Boolean);

    return {
      agentId: agent.id,
      agentName: agent.name,
      branchId: agent.branchId,
      lastLocation: last ? { lat: last.latitude, lng: last.longitude, time: last.serverTime } : null,
      minutesSinceLastPing: lastSeenMinutes,
      collectionsDoneToday: agentEntries.length,
      alerts,
      path: agentPings.map((ping) => ({
        lat: ping.latitude,
        lng: ping.longitude,
        time: ping.serverTime,
        type: ping.pingType,
      })),
      collectionPoints: agentEntries
        .filter((entry) => entry.latitude !== null && entry.longitude !== null)
        .map((entry) => ({
          id: entry.id,
          lat: entry.latitude!,
          lng: entry.longitude!,
          customerName: entry.customer.name,
          amount: Number(entry.receivedAmount),
          time: entry.submittedAt,
          locationStatus: entry.locationStatus,
        })),
    };
  });
}
