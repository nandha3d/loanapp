import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const isDeveloper = ctx.role.toLowerCase() === 'developer';
    const users = await prisma.user.findMany({
      where: {
        tenantId: isDeveloper ? undefined : ctx.tenantId,
        deletedAt: null,
        ...(isDeveloper
          ? {}
          : {
              role: ctx.role === 'admin' ? 'agent' : { notIn: ['developer', 'DEVELOPER'] },
              appType: ctx.appType,
              ...scopedBranchWhere(ctx),
            }),
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
        // SET-04: the agent form fields web Settings edits.
        aadharNumber: true,
        dob: true,
        experience: true,
        age: true,
        bypassLoanApproval: true,
        bypassCustomerApproval: true,
        autoReleaseFloat: true,
        feeConfirmationMandatory: true,
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
      aadharNumber: u.aadharNumber,
      dob: u.dob ? u.dob.toISOString().slice(0, 10) : null,
      experience: u.experience,
      age: u.age,
      bypassLoanApproval: u.bypassLoanApproval,
      bypassCustomerApproval: u.bypassCustomerApproval,
      autoReleaseFloat: u.autoReleaseFloat,
      feeConfirmationMandatory: u.feeConfirmationMandatory,
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
    const isDeveloper = ctx.role.toLowerCase() === 'developer';
    if (!isDeveloper && body.role && body.role.toLowerCase() === 'developer') {
      return fail('Forbidden: Only developers can create or assign developer role', 403);
    }
    // SET-04 (SCOPE-13): an agent always belongs to a branch.
    if (!body.id && String(body.role || '').toLowerCase() === 'agent' && !body.branchId) {
      return fail('Agents must belong to a branch', 400);
    }
    const { manageMasterUser, manageBranchAgent } = await import('@/app/admin/actions');
    // Server actions normally read the NextAuth cookie session; mobile auth is
    // a Bearer token, so pass the verified context as the acting user.
    const actor = { id: ctx.userId, role: ctx.role, tenantId: ctx.tenantId };

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
    // SET-04: the rest of the web agent form.
    for (const key of ['email', 'aadharNumber', 'dob', 'experience', 'age', 'bypassLoanApproval', 'bypassCustomerApproval', 'autoReleaseFloat', 'feeConfirmationMandatory']) {
      if (body[key] !== undefined && body[key] !== null && body[key] !== '') formData.append(key, String(body[key]));
    }
    if (body.branchIds && Array.isArray(body.branchIds)) {
      body.branchIds.forEach((id: string) => formData.append('branchIds', id));
    }

    // Branch admins manage agents through the branch-scoped action; the
    // master action is superadmin/developer only.
    const res = ctx.role === 'admin'
      ? await manageBranchAgent(formData, actor)
      : await manageMasterUser(formData, actor);
    if (res.success) {
      return ok(res);
    } else {
      return fail(res.error || 'Failed to save user', 400);
    }
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
