import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    // SET-03: same implementation as web Settings → Branches.
    const { updateTenantBranchFor } = await import('@/lib/branches');
    const res = await updateTenantBranchFor(
      { userId: ctx.userId, role: ctx.role, tenantId: ctx.tenantId },
      {
        id,
        name: body.name,
        code: body.code,
        phone: body.phone,
        address: body.address,
        status: body.status,
        enabledModules: Array.isArray(body.enabledModules) ? body.enabledModules.map(String) : [],
      },
    );
    if (res.success) {
      return ok(res);
    } else {
      return fail(res.error || 'Failed to update branch', 400);
    }
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
