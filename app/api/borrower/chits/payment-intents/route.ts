import { NextResponse } from 'next/server';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { createChitPaymentIntent, listMyChitPaymentIntents } from '@/lib/chits/paymentIntents';

export async function GET() {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const intents = await listMyChitPaymentIntents(session.customerId, session.tenantId);
  return NextResponse.json({ intents });
}

export async function POST(req: Request) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkRateLimit(routeKey('borrower-chit-payment-intent', getClientIp(req)), { limit: 15, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many submissions — try again shortly' }, { status: 429 });

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

    if (!subscriptionId || !proofUrl) {
      return NextResponse.json({ error: 'subscriptionId and proofUrl are required' }, { status: 400 });
    }
    if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const intent = await createChitPaymentIntent({
      tenantId: session.tenantId,
      customerId: session.customerId,
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
    return NextResponse.json({ id: intent.id, status: intent.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Submission failed' }, { status: 400 });
  }
}
