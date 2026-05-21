'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { withActionAuth } from '@/lib/serverActionAuth';
import { normalizeModuleList } from '@/types/modules';

export async function submitBranchRequest(formData: FormData) {
  const branchIdValue = formData.get('branchId') as string | null;
  const branchId = branchIdValue || null;
  const branchName = (formData.get('branchName') as string | null)?.trim() || null;
  const reason = (formData.get('reason') as string | null)?.trim() || null;
  const requestedModules = normalizeModuleList(formData.getAll('requestedModules'));

  if (!branchId && !branchName) {
    return { success: false, error: 'Branch name is required for a new branch request' };
  }
  if (requestedModules.length === 0) {
    return { success: false, error: 'Select at least one module' };
  }

  return withActionAuth(['superadmin'], async ({ userId, tenantId }) => {
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId, superadminId: userId },
        select: { id: true },
      });
      if (!branch) return { success: false, error: 'Branch not found or access denied' };
    }

    const request = await prisma.branchRequest.create({
      data: {
        tenantId,
        requestedById: userId,
        branchId,
        branchName,
        requestedModules: JSON.stringify(requestedModules),
        reason,
        status: 'pending',
      },
    });

    await prisma.systemNotification.create({
      data: {
        tenantId,
        appType: 'microlending',
        type: 'branch_request',
        icon: 'account_tree',
        title: 'Branch request submitted',
        message: branchId
          ? 'A superadmin requested module changes for a branch.'
          : `A superadmin requested a new branch: ${branchName}.`,
        link: '/admin/branch-requests',
      },
    }).catch(() => {});

    revalidatePath('/branch-requests');
    revalidatePath('/admin/branch-requests');
    return { success: true, data: request };
  });
}
