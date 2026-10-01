import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { requestCashHandover, HandoverRequestError } from '@/lib/cashHandover';

/**
 * POST /api/v1/wallet/deposit
 * Agent asks to hand collected cash to the office (MON-01). Same as the web
 * "Hand over" action: creates a PENDING handover; float moves only when an
 * admin collects it. Body: { amount, note? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (ctx.role !== 'agent') return fail('Forbidden', 403);

  try {
    const body = (await req.json().catch(() => null)) as
      | { amount?: number | string; note?: string }
      | null;
    const handover = await requestCashHandover(
      { tenantId: ctx.tenantId, appType: ctx.appType, userId: ctx.userId },
      { amount: Number(body?.amount), note: body?.note ?? null },
    );
    return ok({ handoverId: handover.id, status: handover.status });
  } catch (e: any) {
    if (e instanceof HandoverRequestError) return fail(e.message, e.status);
    return fail(e?.message ?? 'Handover request failed', 500);
  }
}
