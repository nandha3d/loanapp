import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const branches = await prisma.branch.findMany({
      where: {
        tenantId: ctx.role === 'developer' ? undefined : ctx.tenantId,
      },
      orderBy: { name: 'asc' },
    });
    return ok(branches);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { createBranch } = await import('@/app/admin/actions');

    const formData = new FormData();
    formData.append('name', body.name);
    formData.append('code', body.code);
    formData.append('phone', body.phone || '');
    formData.append('superadminId', body.superadminId || ctx.userId);

    const res = await createBranch(formData);
    if (res.success) {
      return ok(res);
    } else {
      return fail(res.error || 'Failed to create branch', 400);
    }
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
