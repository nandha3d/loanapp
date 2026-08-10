import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import ApprovalsClient from './ApprovalsClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';
import { branchScopeWhere } from '@/lib/branchScope';

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
  
  // Branch scope shared by every query below so the list, the tabs and the
  // sidebar badge always agree — and so an admin can only approve records that
  // belong to their own branch.
  const branchScope = branchScopeWhere(activeBranchId);

  const where: any = { tenantId, appType };
  if (userRole === 'agent') {
    where.requestedById = userId;
  } else if (activeBranchId) {
    where.requestedBy = branchScope;
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
  let pendingCustomers: any[] = [];
  let pendingVehicles: any[] = [];
  if (userRole !== 'agent') {
    // Own branch only. A loan/customer takes the branch of its ROUTE, which can
    // differ from the filing agent's — the record still belongs to that branch,
    // and only that branch's admin may approve it.
    const loanWhere: any = {
      tenantId,
      appType,
      status: 'pending_review',
      ...branchScope,
    };
    pendingLoans = await prisma.loan.findMany({
      where: loanWhere,
      include: {
        customer: { select: { name: true, customerCode: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const customerWhere: any = {
      tenantId,
      appType,
      status: 'pending_review',
      ...branchScope,
    };
    pendingCustomers = await prisma.customer.findMany({
      where: customerWhere,
      include: {
        agent: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Vehicles only exist in autofinance. Scope by the customer's branch (vehicles
    // have no branch column of their own).
    if (appType === 'autofinance') {
      const vehicleWhere: any = { tenantId, appType, status: 'pending_review', deletedAt: null };
      if (activeBranchId) vehicleWhere.customer = branchScope;
      pendingVehicles = await prisma.vehicle.findMany({
        where: vehicleWhere,
        include: {
          customer: { select: { name: true, customerCode: true, agent: { select: { name: true } } } },
          loan: { select: { loanCode: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  return (
    <ApprovalsClient
      requests={requests}
      pendingLoans={pendingLoans}
      pendingCustomers={pendingCustomers}
      pendingVehicles={pendingVehicles}
      userRole={userRole}
      dict={dict}
    />
  );
}
