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
    const { updateBranch } = await import('@/app/admin/actions');

    const formData = new FormData();
    formData.append('id', id);
    formData.append('name', body.name);
    formData.append('code', body.code);
    formData.append('phone', body.phone || '');
    formData.append('status', body.status || 'active');
    formData.append('superadminId', body.superadminId || ctx.userId);

    const res = await updateBranch(formData);
    if (res.success) {
      return ok(res);
    } else {
      return fail(res.error || 'Failed to update branch', 400);
    }
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
