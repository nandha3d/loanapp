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
    const users = await prisma.user.findMany({
      where: {
        tenantId: ctx.role === 'developer' ? undefined : ctx.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        username: true,
        role: true,
        appType: true,
        status: true,
        branchId: true,
        branch: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return ok(users.map(u => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      username: u.username,
      role: u.role,
      appType: u.appType,
      status: u.status,
      branchId: u.branchId,
      branch: u.branch?.name || null,
    })));
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'developer', 'admin'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { manageMasterUser } = await import('@/app/admin/actions');

    const formData = new FormData();
    if (body.id) formData.append('id', body.id);
    formData.append('role', body.role);
    formData.append('name', body.name);
    formData.append('username', body.username);
    formData.append('phone', body.phone);
    if (body.password) formData.append('password', body.password);
    if (body.appType) formData.append('appType', body.appType);
    if (body.branchId) formData.append('branchId', body.branchId);
    if (body.status) formData.append('status', body.status);
    if (body.branchIds && Array.isArray(body.branchIds)) {
      body.branchIds.forEach((id: string) => formData.append('branchIds', id));
    }

    const res = await manageMasterUser(formData);
    if (res.success) {
      return ok(res);
    } else {
      return fail(res.error || 'Failed to save user', 400);
    }
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
