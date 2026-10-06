import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getBranchCapacity } from '@/lib/branches';

/** Branch limit + modules the tenant's plan allows, for the branch-creation form. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    return ok(await getBranchCapacity(ctx.tenantId));
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
