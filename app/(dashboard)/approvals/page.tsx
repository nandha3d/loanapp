import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import ApprovalsClient from './ApprovalsClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';

export default async function ApprovalsPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;
  
  if (!userRole) {
    redirect('/login');
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const activeBranchId = await getActiveBranchId();
  
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

  // Fetch pending_review loans for admin/superadmin/developer
  let pendingLoans: any[] = [];
  if (userRole !== 'agent') {
    const loanWhere: any = { tenantId, appType, status: 'pending_review' };
    if (activeBranchId) loanWhere.branchId = activeBranchId;
    pendingLoans = await prisma.loan.findMany({
      where: loanWhere,
      include: {
        customer: { select: { name: true, customerCode: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return <ApprovalsClient requests={requests} pendingLoans={pendingLoans} userRole={userRole} dict={dict} />;
}
