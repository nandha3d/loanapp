import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { recordCollection } from '@/lib/collectionWrite';

/**
 * POST /api/v1/collection/proof/qr  (agent)
 * Agent scans the client's single-use daily QR. The token carries the
 * client-entered amount + instalment, so a valid scan AUTO-APPROVES: a verified
 * CollectionEntry is created immediately and the token is consumed.
 * Body: { token }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const token = String(body.token || '').trim();
    if (!token) return fail('token is required', 400);

    const tok = await prisma.clientPaymentToken.findUnique({ where: { token } });
    if (!tok || tok.tenantId !== ctx.tenantId) return fail('Invalid QR code', 404);
    if (tok.status !== 'active') return fail('This QR code has already been used', 409);
    if (tok.expiresAt.getTime() < Date.now()) {
      await prisma.clientPaymentToken.update({ where: { id: tok.id }, data: { status: 'expired' } });
      return fail('This QR code has expired', 410);
    }

    const instalment = await prisma.instalment.findUnique({
      where: { id: tok.instalmentId },
      include: { loan: { include: { customer: true } } },
    });
    if (!instalment || instalment.loan.tenantId !== ctx.tenantId) {
      return fail('Instalment not found', 404);
    }

    if (ctx.role === 'agent') {
      const routeIds = await getAgentRouteIds(ctx.userId);
      const cRoute = instalment.loan.customer.routeId;
      if (!cRoute || !routeIds.includes(cRoute)) return fail('Forbidden', 403);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the tx to prevent double-spend on concurrent scans.
      const locked = await tx.clientPaymentToken.findUnique({ where: { id: tok.id }, select: { status: true } });
      if (!locked || locked.status !== 'active') throw new Error('used: QR already consumed');

      const rec = await recordCollection(tx, {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        agentId: ctx.userId,
        instalment: instalment as any,
        amount: Number(tok.amount),
        paymentMode: 'qr',
        idempotencyKey: `qr:${token}`,
        verificationStatus: 'verified',
        remarks: 'QR payment (client-approved)',
      });

      await tx.clientPaymentToken.update({
        where: { id: tok.id },
        data: { status: 'used', usedAt: new Date(), collectionEntryId: rec.entryId },
      });
      return rec;
    });

    const customerUserId = instalment.loan.customer.userId;
    if (customerUserId) {
      await prisma.systemNotification
        .create({
          data: {
            tenantId: ctx.tenantId,
            branchId: instalment.loan.branchId,
            appType: ctx.appType,
            targetUserId: customerUserId,
            type: 'payment_confirmed',
            icon: 'check_circle',
            title: 'Payment confirmed',
            message: `₹${result.applied} received for loan ${instalment.loan.loanCode}.`,
            link: '/borrower/dashboard',
          },
        })
        .catch(() => {});
    }

    return ok({ entryId: result.entryId, applied: result.applied, status: 'verified' });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/used|already/i.test(msg)) return fail('This QR code has already been used', 409);
    return fail(msg || 'QR payment failed', 500);
  }
}
