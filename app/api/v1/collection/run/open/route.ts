import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { openRun, type RunActor } from '@/lib/collectionRun';

/**
 * POST /api/v1/collection/run/open  (agent/admin)
 * Opens (or returns) the route batch collection run for today.
 * Body: { routeId, date?, lat?, lng? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json();
    const routeId = String(body.routeId || '');
    if (!routeId) return fail('routeId is required', 400);

    if (ctx.role === 'agent') {
      const routeIds = await getAgentRouteIds(ctx.userId);
      if (!routeIds.includes(routeId)) return fail('Forbidden', 403);
    }

    const actor: RunActor = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      agentId: ctx.userId,
      branchId: ctx.branchId,
      role: ctx.role,
      userId: ctx.userId,
    };
    const run = await openRun(actor, {
      routeId,
      date: body.date ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
    });
    return ok(run);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to open run', 500);
  }
}
