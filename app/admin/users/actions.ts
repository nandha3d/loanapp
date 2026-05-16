'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { withActionAuth } from '@/lib/serverActionAuth';
import { normalizeModuleList } from '@/types/modules';
import type { ModuleKey } from '@/types/modules';

export async function assignAdminModules(data: {
  adminUserId: string;
  branchId: string;
  modules: ModuleKey[];
}) {
  return withActionAuth(['superadmin'], async ({ tenantId }) => {
    // Verify the admin belongs to this tenant + branch
    const admin = await prisma.user.findFirst({
      where: {
        id: data.adminUserId,
        tenantId,
        branchId: data.branchId,
        role: 'admin',
      },
    });
    if (!admin) return { success: false, error: 'Admin not found in this branch' };

    // Verify requested modules are a subset of branch modules
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { enabledModules: true },
    });
    const branchModules = normalizeModuleList(branch?.enabledModules);
    const invalid = data.modules.filter(m => !branchModules.includes(m));
    if (invalid.length > 0) {
      return { success: false, error: `Modules not enabled for this branch: ${invalid.join(', ')}` };
    }

    await prisma.userBranchModule.upsert({
      where: { userId_branchId: { userId: data.adminUserId, branchId: data.branchId } },
      update: { enabledModules: data.modules },
      create: {
        userId: data.adminUserId,
        branchId: data.branchId,
        enabledModules: data.modules,
      },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/branches');
    return { success: true };
  });
}
