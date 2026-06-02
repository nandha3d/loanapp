import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentBalance, getAgentStatement } from '@/lib/wallet';

/**
 * GET /api/v1/wallet/me
 * Current user's float balance + recent ledger entries.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const [balance, transactions] = await Promise.all([
      getAgentBalance(ctx.tenantId, ctx.userId),
      getAgentStatement(ctx.tenantId, ctx.userId, 50),
    ]);
    return ok({ balance, transactions });
  } catch (e: any) {
    return fail(e?.message ?? 'Wallet lookup failed', 500);
  }
}
