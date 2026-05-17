import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { auth } from './auth';
import prisma from './db';
import type { ModuleKey } from '@/types/modules';
import { normalizeModuleList } from '@/types/modules';

type SessionUser = {
  id?: string | null;
  role?: string | null;
  branchId?: string | null;
  tenantId?: string | null;
};

export const getActiveBranchId = cache(async (): Promise<string | null> => {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const role = user?.role;

  if (!role || role === 'developer') return null;

  if (role === 'superadmin') {
    const headerStore = await headers();
    const forwardedBranchId = headerStore.get('x-loantrack-active-branch');
    const cookieStore = await cookies();
    const cookieBranchId = cookieStore.get('active_branch_id')?.value;
    const activeBranchId = forwardedBranchId || cookieBranchId;
    if (!activeBranchId) {
      const firstBranch = await prisma.branch.findFirst({
        where: {
          tenantId: user?.tenantId ?? '',
          superadminId: user?.id ?? '',
          status: 'active',
        },
        select: { id: true },
        orderBy: { name: 'asc' },
      });
      return firstBranch?.id ?? null;
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: activeBranchId,
        tenantId: user?.tenantId ?? '',
        superadminId: user?.id ?? '',
        status: 'active',
      },
      select: { id: true },
    });
    return branch?.id ?? null;
  }

  return user?.branchId ?? null;
});

export async function getBranchEnabledModules(branchId: string): Promise<ModuleKey[]> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { enabledModules: true },
  });
  return normalizeModuleList(branch?.enabledModules);
}

export async function getUserModulesForBranch(
  userId: string,
  branchId: string,
): Promise<ModuleKey[]> {
  const ubm = await prisma.userBranchModule.findUnique({
    where: { userId_branchId: { userId, branchId } },
    select: { enabledModules: true },
  });
  if (ubm) return normalizeModuleList(ubm.enabledModules);
  return getBranchEnabledModules(branchId);
}

export const getActiveModules = cache(async (): Promise<ModuleKey[]> => {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const role = user?.role;

  if (!role || role === 'developer') return [];

  const branchId = await getActiveBranchId();
  if (!branchId) return [];

  if (role === 'admin' || role === 'agent') {
    return getUserModulesForBranch(user?.id ?? '', branchId);
  }

  return getBranchEnabledModules(branchId);
});

export async function getSuperadminBranches(tenantId: string, superadminId: string) {
  return prisma.branch.findMany({
    where: {
      tenantId,
      superadminId,
      status: 'active',
    },
    select: {
      id: true,
      name: true,
      code: true,
      enabledModules: true,
    },
    orderBy: { name: 'asc' },
  });
}
