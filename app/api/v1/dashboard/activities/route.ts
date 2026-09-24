import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const IST_OFFSET_MS = 330 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightUtcMs =
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) -
    IST_OFFSET_MS;

  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');

  let startDate: Date;
  let endDate: Date;

  if (fromParam && toParam) {
    startDate = new Date(fromParam);
    endDate = new Date(toParam);
  } else {
    startDate = new Date(istMidnightUtcMs);
    endDate = new Date(istMidnightUtcMs + 24 * 60 * 60 * 1000);
  }

  const isAgent = ctx.role === 'agent';
  const agentAccess = isAgent ? buildAgentCustomerAccessWhere({ userId: ctx.userId }) : null;

  const baseLoan: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...(isAgent ? { customer: agentAccess } : scopedBranchWhere(ctx)),
  };
  const baseCustomer: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...(isAgent ? agentAccess : scopedBranchWhere(ctx)),
  };

  try {
    const approvalWhere: Prisma.ApprovalRequestWhereInput = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      OR: [
        { createdAt: { gte: startDate, lte: endDate } },
        { reviewedAt: { gte: startDate, lte: endDate } },
      ],
    };
    if (isAgent) {
      approvalWhere.requestedById = ctx.userId;
    } else if (ctx.branchId) {
      approvalWhere.requestedBy = { branchId: ctx.branchId };
    }

    const [
      activityCollections,
      activityInstalments,
      activityNewLoans,
      activityNewCustomers,
      activityClosedLoans,
      activityApprovals,
    ] = await Promise.all([
      // Paid collection entries
      prisma.collectionEntry.findMany({
        where: {
          tenantId: ctx.tenantId,
          submittedAt: { gte: startDate, lte: endDate },
          loan: baseLoan,
        },
        select: {
          id: true,
          receivedAmount: true,
          dueAmount: true,
          paymentMode: true,
          submittedAt: true,
          verificationStatus: true,
          source: true,
          customer: {
            select: {
              id: true,
              name: true,
              customerCode: true,
              profilePhoto: true,
              phone: true,
              route: { select: { id: true, name: true } },
            },
          },
          agent: { select: { id: true, name: true } },
          loan: {
            select: {
              id: true,
              loanCode: true,
              frequency: true,
              principal: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 60,
      }),
      // Pending instalments in date window
      prisma.instalment.findMany({
        where: {
          loan: { ...baseLoan, status: { in: ['active', 'overdue'] } },
          dueDate: { gte: startDate, lte: endDate },
          status: { in: ['upcoming', 'missed', 'partial'] },
        },
        include: {
          loan: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  customerCode: true,
                  profilePhoto: true,
                  phone: true,
                  route: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'desc' },
        take: 60,
      }),
      // New loans in date window
      prisma.loan.findMany({
        where: {
          ...baseLoan,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          loanCode: true,
          principal: true,
          frequency: true,
          tenure: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              customerCode: true,
              phone: true,
              route: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      // New customers in date window
      prisma.customer.findMany({
        where: {
          ...baseCustomer,
          createdAt: { gte: startDate, lte: endDate },
        },
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
      // Closed loans in date window
      prisma.loan.findMany({
        where: {
          ...baseLoan,
          closedAt: { gte: startDate, lte: endDate },
        },
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
      // Approvals in date window
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

    const paidItems = activityCollections.map((e: any) => ({
      id: e.id,
      type: 'paid' as const,
      receivedAmount: Number(e.receivedAmount),
      dueAmount: Number(e.dueAmount || 0),
      paymentMode: e.paymentMode || 'cash',
      submittedAt: e.submittedAt,
      verificationStatus: e.verificationStatus || 'verified',
      customer: {
        id: e.customer?.id || '',
        name: e.customer?.name || 'Customer',
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
    }));

    const outstanding = (item: any) => Math.max(0, Number(item.dueAmount) - Number(item.receivedAmount || 0));

    const pendingItems = activityInstalments
      .filter((inst) => outstanding(inst) > 0 && (inst as any).loan?.status !== 'closed')
      .map((inst) => ({
        id: inst.id,
        type: 'pending' as const,
        dueAmount: Number(inst.dueAmount),
        receivedAmount: Number(inst.receivedAmount || 0),
        remainingAmount: outstanding(inst),
        dueDate: inst.dueDate,
        status: (inst.status === 'upcoming' ? 'pending' : inst.status) as 'pending' | 'partial' | 'missed',
        customer: {
          id: (inst as any).loan?.customer?.id ?? '',
          name: (inst as any).loan?.customer?.name ?? 'Customer',
          customerCode: (inst as any).loan?.customer?.customerCode ?? '—',
          phone: (inst as any).loan?.customer?.phone ?? null,
          route: (inst as any).loan?.customer?.route ? { id: (inst as any).loan.customer.route.id, name: (inst as any).loan.customer.route.name } : null,
        },
        loan: {
          id: (inst as any).loan?.id ?? '',
          loanCode: (inst as any).loan?.loanCode ?? '—',
          frequency: (inst as any).loan?.frequency ?? null,
          perInstalment: Number((inst as any).loan?.perInstalment || 0),
        },
      }));

    const newLoanItems = activityNewLoans.map((l: any) => ({
      id: l.id,
      type: 'new_loan' as const,
      loanCode: l.loanCode,
      principal: Number(l.principal),
      frequency: l.frequency,
      tenure: l.tenure,
      createdAt: l.createdAt,
      customer: {
        id: l.customer?.id || '',
        name: l.customer?.name || 'Customer',
        customerCode: l.customer?.customerCode || '—',
        phone: l.customer?.phone || null,
        route: l.customer?.route ? { id: l.customer.route.id, name: l.customer.route.name } : null,
      },
      createdBy: l.createdBy ? { id: l.createdBy.id, name: l.createdBy.name } : null,
    }));

    const newCustomerItems = activityNewCustomers.map((c: any) => ({
      id: c.id,
      type: 'new_customer' as const,
      id_cust: c.id,
      name: c.name,
      customerCode: c.customerCode,
      phone: c.phone || null,
      createdAt: c.createdAt,
      route: c.route ? { id: c.route.id, name: c.route.name } : null,
    }));

    const otherItems = [
      ...activityClosedLoans.map((l: any) => ({
        id: `close-${l.id}`,
        type: 'closed_loan' as const,
        title: `Loan Closed: ${l.loanCode}`,
        description: `Closure type: ${l.closureType || 'standard'}`,
        timestamp: l.closedAt,
        amount: null,
        customerCode: l.customer?.customerCode,
        loanCode: l.loanCode,
      })),
      ...activityApprovals.map((a: any) => ({
        id: `appr-${a.id}`,
        type: 'approval' as const,
        title: `${(a.requestType || 'request').replace(/_/g, ' ')}: ${a.status}`,
        description: `By ${a.requestedBy?.name || 'User'}${a.reviewedBy ? ` · Reviewed by ${a.reviewedBy.name}` : ''}`,
        timestamp: a.reviewedAt || a.createdAt,
        amount: null,
        customerCode: null,
        loanCode: null,
      })),
    ];

    return ok({
      paidItems,
      pendingItems,
      newLoanItems,
      newCustomerItems,
      otherItems,
    });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message || 'Failed to fetch dashboard activities', 500);
  }
}
