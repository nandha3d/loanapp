import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay';
import { getTenantRazorpayConfig } from '@/lib/tenantRazorpay';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import {
  confirmMandate,
  rejectMandate,
  handlePresentationSuccess,
  handlePresentationFailure,
} from '@/lib/nach';

/**
 * POST /api/webhooks/razorpay/nach
 *
 * Handles Razorpay e-mandate lifecycle events from each tenant's own account:
 *   payment.authorized  → mandate confirmed (token stored, status → active)
 *   payment.failed      → mandate rejected OR recurring charge bounced
 *   payment.captured    → recurring EMI debit succeeded → CollectionEntry created
 *
 * The tenant is resolved from `notes.tenant_id` in the payload, then the
 * signature is verified with THAT tenant's webhook secret.
 */

const HANDLED = new Set([
  'payment.authorized',
  'payment.captured',
  'payment.failed',
]);

type RzpPaymentEntity = {
  id?: string;
  order_id?: string;
  amount?: number;
  recurring?: number;
  recurring_details?: { type?: string; failure_reason?: string };
  token?: { id?: string };
  error_code?: string;
  error_description?: string;
  notes?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(routeKey('webhook:rzp-nach', ip), { limit: 300, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  let payload: { event?: string; payload?: { payment?: { entity?: RzpPaymentEntity } } };
  try { payload = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event;
  if (!event || !HANDLED.has(event)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const entity = payload.payload?.payment?.entity;
  const tenantId = entity?.notes?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: 'Missing tenant_id in notes' }, { status: 400 });

  // Verify signature with tenant's own webhook secret
  const gw = await getTenantRazorpayConfig(tenantId);
  if (!gw.webhookSecret) {
    return NextResponse.json({ error: 'Tenant webhook secret not configured' }, { status: 400 });
  }
  if (!verifyRazorpayWebhookSignature(rawBody, gw.webhookSecret, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  // Idempotency
  const headerId = request.headers.get('x-razorpay-event-id');
  const eventId = `${tenantId}:nach:${headerId ?? `fallback_${event}_${crypto.createHash('sha256').update(rawBody).digest('hex')}`}`;
  const dup = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: 'razorpay', eventId } },
  });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  let result: string = 'unhandled';

  try {
    if (event === 'payment.authorized' && entity?.recurring === 1) {
      const tokenId = entity.token?.id ?? entity.notes?.token_id;
      if (entity.order_id && entity.id && tokenId) {
        const isEmandate = entity.recurring_details?.type === 'emandate'
          || Boolean(entity.notes?.loan_id); // fallback heuristic

        if (isEmandate) {
          await confirmMandate({
            razorpayOrderId: entity.order_id,
            razorpayPaymentId: entity.id,
            razorpayTokenId: tokenId,
          });
          result = 'mandate_confirmed';
        }
      }
    }

    if (event === 'payment.captured' && entity?.recurring === 1) {
      if (entity.id && entity.order_id && entity.amount) {
        await handlePresentationSuccess({
          razorpayPaymentId: entity.id,
          razorpayOrderId: entity.order_id,
          amount: entity.amount,
        });
        result = 'presentation_success';
      }
    }

    if (event === 'payment.failed') {
      const orderId = entity?.order_id;
      if (orderId) {
        // Could be mandate auth failure or recurring charge failure
        const mandateAuthFail = await prisma.nachMandate.findFirst({
          where: { razorpayOrderId: orderId },
        });
        if (mandateAuthFail) {
          await rejectMandate({
            razorpayOrderId: orderId,
            reason: entity?.error_description ?? 'Authorization declined',
          });
          result = 'mandate_rejected';
        } else if (entity?.id) {
          await handlePresentationFailure({
            razorpayPaymentId: entity.id,
            errorCode: entity.error_code,
            errorDescription: entity.error_description,
          });
          result = 'presentation_failed';
        }
      }
    }
  } catch (e) {
    console.error('[nach-webhook]', event, e);
    // Still record + return 200 so Razorpay doesn't retry indefinitely
  }

  await prisma.webhookEvent
    .create({ data: { provider: 'razorpay', eventId, event, payload: rawBody, status: 'processed' } })
    .catch(() => {});

  return NextResponse.json({ ok: true, event, result });
}
