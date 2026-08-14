import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { branchScopeWhere } from '@/lib/branchScope';
import { modulePath } from '@/types/modules';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;

  // Mirrors the web Approvals page: branch admins see only their own branch.
  // Superadmin/developer stay tenant-wide.
  const scopeBranchId =
    ctx.role === 'superadmin' || ctx.role === 'developer' ? null : ctx.branchId;
  const branchScope = branchScopeWhere(scopeBranchId);

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
      const pendingCustomers = await prisma.customer.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          status: 'pending_review',
          // Own branch only — a record takes the branch of its ROUTE, and only
          // that branch's admin may review it.
          ...branchScope,
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
          ...branchScope,
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

/**
 * The record's own branch plus a human label for it, resolved per entity type.
 *
 * An entity type we don't recognise still resolves — to a null branch — so the
 * approval is announced on the filing agent's branch alone rather than not at
 * all (NOTIF-6: an approval that reaches no admin is worse than one that
 * reaches too many). Never throws; a failed lookup degrades to no branch.
 */
async function resolveApprovalTarget(
  tenantId: string,
  entityType: string,
  entityId: string,
): Promise<{ branchId: string | null; label: string | null }> {
  try {
    switch (entityType) {
      case 'customer': {
        const customer = await prisma.customer.findFirst({
          where: { id: entityId, tenantId },
          select: { branchId: true, name: true },
        });
        return { branchId: customer?.branchId ?? null, label: customer?.name ?? null };
      }
      case 'loan': {
        const loan = await prisma.loan.findFirst({
          where: { id: entityId, tenantId },
          select: { branchId: true, loanCode: true, customer: { select: { name: true } } },
        });
        if (!loan) return { branchId: null, label: null };
        return {
          branchId: loan.branchId,
          label: loan.customer?.name ? `${loan.loanCode} (${loan.customer.name})` : loan.loanCode,
        };
      }
      case 'instalment': {
        // Instalments carry no branch of their own — they inherit the loan's.
        const instalment = await prisma.instalment.findFirst({
          where: { id: entityId, loan: { tenantId } },
          select: {
            instalmentNo: true,
            loan: { select: { branchId: true, loanCode: true, customer: { select: { name: true } } } },
          },
        });
        if (!instalment?.loan) return { branchId: null, label: null };
        const who = instalment.loan.customer?.name ? ` · ${instalment.loan.customer.name}` : '';
        return {
          branchId: instalment.loan.branchId,
          label: `${instalment.loan.loanCode} #${instalment.instalmentNo}${who}`,
        };
      }
      case 'vehicle': {
        // Vehicles have no branch column; they follow their customer's.
        const vehicle = await prisma.vehicle.findFirst({
          where: { id: entityId, tenantId },
          select: { registrationNo: true, customer: { select: { branchId: true, name: true } } },
        });
        if (!vehicle) return { branchId: null, label: null };
        return {
          branchId: vehicle.customer?.branchId ?? null,
          label: vehicle.customer?.name
            ? `${vehicle.registrationNo} (${vehicle.customer.name})`
            : vehicle.registrationNo,
        };
      }
      case 'collection_run': {
        // `routeId` is a plain column here, not a relation — resolve the name
        // with a second read rather than an include.
        const run = await prisma.collectionRun.findFirst({
          where: { id: entityId, tenantId },
          select: { branchId: true, routeId: true },
        });
        if (!run) return { branchId: null, label: null };
        const route = run.routeId
          ? await prisma.route.findFirst({ where: { id: run.routeId }, select: { name: true } })
          : null;
        return { branchId: run.branchId, label: route?.name ?? null };
      }
      default:
        return { branchId: null, label: null };
    }
  } catch (e) {
    console.error('[/api/v1/approvals POST] target resolution failed', e);
    return { branchId: null, label: null };
  }
}

/** Per-request-type wording. Anything unlisted falls back to a generic phrasing. */
const APPROVAL_NOTICE: Record<string, { type: string; icon: string; title: string; verb: string }> = {
  customer_edit: {
    type: 'customer_edit_review',
    icon: 'verified',
    title: 'Customer edit pending review',
    verb: 'requested edits for customer',
  },
  loan_edit: {
    type: 'loan_edit_review',
    icon: 'request_quote',
    title: 'Loan edit pending review',
    verb: 'requested edits for loan',
  },
  edit_collection: {
    type: 'collection_edit_review',
    icon: 'edit_note',
    title: 'Collection edit pending review',
    verb: 'requested a collection amount change for',
  },
};

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

    // EVERY request filed here is announced, whatever it is about. Gating this
    // on one entity type left collection and loan edit requests sitting in the
    // queue with nobody told they existed (NOTIF-6).
    const target = await resolveApprovalTarget(ctx.tenantId, entityType, entityId);
    const notice = APPROVAL_NOTICE[requestType] ?? {
      type: 'approval_pending',
      icon: 'rate_review',
      title: 'Approval request pending review',
      verb: `filed a ${String(requestType).replace(/_/g, ' ')} request for`,
    };
    const label = target.label ?? String(entityType).replace(/_/g, ' ');

    // Branch admins + tenant superadmins, one per-user row each (own read
    // state) plus a push — not a single shared admin row.
    const { notifyApprovers } = await import('@/lib/notify/approvers');
    await notifyApprovers({
      tenantId: ctx.tenantId,
      branchId: target.branchId,
      requesterBranchId: ctx.branchId,
      appType: ctx.appType,
      type: notice.type,
      icon: notice.icon,
      title: notice.title,
      message: `Agent ${notice.verb} ${label}.`,
      link: modulePath(ctx.appType, '/approvals'),
    });

    return ok(request);
  } catch (e: any) {
    console.error('[/api/v1/approvals POST]', e);
    return fail(e?.message ?? 'Approval request creation failed', 500);
  }
}
