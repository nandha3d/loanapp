import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import prisma from '@/lib/db';
import TeamClient from './TeamClient';

export default async function TeamPage() {
  const session = await auth();
  const user = session?.user as any;
  const userRole = user?.role;

  if (!user || !['admin', 'superadmin', 'developer'].includes(userRole)) {
    redirect('/dashboard');
  }

  const tenantId = await getDefaultTenantId();
  const activeBranchId = await getActiveBranchId();

  // Find all agents in this tenant and branch
  const whereClause: any = {
    tenantId,
    role: 'agent',
    status: { not: 'deleted' }
  };

  // Branch Admins only see agents from their assigned branch!
  if (userRole === 'admin') {
    whereClause.branchId = activeBranchId || undefined;
  } else if ((userRole === 'superadmin' || userRole === 'developer') && activeBranchId) {
    whereClause.branchId = activeBranchId;
  } else if (userRole === 'superadmin') {
    whereClause.branch = { superadminId: user.id };
  }

  const agents = await prisma.user.findMany({
    where: whereClause,
    include: {
      userBranchModules: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const branches = await prisma.branch.findMany({
    where: {
      tenantId,
      status: 'active',
      ...(userRole === 'superadmin' ? { superadminId: user.id } : {})
    },
    select: { id: true, name: true, code: true }
  });

  const activeBranch = activeBranchId 
    ? await prisma.branch.findUnique({ where: { id: activeBranchId }, select: { name: true, code: true, enabledModules: true } })
    : null;

  let allowedModules: string[] = [];
  if (activeBranchId) {
    const { getUserModulesForBranch } = await import('@/lib/branch');
    if (userRole === 'admin') {
      allowedModules = await getUserModulesForBranch(user.id, activeBranchId);
    } else {
      const { normalizeModuleList } = await import('@/types/modules');
      allowedModules = normalizeModuleList(activeBranch?.enabledModules);
    }
  }

  return (
    <TeamClient 
      initialAgents={agents} 
      branches={branches}
      activeBranch={activeBranch}
      viewerRole={userRole}
      allowedModules={allowedModules}
    />
  );
}
