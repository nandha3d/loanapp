import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const note = body.note ? String(body.note) : null;

    // A. Check if this is a general approval request
    const request = await prisma.approvalRequest.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending' },
    });

    if (request) {
      const updated = await prisma.approvalRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedById: ctx.userId,
          reviewNotes: note,
          reviewedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'rejected',
          entityType: request.entityType,
          entityId: request.entityId,
          newValue: JSON.stringify({ requestId: id, note }),
        },
      });

      return ok(updated);
    }

    // B. Check if this is a pending customer creation
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending_review' },
    });

    if (customer) {
      await prisma.customer.update({
        where: { id },
        data: { status: 'rejected' },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'reject',
          entityType: 'customer',
          entityId: id,
          newValue: JSON.stringify({ action: 'reject_creation', status: 'rejected', note }),
        },
      });

      if (customer.agentId) {
        await prisma.systemNotification.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: customer.branchId,
            appType: ctx.appType,
            targetUserId: customer.agentId,
            targetRole: 'agent',
            type: 'customer_rejected',
            icon: 'cancel',
            title: 'Customer rejected',
            message: `Your customer ${customer.name} was not approved.${note ? ` Note: ${note}` : ''}`,
            link: '/customers',
          },
        }).catch(() => {});
      }

      return ok({ status: 'rejected' });
    }

    // C. Check if this is a pending loan request
    const loan = await prisma.loan.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending_review' },
    });

    if (loan) {
      await prisma.loan.update({
        where: { id },
        data: { status: 'rejected' },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'reject',
          entityType: 'loan',
          entityId: id,
          newValue: JSON.stringify({ action: 'reject_creation', status: 'rejected', note }),
        },
      });

      if (loan.createdById) {
        await prisma.systemNotification.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: loan.branchId,
            appType: ctx.appType,
            targetUserId: loan.createdById,
            targetRole: 'agent',
            type: 'loan_rejected',
            icon: 'cancel',
            title: 'Loan rejected',
            message: `Loan ${loan.loanCode} has been rejected.${note ? ` Note: ${note}` : ''}`,
            link: '/loans',
          },
        }).catch(() => {});
      }

      return ok({ status: 'rejected' });
    }

    return fail('Approval target not found or already processed', 404);
  } catch (e: any) {
    return fail(e?.message ?? 'Review failed', 500);
  }
}
