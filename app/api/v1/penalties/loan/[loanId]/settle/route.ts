import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { settleLoanPenalties } from '@/lib/penalties';

/**
 * POST /api/v1/penalties/loan/:loanId/settle  { amount, paymentMode, notes? }
 * DEC-03 (B): the server splits the amount over the loan's open penalties,
 * oldest first, in one transaction (agents for linked customers; staff in scope).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer', 'agent'].includes(ctx.role)) return fail('Forbidden', 403);
  const { loanId } = await params;
  try {
    const body = await req.json();
    return ok(await settleLoanPenalties(
      { tenantId: ctx.tenantId, appType: ctx.appType, branchId: ctx.branchId, userId: ctx.userId, role: ctx.role },
      { loanId, amount: Number(body.amount ?? 0), paymentMode: String(body.paymentMode || 'cash'), notes: body.notes ? String(body.notes) : null },
    ));
  } catch (e: any) {
    const msg = e?.message ?? 'Settle failed';
    if (msg.includes('not found')) return fail('Penalty not found', 404);
    if (msg.includes('Invalid settle amount')) return fail(msg, 400);
    return fail(msg, 500);
  }
}
