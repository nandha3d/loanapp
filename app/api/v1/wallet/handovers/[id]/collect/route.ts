import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { collectCashHandover, HandoverRequestError } from '@/lib/cashHandover';
import { InsufficientFloatError } from '@/lib/wallet';

/** POST /api/v1/wallet/handovers/:id/collect — same as the web wallet Collect (WAL-01). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id } = await params;
  try {
    await collectCashHandover({ tenantId: ctx.tenantId, appType: ctx.appType, userId: ctx.userId, branchId: ctx.branchId ?? null }, id);
    return ok({ success: true });
  } catch (e: any) {
    if (e instanceof HandoverRequestError) return fail(e.message, e.status);
    if (e instanceof InsufficientFloatError) return fail(e.message, 409); // MONEY-16
    return fail(e?.message ?? 'Collect failed', 500);
  }
}
