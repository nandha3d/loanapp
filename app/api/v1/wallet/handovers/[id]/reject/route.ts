import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { rejectCashHandover, HandoverRequestError } from '@/lib/cashHandover';

/** POST /api/v1/wallet/handovers/:id/reject — same as the web wallet Reject (WAL-01). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id } = await params;
  try {
    await rejectCashHandover({ tenantId: ctx.tenantId, appType: ctx.appType, userId: ctx.userId, branchId: ctx.branchId ?? null }, id);
    return ok({ success: true });
  } catch (e: any) {
    if (e instanceof HandoverRequestError) return fail(e.message, e.status);
    return fail(e?.message ?? 'Reject failed', 500);
  }
}
