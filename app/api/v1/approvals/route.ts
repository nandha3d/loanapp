import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { branchOrUnassignedWhere } from '@/lib/branchScope';
import { modulePath } from '@/types/modules';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;

  // Mirrors the web Approvals page: branch admins see their branch plus any
  // record that landed without a branch (reviewable by anyone in the tenant).
  // Superadmin/developer stay tenant-wide.
  const scopeBranchId =
    ctx.role === 'superadmin' || ctx.role === 'developer' ? null : ctx.branchId;
  const branchScope = branchOrUnassignedWhere(scopeBranchId);

  const where: any = { tenantId: ctx.tenantId, appType: ctx.appType };
  if (status) where.status = status;
  if (ctx.role === 'agent') {
    where.requestedById = ctx.userId;
  } else if (scopeBranchId) {
    where.requestedBy = branchScope;
  }

  try {
    // 1. Fetch general approval requests
    const approvals = await prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedList = [...approvals];

    // 2. Fetch pending customers and loans for admins if listing pending
    if (ctx.role !== 'agent' && (!status || status === 'pending')) {
      const branchWhere = branchScope;

      const pendingCustomers = await prisma.customer.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          status: 'pending_review',
          ...branchWhere,
        },
        include: {
          agent: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const cust of pendingCustomers) {
        mappedList.push({
          id: cust.id,
          tenantId: cust.tenantId,
          appType: cust.appType,
          requestType: 'create',
          entityType: 'customer',
          entityId: cust.id,
          requestedById: cust.agentId || '',
          requestedChanges: JSON.stringify({
            name: cust.name,
            phone: cust.phone,
            address: cust.address,
            email: cust.email || 'None',
            pan: cust.pan || 'None',
          }),
          reason: 'New Customer Registration',
          status: 'pending',
          createdAt: cust.createdAt,
          updatedAt: cust.createdAt,
          reviewedById: null,
          reviewedAt: null,
          reviewNotes: null,
          requestedBy: cust.agent || { id: cust.agentId || '', name: 'Agent', role: 'agent' },
          reviewedBy: null,
        } as any);
      }

      const pendingLoans = await prisma.loan.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          status: 'pending_review',
          ...branchWhere,
        },
        include: {
          customer: { select: { name: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const loan of pendingLoans) {
        mappedList.push({
          id: loan.id,
          tenantId: loan.tenantId,
          appType: loan.appType,
          requestType: 'create',
          entityType: 'loan',
          entityId: loan.id,
          requestedById: loan.createdById || '',
          requestedChanges: JSON.stringify({
            loanCode: loan.loanCode,
            customer: loan.customer?.name || 'Unknown',
            principal: Number(loan.principal),
            tenure: loan.tenure,
            frequency: loan.frequency,
            disbursed: Number(loan.disbursed),
            totalPayable: Number(loan.totalPayable),
            perInstalment: Number(loan.perInstalment),
          }),
          reason: 'New Loan Application',
          status: 'pending',
          createdAt: loan.createdAt,
          updatedAt: loan.createdAt,
          reviewedById: null,
          reviewedAt: null,
          reviewNotes: null,
          requestedBy: loan.createdBy || { id: loan.createdById || '', name: 'Agent', role: 'agent' },
          reviewedBy: null,
        } as any);
      }
    }

    // Sort combined list by createdAt descending
    mappedList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return ok(mappedList);
  } catch (e: any) {
    return fail(e?.message ?? 'Approvals failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json();
    const { requestType, entityType, entityId, requestedChanges, reason } = body;

    if (!requestType || !entityType || !entityId) {
      return fail('requestType, entityType, and entityId are required', 400);
    }

    const request = await prisma.approvalRequest.create({
      data: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        requestType,
        entityType,
        entityId,
        requestedById: ctx.userId,
        requestedChanges: typeof requestedChanges === 'string' ? requestedChanges : JSON.stringify(requestedChanges),
        reason: reason || '',
        status: 'pending',
      },
    });

    if (entityType === 'customer') {
      const customer = await prisma.customer.findFirst({ where: { id: entityId, tenantId: ctx.tenantId } });
      if (customer) {
        // Branch admins + tenant superadmins, one per-user row each (own read
        // state) plus a push — not a single shared admin row.
        const { notifyApprovers } = await import('@/lib/notify/approvers');
        await notifyApprovers({
          tenantId: ctx.tenantId,
          branchId: customer.branchId,
          appType: ctx.appType,
          type: 'customer_edit_review',
          icon: 'verified',
          title: 'Customer edit pending review',
          message: `Agent requested edits for customer ${customer.name}.`,
          link: modulePath(ctx.appType, '/approvals'),
        });
      }
    }

    return ok(request);
  } catch (e: any) {
    console.error('[/api/v1/approvals POST]', e);
    return fail(e?.message ?? 'Approval request creation failed', 500);
  }
}
