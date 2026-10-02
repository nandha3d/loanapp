import prisma from '@/lib/db';

export type BranchActor = { userId: string; role: string; tenantId: string };
type BranchResult = { success: boolean; error?: string; branch?: { id: string; name: string } };

/**
 * SET-03: create a branch in Settings — shared by the web Settings action and
 * POST /api/v1/admin/branches (bearer token). Superadmin / developer only.
 */
export async function createTenantBranchFor(
  actor: BranchActor,
  input: { name?: string | null; code?: string | null; phone?: string | null; address?: string | null; enabledModules?: string[] },
): Promise<BranchResult> {
  const { userId, role, tenantId } = actor;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized: Only business owners (superadmin) can create branches.' };
  }

  // Enforce subscription active status
  try {
    const { assertTenantSubscriptionAccess } = await import('@/lib/subscription');
    await assertTenantSubscriptionAccess(tenantId);
  } catch (err: any) {
    return { success: false, error: err.message || 'Subscription inactive or payment required' };
  }

  // Enforce branch limit
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { enabledModules: true, maxBranches: true },
  });

  const existingBranchCount = await prisma.branch.count({
    where: { tenantId, status: 'active' },
  });

  if (sub && sub.maxBranches > 0 && existingBranchCount >= sub.maxBranches) {
    return {
      success: false,
      error: `Branch limit reached (${existingBranchCount}/${sub.maxBranches}). Upgrade your subscription plan to add more branches.`,
    };
  }

  const name = input.name?.trim();
  const rawCode = input.code?.trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;

  if (!name) {
    return { success: false, error: 'Branch name is required.' };
  }

  const code = rawCode ? rawCode.toUpperCase() : null;

  if (code) {
    const existingCode = await prisma.branch.findFirst({
      where: { tenantId, code },
      select: { id: true },
    });
    if (existingCode) {
      return { success: false, error: `Branch code "${code}" already exists for your business.` };
    }
  }

  // Validate modules against tenant subscription
  const { normalizeModuleList } = await import('@/types/modules');
  const planModules = normalizeModuleList(sub?.enabledModules);
  const selectedModules = normalizeModuleList(input.enabledModules ?? []);

  // If no modules selected, default to tenant plan modules
  const finalModules = selectedModules.length > 0
    ? selectedModules.filter((m) => planModules.includes(m))
    : planModules;

  if (finalModules.length === 0) {
    return { success: false, error: 'At least one valid module from your subscription must be enabled for this branch.' };
  }

  try {
    const branch = await prisma.$transaction(async (tx) => {
      const b = await tx.branch.create({
        data: {
          tenantId,
          superadminId: userId,
          name,
          code,
          phone,
          address,
          status: 'active',
          enabledModules: JSON.stringify(finalModules),
        },
      });

      // Link creating user in SuperadminBranch so the branch is immediately available in switcher
      await tx.superadminBranch.create({
        data: {
          superadminId: userId,
          branchId: b.id,
          assignedById: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'create',
          entityType: 'branch',
          entityId: b.id,
          newValue: JSON.stringify({ name, code, phone, address, enabledModules: finalModules }),
        },
      });

      return b;
    });

    return { success: true, branch: { id: branch.id, name: branch.name } };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Branch code already exists for this business.' };
    }
    return { success: false, error: error.message || 'Failed to create branch.' };
  }
}

/** SET-03: update a branch — shared by the web action and PATCH /api/v1/admin/branches/:id. */
export async function updateTenantBranchFor(
  actor: BranchActor,
  input: { id?: string | null; name?: string | null; code?: string | null; phone?: string | null; address?: string | null; status?: string | null; enabledModules?: string[] },
): Promise<BranchResult> {
  const { userId, role, tenantId } = actor;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized: Only business owners (superadmin) can manage branches.' };
  }
  const branchId = input.id as string;
  if (!branchId) return { success: false, error: 'Branch ID is required.' };

  const targetBranch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
  });
  if (!targetBranch) return { success: false, error: 'Branch not found.' };

  const name = input.name?.trim();
  const rawCode = input.code?.trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const status = input.status?.trim() || targetBranch.status;

  if (!name) return { success: false, error: 'Branch name is required.' };

  const code = rawCode ? rawCode.toUpperCase() : null;
  if (code && code !== targetBranch.code) {
    const conflict = await prisma.branch.findFirst({
      where: { tenantId, code, id: { not: branchId } },
      select: { id: true },
    });
    if (conflict) {
      return { success: false, error: `Branch code "${code}" is already in use by another branch.` };
    }
  }

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { enabledModules: true },
  });
  const { normalizeModuleList } = await import('@/types/modules');
  const planModules = normalizeModuleList(sub?.enabledModules);
  const selectedModules = normalizeModuleList(input.enabledModules ?? []);
  const finalModules = selectedModules.length > 0
    ? selectedModules.filter((m) => planModules.includes(m))
    : normalizeModuleList(targetBranch.enabledModules);

  await prisma.branch.update({
    where: { id: branchId },
    data: {
      name,
      code,
      phone,
      address,
      status,
      enabledModules: JSON.stringify(finalModules),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'branch',
      entityId: branchId,
      oldValue: JSON.stringify({ name: targetBranch.name, code: targetBranch.code, status: targetBranch.status }),
      newValue: JSON.stringify({ name, code, phone, address, status, enabledModules: finalModules }),
    },
  });

  return { success: true };
}
