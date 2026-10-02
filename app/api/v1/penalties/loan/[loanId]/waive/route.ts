import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { waiveLoanPenalties } from '@/lib/penalties';

/**
 * POST /api/v1/penalties/loan/:loanId/waive  { amount?, reason }
 * DEC-03 (B): waive a loan's open penalties (all, or `amount` oldest-first)
 * in one transaction. Admin roles only (D6).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden: Agents cannot waive penalties', 403);
  const { loanId } = await params;
  try {
    const body = await req.json();
    return ok(await waiveLoanPenalties(
      { tenantId: ctx.tenantId, appType: ctx.appType, branchId: ctx.branchId, userId: ctx.userId, role: ctx.role },
      { loanId, amount: body.amount != null ? Number(body.amount) : null, reason: body.reason ? String(body.reason).trim() : null },
    ));
  } catch (e: any) {
    const msg = e?.message ?? 'Waive failed';
    if (msg.includes('not found')) return fail('Penalty not found', 404);
    if (msg.includes('Forbidden')) return fail(msg, 403);
    if (msg.includes('Invalid waive amount')) return fail(msg, 400);
    return fail(msg, 500);
  }
}
