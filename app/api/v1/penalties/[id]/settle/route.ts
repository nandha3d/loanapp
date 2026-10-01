import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { settlePenalty } from '@/lib/penalties';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer', 'agent'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }
  const { id } = await params;

  try {
    const body = await req.json();
    const action = String(body.action || 'settle');
    if (action === 'waive') {
      return fail('Use POST /api/v1/penalties/[id]/waive for waivers', 400);
    }
    const amount = Number(body.amount ?? 0);
    const paymentMode = String(body.paymentMode || 'cash');

    const updated = await settlePenalty({
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      branchId: ctx.branchId,
      userId: ctx.userId,
      role: ctx.role,
      penaltyId: id,
      amount,
      paymentMode,
      notes: body.notes ? String(body.notes) : null,
    });

    return ok(updated);
  } catch (e: any) {
    const msg = e?.message ?? 'Settle failed';
    if (msg.includes('not found')) return fail('Penalty not found', 404);
    if (msg.includes('Forbidden')) return fail(msg, 403);
    if (msg.includes('Invalid settle amount')) return fail(msg, 400);
    return fail(msg, 500);
  }
}
