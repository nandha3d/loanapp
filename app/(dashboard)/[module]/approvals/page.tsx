import { LOAN_PRECLOSE_REQUEST } from '@/lib/loanPreclosePolicy';
import { precloseApprovalVisibility } from '@/lib/loanPrecloseRequests';
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
    if (appType !== 'microlending') where.requestedBy = branchScope;
    else where.OR = [
      { requestType: { not: LOAN_PRECLOSE_REQUEST }, requestedBy: branchScope },
      await precloseApprovalVisibility(tenantId, appType, activeBranchId),
    ];
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
    const rawLoans = await prisma.loan.findMany({
      where: loanWhere,
      include: {
        customer: { select: { name: true, customerCode: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const agentUserIds = Array.from(new Set(
      rawLoans
        .filter((l: any) => l.createdBy?.role === 'agent' && l.createdById)
        .map((l: any) => l.createdById!)
    ));
    const agentAccounts = agentUserIds.length > 0
      ? await prisma.agentAccount.findMany({
          where: { tenantId, appType, agentId: { in: agentUserIds } },
          select: { agentId: true, balance: true },
        })
      : [];
    const floatMap = new Map<string, number>();
    for (const acc of agentAccounts) {
      floatMap.set(acc.agentId, Number(acc.balance ?? 0));
    }

    pendingLoans = rawLoans.map((l: any) => {
      const isAgent = l.createdBy?.role === 'agent';
      const agentFloat = isAgent && l.createdById ? (floatMap.get(l.createdById) ?? 0) : null;
      const requiredAmount = Number(l.disbursed ?? l.principal ?? 0);
      const insufficientFloat = agentFloat !== null && agentFloat < requiredAmount;
      const floatDeficit = insufficientFloat ? requiredAmount - agentFloat : 0;
      return {
        ...l,
        principal: Number(l.principal),
        disbursed: Number(l.disbursed),
        agentFloatBalance: agentFloat,
        insufficientFloat,
        floatDeficit,
      };
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
      appType={appType}
    />
  );
}
