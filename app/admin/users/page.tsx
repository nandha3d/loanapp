import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import UsersClient from './UsersClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PLAN_FEATURES } from '@/lib/plans';
import { normalizeEnabledModules } from '@/lib/subscription';
import { normalizeModuleList, type ModuleKey } from '@/types/modules';

export default async function AdminUsersPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole !== 'superadmin' && userRole !== 'developer') {
    redirect('/portal');
  }

  const tenantId = await getDefaultTenantId();
  const defaultAppType = await getUserAppType();

  // If developer, we want to see all tenants/users
  let userWhere: any = userRole === 'developer' ? {} : { tenantId };
  if (userRole !== 'developer') {
    userWhere.role = { not: 'developer' };
  }

  let branchWhere: any = userRole === 'developer' ? {} : { tenantId };

  if (userRole === 'superadmin') {
    branchWhere.superadminId = session?.user?.id;
    userWhere = {
      tenantId,
      role: { not: 'developer' },
      OR: [
        { id: session?.user?.id },
        {
          branch: {
            superadminId: session?.user?.id
          }
        },
        { branchId: null }
      ]
    };
  }

  const [users, branches, subscriptions, superadminBranchLinks] = await Promise.all([
    prisma.user.findMany({ 
      where: userWhere,
      include: { branch: true, userBranchModules: true, userModules: true },
      orderBy: { name: 'asc' }
    }),
    prisma.branch.findMany({
      where: branchWhere,
      include: { _count: { select: { users: true, routes: true, customers: true, loans: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.tenantSubscription.findMany(),
    // All SuperadminBranch entries for this context (developer sees all, superadmin sees own)
    prisma.superadminBranch.findMany({
      where: userRole === 'developer' ? {} : { superadminId: session?.user?.id },
      select: { superadminId: true, branchId: true },
    }),
  ]);

  const currentSubscription = subscriptions.find(s => s.tenantId === tenantId);
  const planKey = currentSubscription?.plan || 'trial';
  const planModules = normalizeEnabledModules(currentSubscription?.enabledModules || PLAN_FEATURES[planKey]?.modules);

  const superadmins = users
    .filter((user) => user.role === 'superadmin')
    .map((superadmin) => {
      const saTenantId = superadmin.tenantId;
      const saSubscription = subscriptions.find(s => s.tenantId === saTenantId);
      const ownedBranches = branches.filter((branch) => branch.tenantId === saTenantId && branch.superadminId === superadmin.id);
      const branchIds = new Set(ownedBranches.map((branch) => branch.id));
      const admins = users.filter((user) => user.role === 'admin' && user.branchId && branchIds.has(user.branchId));
      const agents = users.filter((user) => user.role === 'agent' && user.branchId && branchIds.has(user.branchId));
      
      // Use subscription modules instead of branch modules for the summary card
      const saPlanKey = saSubscription?.plan || 'trial';
      const modules = normalizeEnabledModules(saSubscription?.enabledModules || PLAN_FEATURES[saPlanKey]?.modules) as ModuleKey[];

      return {
        id: superadmin.id,
        tenantId: saTenantId,
        name: superadmin.name,
        username: superadmin.username,
        phone: superadmin.phone,
        email: superadmin.email,
        status: superadmin.status,
        subscription: saSubscription,
        branches: ownedBranches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          enabledModules: normalizeModuleList(branch.enabledModules),
          usersCount: branch._count.users,
          routesCount: branch._count.routes,
          customersCount: branch._count.customers,
          loansCount: branch._count.loans,
        })),
        assignedBranchIds: superadminBranchLinks
          .filter((l) => l.superadminId === superadmin.id)
          .map((l) => l.branchId),
        adminCount: admins.length,
        agentCount: agents.length,
        modules,
      };
    });

  return (
    <UsersClient
      users={users}
      branches={branches}
      viewerRole={userRole}
      defaultAppType={defaultAppType}
      subscription={currentSubscription}
      planModules={planModules}
      superadmins={superadmins}
      allBranches={userRole === 'developer' ? await prisma.branch.findMany({ select: { id: true, name: true, code: true, tenantId: true } }) : branches.map(b => ({ id: b.id, name: b.name, code: b.code, tenantId: b.tenantId }))}
    />
  );
}
