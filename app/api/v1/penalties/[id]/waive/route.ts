import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { waivePenalty } from '@/lib/penalties';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role === 'agent') {
    return fail('Forbidden: Agents cannot waive penalties', 403);
  }
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const amount = body.amount !== undefined ? Number(body.amount) : undefined;
    const reason = body.reason ? String(body.reason).trim() : null;

    const updated = await waivePenalty({
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      branchId: ctx.branchId,
      userId: ctx.userId,
      role: ctx.role,
      penaltyId: id,
      amount,
      reason,
    });

    return ok(updated);
  } catch (e: any) {
    const msg = e?.message ?? 'Waive failed';
    if (msg.includes('not found')) return fail('Penalty not found', 404);
    if (msg.includes('Forbidden')) return fail(msg, 403);
    if (msg.includes('Invalid waive amount')) return fail(msg, 400);
    return fail(msg, 500);
  }
}
