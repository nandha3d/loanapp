import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getSetting } from '@/lib/tenant';

/**
 * Duty-window stamping: pings outside the tenant's configured work hours are
 * stored with isOnDuty=false so manager views can exclude them (labour-law
 * privacy posture). Settings: gps_duty_start / gps_duty_end ("HH:mm"),
 * evaluated in the tenant's timezone setting (default Asia/Kolkata).
 */
async function buildDutyChecker(tenantId: string): Promise<(at: Date) => boolean> {
  const [dutyStart, dutyEnd, timezone] = await Promise.all([
    getSetting(tenantId, 'gps_duty_start', '00:00'),
    getSetting(tenantId, 'gps_duty_end', '23:59'),
    getSetting(tenantId, 'timezone', 'Asia/Kolkata'),
  ]);
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
    });
  }
  return (at: Date) => {
    const hhmm = fmt.format(at);
    return hhmm >= dutyStart && hhmm <= dutyEnd;
  };
}

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
    const isOnDuty = await buildDutyChecker(ctx.tenantId);

    const rows = raw
      .map((p) => {
        const parsed = p.capturedAt ? new Date(p.capturedAt) : new Date();
        const capturedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        return {
          tenantId: ctx.tenantId,
          agentId: ctx.userId,
          routeId: typeof p.routeId === 'string' ? p.routeId : null,
          lat: Number(p.lat),
          lng: Number(p.lng),
          accuracyM: typeof p.accuracyM === 'number' ? p.accuracyM : null,
          speedMps: typeof p.speedMps === 'number' ? p.speedMps : null,
          capturedAt,
          isMocked: p.isMocked === true,
          isOnDuty: isOnDuty(capturedAt),
        };
      })
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
