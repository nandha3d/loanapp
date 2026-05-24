import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * POST /api/v1/gps/ping
 * Body: { lat, lng, accuracyM?, speedMps?, capturedAt?, routeId? }
 * Or batch: { pings: [...] }
 * Agent posts location every ~30s during active route.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (ctx.role !== 'agent' && ctx.role !== 'admin' && ctx.role !== 'superadmin') {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const raw: any[] = Array.isArray(body?.pings) ? body.pings : [body];

    const rows = raw
      .map((p) => ({
        tenantId: ctx.tenantId,
        agentId: ctx.userId,
        routeId: typeof p.routeId === 'string' ? p.routeId : null,
        lat: Number(p.lat),
        lng: Number(p.lng),
        accuracyM: typeof p.accuracyM === 'number' ? p.accuracyM : null,
        speedMps: typeof p.speedMps === 'number' ? p.speedMps : null,
        capturedAt: p.capturedAt ? new Date(p.capturedAt) : new Date(),
      }))
      .filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng) &&
          Math.abs(p.lat) <= 90 &&
          Math.abs(p.lng) <= 180,
      );

    if (rows.length === 0) return fail('No valid pings', 400);

    await prisma.agentLocationPing.createMany({ data: rows });
    return ok({ accepted: rows.length });
  } catch (e: any) {
    return fail(e?.message ?? 'GPS ping failed', 500);
  }
}
