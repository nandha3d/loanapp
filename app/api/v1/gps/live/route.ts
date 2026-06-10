import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { resolveActor } from '@/lib/api/dualAuth';

/**
 * GET /api/v1/gps/live
 * Returns the latest known location for all active agents. Admin only.
 */
export async function GET(req: NextRequest) {
  const ctx = await resolveActor(req);
  if (!ctx) return fail('Unauthorized', 401);

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    // Fetch all agents in the tenant
    const agents = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, role: 'agent', status: 'active' },
      select: { id: true, name: true, phone: true },
    });

    // Latest ping per agent in a single DB round trip (raw SQL — Prisma can't
    // express "latest row per group" efficiently). 48h lookback keeps the scan
    // bounded on the (tenant_id, agent_id, captured_at) index.
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const latestPings = await prisma.$queryRaw<Array<{
      agent_id: string;
      lat: number;
      lng: number;
      captured_at: Date;
    }>>`
      SELECT alp.agent_id, alp.lat, alp.lng, alp.captured_at
      FROM agent_location_pings alp
      INNER JOIN (
        SELECT agent_id, MAX(captured_at) AS max_at
        FROM agent_location_pings
        WHERE tenant_id = ${ctx.tenantId}
          AND captured_at >= ${cutoff}
        GROUP BY agent_id
      ) latest
        ON alp.agent_id = latest.agent_id AND alp.captured_at = latest.max_at
      WHERE alp.tenant_id = ${ctx.tenantId}
    `;

    const latestPingsMap = new Map<string, { lat: number; lng: number; capturedAt: Date }>();
    for (const ping of latestPings) {
      if (!latestPingsMap.has(ping.agent_id)) {
        latestPingsMap.set(ping.agent_id, {
          lat: ping.lat,
          lng: ping.lng,
          capturedAt: ping.captured_at,
        });
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
        ping != null && now - ping.capturedAt.getTime() <= ONLINE_MS;
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
