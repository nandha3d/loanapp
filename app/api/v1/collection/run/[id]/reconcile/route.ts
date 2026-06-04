import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { reconcileRun, type RunActor } from '@/lib/collectionRun';

/**
 * POST /api/v1/collection/run/:id/reconcile  (agent/admin)
 * Agent declares the cash deposited. Body: { cashDeposited, depositRef?, note? }
 * Exact match -> wallet deposit; variance -> deposit + ApprovalRequest.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const { id } = await params;
    const body = await req.json();
    const cashDeposited = Number(body.cashDeposited);
    if (!Number.isFinite(cashDeposited) || cashDeposited < 0) return fail('Invalid cashDeposited', 400);

    const actor: RunActor = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      agentId: ctx.userId,
      branchId: ctx.branchId,
      role: ctx.role,
      userId: ctx.userId,
    };
    const run = await reconcileRun(actor, id, {
      cashDeposited,
      depositRef: body.depositRef ?? null,
      note: body.note ?? null,
    });
    return ok(run);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'run_not_found') return fail('Run not found', 404);
    if (msg === 'forbidden') return fail('Forbidden', 403);
    if (msg === 'run_not_closed') return fail('Close the run before reconciling', 409);
    if (msg === 'already_reconciled') return fail('Run already reconciled', 409);
    if (msg === 'insufficient_float') return fail('Deposit exceeds cash on hand', 402);
    return fail(msg || 'Reconcile failed', 500);
  }
}
