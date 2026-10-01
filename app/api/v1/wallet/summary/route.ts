import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getWalletSummary } from '@/lib/walletSummary';

/** GET /api/v1/wallet/summary — the web wallet overview (WAL-01, API-8). Staff only. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  try {
    return ok(await getWalletSummary(ctx.tenantId, ctx.appType, ctx.branchId ?? null));
  } catch (e: any) {
    return fail(e?.message ?? 'Wallet summary failed', 500);
  }
}
