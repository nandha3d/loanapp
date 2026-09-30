import prisma from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';

// Web counterpart of GET /api/v1/dashboard/activities (the mobile "Recent
// Activities" date filter). Same queries, caps and item shapes, but scoped with
// the web resolvers the caller passes in (getDefaultTenantId / getUserAppType /
// getActiveBranchId, SCOPE-6) instead of JWT claims.

export type ActivityFeedScope = {
  tenantId: string;
  appType: string;
  /** Active branch; null = All Branches (SCOPE-3, SCOPE-15). */
  branchId: string | null;
  role: string;
  userId: string;
};

export async function getActivityFeed(scope: ActivityFeedScope, startDate: Date, endDate: Date) {
  const { tenantId, appType, branchId, role, userId } = scope;
  const isAgent = role === 'agent';
  // Agents scope by customer linkage, not by branch (SCOPE-5).
  const agentAccess = isAgent ? buildAgentCustomerAccessWhere({ userId }) : null;
  const branchWhere = branchId ? { branchId } : {};

  const baseLoan: Prisma.LoanWhereInput = {
    tenantId,
    appType,
    ...(isAgent ? { customer: agentAccess as Prisma.CustomerWhereInput } : branchWhere),
  };
  const baseCustomer: Prisma.CustomerWhereInput = {
    tenantId,
    appType,
    ...(isAgent ? (agentAccess as Prisma.CustomerWhereInput) : branchWhere),
  };

  // ApprovalRequest has no branchId (SCOPE-18): scope through the requester.
  const approvalWhere: Prisma.ApprovalRequestWhereInput = {
    tenantId,
    appType,
    OR: [
      { createdAt: { gte: startDate, lt: endDate } },
      { reviewedAt: { gte: startDate, lt: endDate } },
    ],
    ...(isAgent ? { requestedById: userId } : branchId ? { requestedBy: { branchId } } : {}),
  };

  const [collections, instalments, newLoans, newCustomers, closedLoans, approvals] = await Promise.all([
    prisma.collectionEntry.findMany({
      where: { tenantId, submittedAt: { gte: startDate, lt: endDate }, loan: baseLoan },
      select: {
        id: true,
        receivedAmount: true,
        dueAmount: true,
        paymentMode: true,
        submittedAt: true,
        verificationStatus: true,
        customer: {
          select: { id: true, name: true, customerCode: true, phone: true, route: { select: { id: true, name: true } } },
        },
        agent: { select: { id: true, name: true } },
        loan: { select: { id: true, loanCode: true, frequency: true, principal: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 60,
    }),
    prisma.instalment.findMany({
      where: {
        loan: { ...baseLoan, status: { in: ['active', 'overdue'] } },
        dueDate: { gte: startDate, lt: endDate },
        status: { in: ['upcoming', 'missed', 'partial'] },
      },
      select: {
        id: true,
        dueDate: true,
        dueAmount: true,
        receivedAmount: true,
        status: true,
        loan: {
          select: {
            id: true,
            loanCode: true,
            frequency: true,
            status: true,
            customer: {
              select: { id: true, name: true, customerCode: true, phone: true, route: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: 'desc' },
      take: 60,
    }),
    prisma.loan.findMany({
      where: { ...baseLoan, createdAt: { gte: startDate, lt: endDate } },
      select: {
        id: true,
        loanCode: true,
        principal: true,
        frequency: true,
        tenure: true,
        createdAt: true,
        customer: {
          select: { id: true, name: true, customerCode: true, phone: true, route: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.customer.findMany({
      where: { ...baseCustomer, createdAt: { gte: startDate, lt: endDate } },
      select: {
        id: true,
        name: true,
        customerCode: true,
        phone: true,
        createdAt: true,
        route: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.loan.findMany({
      where: { ...baseLoan, closedAt: { gte: startDate, lt: endDate } },
      select: {
        id: true,
        loanCode: true,
        closureType: true,
        closedAt: true,
        customer: { select: { id: true, name: true, customerCode: true } },
      },
      orderBy: { closedAt: 'desc' },
      take: 20,
    }),
    prisma.approvalRequest.findMany({
      where: approvalWhere,
      select: {
        id: true,
        requestType: true,
        entityType: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const outstanding = (i: { dueAmount: unknown; receivedAmount: unknown }) =>
    Math.max(0, Number(i.dueAmount) - Number(i.receivedAmount || 0));

  return {
    paidItems: collections.map((e) => ({
      id: e.id,
      type: 'paid' as const,
      receivedAmount: Number(e.receivedAmount),
      dueAmount: Number(e.dueAmount || 0),
      paymentMode: e.paymentMode || 'cash',
      submittedAt: e.submittedAt,
      verificationStatus: e.verificationStatus || 'verified',
      customer: {
        id: e.customer?.id || '',
        name: e.customer?.name || '',
        customerCode: e.customer?.customerCode || '—',
        phone: e.customer?.phone || null,
        route: e.customer?.route ? { id: e.customer.route.id, name: e.customer.route.name } : null,
      },
      loan: {
        id: e.loan?.id || '',
        loanCode: e.loan?.loanCode || '—',
        frequency: e.loan?.frequency || 'daily',
        principal: Number(e.loan?.principal || 0),
      },
      agent: e.agent ? { id: e.agent.id, name: e.agent.name } : null,
    })),
    pendingItems: instalments
      .filter((inst) => outstanding(inst) > 0 && inst.loan?.status !== 'closed')
      .map((inst) => ({
        id: inst.id,
        type: 'pending' as const,
        dueAmount: Number(inst.dueAmount),
        receivedAmount: Number(inst.receivedAmount || 0),
        remainingAmount: outstanding(inst),
        dueDate: inst.dueDate,
        status: (inst.status === 'upcoming' ? 'pending' : inst.status) as 'pending' | 'partial' | 'missed',
        customer: {
          id: inst.loan?.customer?.id ?? '',
          name: inst.loan?.customer?.name ?? '',
          customerCode: inst.loan?.customer?.customerCode ?? '—',
          phone: inst.loan?.customer?.phone ?? null,
          route: inst.loan?.customer?.route
            ? { id: inst.loan.customer.route.id, name: inst.loan.customer.route.name }
            : null,
        },
        loan: {
          id: inst.loan?.id ?? '',
          loanCode: inst.loan?.loanCode ?? '—',
          frequency: inst.loan?.frequency ?? null,
        },
      })),
    newLoanItems: newLoans.map((l) => ({
      id: l.id,
      type: 'new_loan' as const,
      loanCode: l.loanCode,
      principal: Number(l.principal),
      frequency: l.frequency,
      tenure: l.tenure,
      createdAt: l.createdAt,
      customer: {
        id: l.customer?.id || '',
        name: l.customer?.name || '',
        customerCode: l.customer?.customerCode || '—',
        phone: l.customer?.phone || null,
        route: l.customer?.route ? { id: l.customer.route.id, name: l.customer.route.name } : null,
      },
      createdBy: l.createdBy ? { id: l.createdBy.id, name: l.createdBy.name } : null,
    })),
    newCustomerItems: newCustomers.map((c) => ({
      id: c.id,
      type: 'new_customer' as const,
      id_cust: c.id,
      name: c.name,
      customerCode: c.customerCode,
      phone: c.phone || null,
      createdAt: c.createdAt,
      route: c.route ? { id: c.route.id, name: c.route.name } : null,
    })),
    otherItems: [
      ...closedLoans.map((l) => ({
        id: `close-${l.id}`,
        type: 'closed_loan' as const,
        title: l.loanCode,
        description: [l.customer?.name, l.customer?.customerCode, l.closureType].filter(Boolean).join(' • '),
        timestamp: l.closedAt as Date,
        customerCode: l.customer?.customerCode ?? null,
        loanCode: l.loanCode,
      })),
      ...approvals.map((a) => ({
        id: `appr-${a.id}`,
        type: 'approval' as const,
        title: `${(a.requestType || '').replace(/_/g, ' ')} (${a.entityType})`,
        description: [a.status, a.requestedBy?.name, a.reviewedBy?.name].filter(Boolean).join(' • '),
        timestamp: (a.reviewedAt || a.createdAt) as Date,
        status: a.status,
      })),
    ],
  };
}
