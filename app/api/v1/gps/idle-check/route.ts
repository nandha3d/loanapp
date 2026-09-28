import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { resolveActor } from '@/lib/api/dualAuth';
import { distanceMeters } from '@/lib/gps/geofence';

/**
 * GET /api/v1/gps/idle-check
 * Evaluates active agent location pings over the configured idle period.
 * If displacement is less than 10m, triggers a stationary system notification.
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const ctx = await resolveActor(req);
  if (!ctx) return fail('Unauthorized', 401);

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const { getSetting } = await import('@/lib/tenant');
    const raw = await getSetting(ctx.tenantId, 'gps_idle_minutes', '30');
    const idleMinutes = parseInt(raw, 10) || 30;
    const idleCutoff = new Date(Date.now() - idleMinutes * 60 * 1000);

    const agents = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, role: 'agent', status: 'active' },
      select: { id: true, name: true },
    });

    const flagged: Array<{
      agentId: string;
      agentName: string;
      displacement: number;
      pingCount: number;
      lastSeen: Date;
    }> = [];

    for (const agent of agents) {
      const pings = await prisma.agentLocationPing.findMany({
        where: {
          tenantId: ctx.tenantId,
          agentId: agent.id,
          capturedAt: { gte: idleCutoff },
        },
        orderBy: { capturedAt: 'asc' },
      });

      if (pings.length >= 2) {
        let maxDist = 0;
        for (let i = 0; i < pings.length; i++) {
          for (let j = i + 1; j < pings.length; j++) {
            const dist = distanceMeters(
              pings[i].lat,
              pings[i].lng,
              pings[j].lat,
              pings[j].lng,
            );
            if (dist > maxDist) maxDist = dist;
          }
        }

        // If max displacement is less than 10 meters, agent is flagged as idle
        if (maxDist < 10) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const existingAlert = await prisma.systemNotification.findFirst({
            where: {
              tenantId: ctx.tenantId,
              type: 'agent_stationary',
              message: { contains: agent.name },
              createdAt: { gte: oneHourAgo },
            },
          });

          if (!existingAlert) {
            await prisma.systemNotification.create({
              data: {
                tenantId: ctx.tenantId,
                appType: 'microlending',
                type: 'agent_stationary',
                icon: 'person_pin',
                title: 'Agent Stationary Alert',
                message: `Agent ${agent.name} has been stationary (movement < 10m) for over ${idleMinutes} minutes.`,
                link: '/route-tracker',
                targetRole: 'admin',
              },
            });
          }

          flagged.push({
            agentId: agent.id,
            agentName: agent.name,
            displacement: maxDist,
            pingCount: pings.length,
            lastSeen: pings[pings.length - 1].capturedAt,
          });
        }
      }
    }

    return ok({ flagged });
  } catch (e: any) {
    console.error('[/api/v1/gps/idle-check GET]', e);
    return fail(e?.message ?? 'Failed to perform stationary agent check', 500);
  }
}
