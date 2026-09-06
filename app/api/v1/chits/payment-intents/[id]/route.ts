import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { canCollectChits } from '@/lib/chits/access';
import { approveChitPaymentIntent, rejectChitPaymentIntent } from '@/lib/chits/paymentIntents';

// Approve/reject a customer payment-proof claim. Approval posts through the
// single authoritative collectChitSubscriptionPayment path with idempotency
// key `chit-intent:<id>` — a double-tap can never post twice.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!canCollectChits(ctx.role)) return fail('Forbidden', 403);
  const { id } = await params;

  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string; confirmedAmount?: number; rejectionReason?: string;
    } | null;
    const action = body?.action;

    if (action === 'approve') {
      const confirmedAmount = Number(body?.confirmedAmount);
      if (!Number.isFinite(confirmedAmount) || confirmedAmount <= 0) {
        return fail('confirmedAmount must be a positive number', 400);
      }
      const intent = await prisma.chitPaymentIntent.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { memberId: true },
      });
      if (!intent) return fail('Payment intent not found', 404);
      const member = await prisma.chitMember.findUnique({
        where: { id: intent.memberId },
        select: { chitGroup: { select: { branch: { select: { code: true } } } } },
      });

      const result = await approveChitPaymentIntent({
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        branchCode: member?.chitGroup.branch?.code,
        intentId: id,
        confirmedAmount,
        reviewerId: ctx.userId,
      });
      return ok({ receiptNo: result.receiptNo });
    }

    if (action === 'reject') {
      const reason = body?.rejectionReason?.trim();
      if (!reason) return fail('rejectionReason is required', 400);
      await rejectChitPaymentIntent({
        tenantId: ctx.tenantId,
        intentId: id,
        reason,
        reviewerId: ctx.userId,
      });
      return ok({ status: 'rejected' });
    }

    return fail('action must be approve or reject', 400);
  } catch (e: any) {
    return fail(e?.message ?? 'Review failed', 400);
  }
}
