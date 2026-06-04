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

  if (!['superadmin', 'developer', 'admin'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { toggleUserStatus, manageMasterUser } = await import('@/app/admin/actions');

    if (body.status && Object.keys(body).length === 1) {
      const res = await toggleUserStatus(id, body.status);
      if (res.success) return ok({ success: true });
      return fail('Failed to update status', 400);
    }

    // Otherwise, generic update
    const formData = new FormData();
    formData.append('id', id);
    formData.append('role', body.role);
    formData.append('name', body.name);
    formData.append('username', body.username);
    formData.append('phone', body.phone);
    if (body.password) formData.append('password', body.password);
    if (body.appType) formData.append('appType', body.appType);
    if (body.branchId) formData.append('branchId', body.branchId);
    if (body.status) formData.append('status', body.status);

    const res = await manageMasterUser(formData);
    if (res.success) return ok(res);
    return fail(res.error || 'Failed to update user', 400);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
