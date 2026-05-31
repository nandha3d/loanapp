import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';

/**
 * POST /api/v1/collection/proof/photo  (agent)
 * Files a PHOTO-proof payment that requires CLIENT approval. The loan is NOT
 * touched until the client approves in the borrower portal.
 * Body: { instalmentId, amount, paymentMode?, photoUrl? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const instalmentId = String(body.instalmentId || '');
    const amount = Number(body.amount);
    const paymentMode = String(body.paymentMode || 'cash');
    const photoUrl = body.photoUrl ? String(body.photoUrl) : null;
    if (!instalmentId || !Number.isFinite(amount) || amount <= 0) {
      return fail('instalmentId and a positive amount are required', 400);
    }

    const instalment = await prisma.instalment.findUnique({
      where: { id: instalmentId },
      include: { loan: { include: { customer: true } } },
    });
    if (!instalment || instalment.loan.tenantId !== ctx.tenantId || instalment.loan.appType !== ctx.appType) {
      return fail('Instalment not found', 404);
    }

    if (ctx.role === 'agent') {
      const routeIds = await getAgentRouteIds(ctx.userId);
      const cRoute = instalment.loan.customer.routeId;
      if (!cRoute || !routeIds.includes(cRoute)) return fail('Forbidden', 403);
    }

    const approval = await prisma.paymentApproval.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: instalment.loan.branchId,
        loanId: instalment.loanId,
        instalmentId: instalment.id,
        customerId: instalment.loan.customerId,
        agentId: ctx.userId,
        amount,
        paymentMode,
        proofType: 'photo',
        photoPath: photoUrl,
        status: 'pending',
      },
    });

    // Notify the client in the borrower portal (badge). SMS optional later.
    const customerUserId = instalment.loan.customer.userId;
    if (customerUserId) {
      await prisma.systemNotification
        .create({
          data: {
            tenantId: ctx.tenantId,
            branchId: instalment.loan.branchId,
            appType: ctx.appType,
            targetUserId: customerUserId,
            type: 'payment_approval',
            icon: 'photo_camera',
            title: 'Approve your payment',
            message: `Agent recorded ₹${amount} for loan ${instalment.loan.loanCode}. Please approve.`,
            link: '/borrower/dashboard',
          },
        })
        .catch(() => {});
    }

    return ok({ id: approval.id, status: approval.status });
  } catch (e: any) {
    return fail(e?.message ?? 'Photo proof failed', 500);
  }
}
