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

    const latestPingsMap = new Map();
    for (const ping of pings) {
      if (!latestPingsMap.has(ping.agentId)) {
        latestPingsMap.set(ping.agentId, ping);
      }
    }

    const result = agents.map((agent) => {
      const ping = latestPingsMap.get(agent.id);
      return {
        agentId: agent.id,
        agentName: agent.name,
        agentPhone: agent.phone,
        lat: ping?.lat ?? null,
        lng: ping?.lng ?? null,
        capturedAt: ping?.capturedAt ?? null,
      };
    }).filter((a) => a.lat !== null && a.lng !== null);

    return ok(result);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to fetch live GPS data', 500);
  }
}
