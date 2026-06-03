import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { notify } from '@/lib/notify/events';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role === 'agent') {
    return fail('Unauthorized', 403);
  }

  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const markChequesReturned = !!body.markChequesReturned;

  const loan = await prisma.loan.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
    },
    include: { customer: { include: { securityCheques: true } } },
  });

  if (!loan) {
    return fail('Loan not found', 404);
  }

  // Full-settlement validation
  const instalments = await prisma.instalment.findMany({
    where: { loanId: id }
  });
  const unpaidInstalments = instalments.some(i => !['paid', 'waived'].includes(i.status));
  if (unpaidInstalments) {
    return fail('Cannot close loan with unpaid or upcoming instalments', 400);
  }

  const pendingPenalties = await prisma.penalty.findMany({
    where: { loanId: id, status: { in: ['pending', 'partial'] } }
  });
  if (pendingPenalties.length > 0) {
    return fail('Cannot close loan with outstanding penalties', 400);
  }

  const pendingApprovals = await prisma.approvalRequest.findMany({
    where: { entityId: id, entityType: 'loan', status: 'pending' }
  });
  if (pendingApprovals.length > 0) {
    return fail('Cannot close loan with pending approval requests', 400);
  }

  await prisma.loan.update({
    where: { id },
    data: {
      status: 'closed',
      closedAt: new Date(),
    },
  });

  notify({
    tenantId: ctx.tenantId,
    event: 'loan_closed',
    phone: loan.customer.phone,
    email: loan.customer.email ?? undefined,
    data: {
      name: loan.customer.name,
      loanCode: loan.loanCode,
    },
    meta: { entityType: 'loan', entityId: id },
  }).catch((err) => console.error('Failed to send loan closed notification', err));

  // Mark active security cheques as returned if confirmed
  if (markChequesReturned && loan.customer?.securityCheques?.length) {
    const activeChequeIds = loan.customer.securityCheques
      .filter((c) => c.status === 'active')
      .map((c) => c.id);
    if (activeChequeIds.length > 0) {
      await prisma.securityCheque.updateMany({
        where: { id: { in: activeChequeIds } },
        data: { status: 'returned' },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'loan',
      entityId: id,
      newValue: JSON.stringify({ action: 'close', closedAt: new Date().toISOString(), chequesReturned: markChequesReturned }),
    },
  });

  return ok({ success: true });
}
