import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { createSelfPayLink } from '@/lib/selfPay';

/**
 * POST /api/v1/collection/self-pay/link  (agent/admin)
 * Generates a borrower self-pay link/QR for an instalment (mCollect-B).
 * Body: { instalmentId?, loanId?, amount?, channel? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json();
    if (!body.instalmentId && !body.loanId) return fail('instalmentId or loanId required', 400);
    const link = await createSelfPayLink({
      tenantId: ctx.tenantId,
      instalmentId: body.instalmentId ? String(body.instalmentId) : undefined,
      loanId: body.loanId ? String(body.loanId) : undefined,
      amount: body.amount != null ? Number(body.amount) : undefined,
      channel: body.channel ? String(body.channel) : undefined,
    });
    return ok(link);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'instalment_not_found') return fail('Instalment not found', 404);
    if (msg === 'nothing_due') return fail('Nothing due on this instalment', 409);
    return fail(msg || 'Failed to create link', 500);
  }
}
