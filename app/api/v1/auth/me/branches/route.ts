import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getSuperadminBranches } from '@/lib/branch';

/**
 * GET /api/v1/auth/me/branches — the branch switcher, same list as the web
 * header: a superadmin's own active branches, with "All Branches" (id `all`)
 * first when there are two or more. Everyone else is pinned to their branch,
 * so `canSwitch` is false and the list is empty.
 *
 * `activeBranchId` is the branch this very request resolved to from
 * `X-Branch-Id` (null = All Branches), so the app shows what the API scopes by.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role !== 'superadmin') {
    return ok({ canSwitch: false, activeBranchId: ctx.branchId, branches: [] });
  }

  const own = await getSuperadminBranches(ctx.tenantId, ctx.userId);
  const branches = own.map((b) => ({ id: b.id, name: b.name, code: b.code }));
  if (branches.length > 1) branches.unshift({ id: 'all', name: 'All Branches', code: null });

  return ok({
    canSwitch: branches.length > 1,
    activeBranchId: ctx.branchId ?? 'all',
    branches,
  });
}
