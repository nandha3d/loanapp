import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import ApprovalsClient from './ApprovalsClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ApprovalsPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;
  
  if (!userRole) {
    redirect('/login');
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  
  const where: any = { tenantId, appType };
  if (userRole === 'agent') {
    where.requestedById = userId;
  }

  const requests = await prisma.approvalRequest.findMany({ 
    where,
    include: {
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return <ApprovalsClient requests={requests} userRole={userRole} />;
}
