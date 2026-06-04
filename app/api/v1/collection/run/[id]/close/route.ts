import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { closeRun, type RunActor } from '@/lib/collectionRun';

/** POST /api/v1/collection/run/:id/close  (agent/admin) — locks the run. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const { id } = await params;
    const actor: RunActor = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      agentId: ctx.userId,
      branchId: ctx.branchId,
      role: ctx.role,
      userId: ctx.userId,
    };
    const run = await closeRun(actor, id);
    return ok(run);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'run_not_found') return fail('Run not found', 404);
    if (msg === 'forbidden') return fail('Forbidden', 403);
    if (msg === 'run_reconciled') return fail('Run already reconciled', 409);
    return fail(msg || 'Failed to close run', 500);
  }
}
