import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
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
    const isDeveloper = ctx.role.toLowerCase() === 'developer';
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        tenantId: true,
        status: true,
        appType: true,
        email: true,
        aadharNumber: true,
        dob: true,
        experience: true,
        age: true,
        bypassLoanApproval: true,
        bypassCustomerApproval: true,
        autoReleaseFloat: true,
        feeConfirmationMandatory: true,
        bypassVehicleApproval: true,
        isPrimaryAdmin: true,
        branchId: true,
        name: true,
        username: true,
        phone: true,
      },
    });

    if (!targetUser) return fail('User not found', 404);

    if (!isDeveloper) {
      if (targetUser.role.toLowerCase() === 'developer' || targetUser.tenantId !== ctx.tenantId) {
        return fail('Forbidden: Cannot modify developer accounts', 403);
      }
      if (ctx.role === 'admin' && ctx.branchId && targetUser.branchId !== ctx.branchId) {
        return fail('Forbidden: Cannot modify users in other branches', 403);
      }
    }

    const body = await req.json();
    if (!isDeveloper && body.role && body.role.toLowerCase() === 'developer') {
      return fail('Forbidden: Cannot assign developer role', 403);
    }

    const { toggleUserStatus, manageMasterUser, manageBranchAgent, setBranchAgentStatus } = await import('@/app/admin/actions');
    // Server actions normally read the NextAuth cookie session; mobile auth is
    // a Bearer token, so pass the verified context as the acting user.
    const actor = { id: ctx.userId, role: ctx.role, tenantId: ctx.tenantId };

    if (body.status && Object.keys(body).length === 1) {
      const res = ctx.role === 'admin'
        ? await setBranchAgentStatus(id, body.status, ctx.appType, actor)
        : await toggleUserStatus(id, body.status, actor);
      if (res.success) return ok({ success: true });
      return fail(res.error || 'Failed to update status', 400);
    }

    // Generic update: seed FormData with current user fields so missing fields are not cleared
    const formData = new FormData();
    formData.append('id', id);

    if (targetUser.status) formData.append('status', targetUser.status);
    if (targetUser.appType) formData.append('appType', targetUser.appType);
    if (targetUser.email) formData.append('email', targetUser.email);
    if (targetUser.aadharNumber) formData.append('aadharNumber', targetUser.aadharNumber);
    if (targetUser.dob) {
      formData.append('dob', targetUser.dob instanceof Date ? targetUser.dob.toISOString().split('T')[0] : String(targetUser.dob));
    }
    if (targetUser.experience != null) formData.append('experience', String(targetUser.experience));
    if (targetUser.age != null) formData.append('age', String(targetUser.age));
    if (targetUser.bypassLoanApproval != null) formData.append('bypassLoanApproval', String(targetUser.bypassLoanApproval));
    if (targetUser.bypassCustomerApproval != null) formData.append('bypassCustomerApproval', String(targetUser.bypassCustomerApproval));
    if (targetUser.autoReleaseFloat != null) formData.append('autoReleaseFloat', String(targetUser.autoReleaseFloat));
    if (targetUser.feeConfirmationMandatory != null) formData.append('feeConfirmationMandatory', String(targetUser.feeConfirmationMandatory));
    formData.append('bypassVehicleApproval', String(targetUser.bypassVehicleApproval));
    // Only a superadmin/developer may send isPrimaryAdmin (manageMasterUser rejects it from admins).
    if (ctx.role !== 'admin' && targetUser.isPrimaryAdmin) formData.append('isPrimaryAdmin', 'true');
    if (targetUser.branchId) formData.append('branchId', targetUser.branchId);
    if (targetUser.role) formData.append('role', targetUser.role);
    if (targetUser.name) formData.append('name', targetUser.name);
    if (targetUser.username) formData.append('username', targetUser.username);
    if (targetUser.phone) formData.append('phone', targetUser.phone);

    // Overlay incoming body keys
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        if (key === 'branchIds' && Array.isArray(value)) {
          formData.delete('branchIds');
          value.forEach((bId: string) => formData.append('branchIds', bId));
        } else {
          formData.set(key, String(value));
        }
      }
    }

    const res = ctx.role === 'admin'
      ? await manageBranchAgent(formData, actor)
      : await manageMasterUser(formData, actor);

    if (res.success) return ok(res);
    return fail(res.error || 'Failed to update user', 400);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
