import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import BranchesClient from './BranchesClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminBranchesPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole !== 'developer') {
    redirect('/portal');
  }

  const tenantId = await getDefaultTenantId();
  
  const branches = await prisma.branch.findMany({ 
    where: { tenantId },
    include: {
      _count: { select: { users: true, routes: true } }
    },
    orderBy: { name: 'asc' }
  });

  return <BranchesClient branches={branches} />;
}
