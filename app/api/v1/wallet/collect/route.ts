import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { collectCashFromAgent, HandoverRequestError } from '@/lib/cashHandover';
import { InsufficientFloatError } from '@/lib/wallet';

/**
 * POST /api/v1/wallet/collect — admin collects cash from an agent in person,
 * same as the web wallet "Collect from agent" (WAL-01). Body: { agentId, amount, note? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  try {
    const body = (await req.json().catch(() => null)) as { agentId?: string; amount?: number | string; note?: string } | null;
    await collectCashFromAgent(
      { tenantId: ctx.tenantId, appType: ctx.appType, userId: ctx.userId, branchId: ctx.branchId ?? null },
      { agentId: String(body?.agentId ?? ''), amount: Number(body?.amount), note: body?.note ?? null },
    );
    return ok({ success: true });
  } catch (e: any) {
    if (e instanceof HandoverRequestError) return fail(e.message, e.status);
    if (e instanceof InsufficientFloatError) return fail(e.message, 409); // MONEY-16
    return fail(e?.message ?? 'Collect failed', 500);
  }
}
