import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import BranchesClient from './BranchesClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { normalizeModuleList } from '@/types/modules';

export default async function AdminBranchesPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole !== 'developer' && userRole !== 'superadmin') {
    redirect('/portal');
  }

  const tenantId = await getDefaultTenantId();
  
  const branchWhere: any = userRole === 'developer' ? {} : { tenantId };
  const userWhere: any = userRole === 'developer' ? { role: 'superadmin', status: 'active' } : { tenantId, role: 'superadmin', status: 'active' };

  const [branches, superadmins, subscriptions] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      include: {
        superadmin: { select: { id: true, name: true } },
        _count: { select: { users: true, routes: true } }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, username: true, tenantId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.tenantSubscription.findMany(),
  ]);

  const superadminsWithModules = superadmins.map(sa => {
    const sub = subscriptions.find(s => s.tenantId === sa.tenantId);
    return {
      ...sa,
      modules: normalizeModuleList(sub?.enabledModules),
    };
  });

  const branchesWithModules = branches.map(b => {
    const owner = superadminsWithModules.find(sa => sa.id === b.superadminId);
    return {
      ...b,
      enabledModules: normalizeModuleList(b.enabledModules).length > 0 
        ? b.enabledModules 
        : (owner?.modules || [])
    };
  });

  return <BranchesClient branches={branchesWithModules} superadmins={superadminsWithModules} />;
}
