import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { collectRunLines, type RunActor, type RunCollectLine } from '@/lib/collectionRun';

/**
 * POST /api/v1/collection/run/:id/collect  (agent/admin)
 * Posts a batch of collection lines against an open run, in one transaction.
 * Body: { lines: [{ instalmentId, receivedAmount, paymentMode?, lat?, lng?, remarks? }] }
 * Invalid lines are skipped & reported; valid lines always post.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(routeKey('run:collect', ip), { limit: 60, windowMs: 60 * 1000 });
  if (!rl.allowed) return fail('Too many requests', 429);

  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const { id } = await params;
    const body = await req.json();
    const lines: RunCollectLine[] = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) return fail('No lines provided', 400);

    const actor: RunActor = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      agentId: ctx.userId,
      branchId: ctx.branchId,
      role: ctx.role,
      userId: ctx.userId,
    };
    const result = await collectRunLines(actor, id, lines);
    return ok(result);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'run_not_found') return fail('Run not found', 404);
    if (msg === 'run_closed') return fail('Run is closed', 409);
    if (msg === 'forbidden') return fail('Forbidden', 403);
    return fail(msg || 'Collection failed', 500);
  }
}
