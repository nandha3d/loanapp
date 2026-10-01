import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { buildRouteSheet, runAccessWhere } from '@/lib/collectionRun';

/**
 * GET /api/v1/collection/run/:id/sheet  (agent/admin)
 * Returns the run header + ordered collection sheet (one row per due/overdue
 * instalment, in route walking order).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const { id } = await params;
    const run = await prisma.collectionRun.findFirst({ where: runAccessWhere(ctx, id) });
    if (!run) return fail('Run not found', 404);
    // RUN-01: another agent's run does not exist for this agent.
    if (ctx.role === 'agent' && run.agentId !== ctx.userId) return fail('Run not found', 404);
    if (!run.routeId) return ok({ run, sheet: [] });

    const sheet = await buildRouteSheet(
      { tenantId: ctx.tenantId, appType: ctx.appType },
      run.routeId,
      run.date,
    );
    return ok({ run, sheet });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load sheet', 500);
  }
}
