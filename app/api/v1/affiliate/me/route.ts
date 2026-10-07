import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAffiliateDashboard } from '@/lib/affiliateDashboard';

/**
 * The caller's own affiliate dashboard (mobile twin of the web Affiliate page).
 * `/api/v1/admin/affiliates` is the developer's all-partners view and stays
 * developer-only; this one is scoped to the signed-in user's own record.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'admin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    return ok(await getAffiliateDashboard(ctx.userId, ctx.tenantId));
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
