import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import UsersClient from './UsersClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminUsersPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole !== 'superadmin' && userRole !== 'developer') {
    redirect('/dashboard');
  }

  const tenantId = await getDefaultTenantId();

  // Developer accounts are only visible to other developers
  const userWhere: any = { tenantId };
  if (userRole !== 'developer') {
    userWhere.role = { not: 'developer' };
  }

  const [users, branches] = await Promise.all([
    prisma.user.findMany({ 
      where: userWhere,
      include: { branch: true },
      orderBy: { name: 'asc' }
    }),
    prisma.branch.findMany({ where: { tenantId, status: 'active' } })
  ]);

  return <UsersClient users={users} branches={branches} viewerRole={userRole} />;
}
