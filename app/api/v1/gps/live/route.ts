import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * GET /api/v1/gps/live
 * Returns the latest known location for all active agents. Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    // Note: Prisma does not support distinct + orderBy properly in all DBs.
    // Instead we can query the latest ping per agent by doing a query with a 
    // subquery or fetching all distinct agents and their latest pings, 
    // but the most reliable way in Prisma without raw SQL is to fetch 
    // all recent pings and deduplicate in code, or fetch agents and then their ping.
    
    // Fetch all agents in the tenant
    const agents = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, role: 'agent', status: 'active' },
      select: { id: true, name: true, phone: true },
    });

    // Fetch the latest ping for each agent (one DB hit per agent is fine if agent count is small, 
    // but a better way is to query pings grouped or just fetch the last N hours of pings)
    // Let's fetch the latest ping for all these agents.
    
    const pings = await prisma.agentLocationPing.findMany({
      where: {
        tenantId: ctx.tenantId,
        agentId: { in: agents.map((a) => a.id) },
        // Optionally filter by recent pings only to avoid scanning large tables
        // capturedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      orderBy: { capturedAt: 'desc' },
    });

    const latestPingsMap = new Map<string, (typeof pings)[number]>();
    for (const ping of pings) {
      if (!latestPingsMap.has(ping.agentId)) {
        latestPingsMap.set(ping.agentId, ping);
      }
    }

    // Today's collection per agent (collected today, count of entries).
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const entries = await prisma.collectionEntry.findMany({
      where: {
        tenantId: ctx.tenantId,
        agentId: { in: agents.map((a) => a.id) },
        submittedAt: { gte: todayStart },
      },
      select: { agentId: true, receivedAmount: true },
    });
    const collMap = new Map<string, { total: number; count: number }>();
    for (const e of entries) {
      const c = collMap.get(e.agentId) ?? { total: 0, count: 0 };
      c.total += Number(e.receivedAmount);
      c.count += 1;
      collMap.set(e.agentId, c);
    }

    // Online = pinged within the last 5 minutes.
    const ONLINE_MS = 5 * 60 * 1000;
    const now = Date.now();

    // ALL agents (online + offline). Offline agents keep their last-known ping.
    const result = agents.map((agent) => {
      const ping = latestPingsMap.get(agent.id);
      const coll = collMap.get(agent.id);
      const online =
        ping != null && now - new Date(ping.capturedAt).getTime() <= ONLINE_MS;
      return {
        agentId: agent.id,
        agentName: agent.name,
        agentPhone: agent.phone,
        lat: ping?.lat ?? null,
        lng: ping?.lng ?? null,
        capturedAt: ping?.capturedAt ?? null,
        online,
        todayCollected: coll?.total ?? 0,
        todayEntries: coll?.count ?? 0,
      };
    });
    // Online first, then most-recently-seen.
    result.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      const ta = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
      const tb = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
      return tb - ta;
    });

    return ok(result);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to fetch live GPS data', 500);
  }
}
