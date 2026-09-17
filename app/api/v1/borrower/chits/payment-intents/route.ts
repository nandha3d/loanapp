import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { createChitPaymentIntent, listMyChitPaymentIntents } from '@/lib/chits/paymentIntents';

export async function GET(req: NextRequest) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);

  const intents = await listMyChitPaymentIntents(borrower.customerId, borrower.tenantId);
  return ok({ intents });
}

export async function POST(req: NextRequest) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);

  const rl = await checkRateLimit(routeKey('borrower-mobile-chit-payment-intent', getClientIp(req)), { limit: 15, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return fail('Too many submissions — try again shortly', 429);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const subscriptionId = String(body.subscriptionId || '');
    const paymentMode = String(body.paymentMode || 'upi');
    const referenceNo = body.referenceNo ? String(body.referenceNo) : null;
    const amount = body.amount != null && body.amount !== '' ? Number(body.amount) : null;
    const proofUrl = String(body.proofUrl || '');
    const proofFileName = String(body.proofFileName || 'proof');
    const proofMimeType = body.proofMimeType ? String(body.proofMimeType) : null;
    const proofSizeBytes = body.proofSizeBytes != null ? Number(body.proofSizeBytes) : null;

    if (!subscriptionId || !proofUrl) return fail('subscriptionId and proofUrl are required', 400);
    if (amount != null && (!Number.isFinite(amount) || amount <= 0)) return fail('amount must be a positive number', 400);

    const intent = await createChitPaymentIntent({
      tenantId: borrower.tenantId,
      customerId: borrower.customerId,
      subscriptionId,
      amount,
      paymentMode,
      referenceNo,
      proofUrl,
      proofFileName,
      proofMimeType,
      proofSizeBytes,
      source: 'portal',
    });
    return ok({ id: intent.id, status: intent.status });
  } catch (e: any) {
    return fail(e?.message ?? 'Submission failed', 400);
  }
}
