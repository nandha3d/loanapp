import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { getTenantRazorpayConfig, resolveTenantForToken } from '@/lib/tenantRazorpay';
import { reconcileSelfPayToken } from '@/lib/selfPay';

/**
 * POST /api/webhooks/razorpay/collections  — mCollect-B per-tenant settlement.
 *
 * Each lender tenant configures THIS url + their own webhook secret in their
 * Razorpay dashboard. The tenant is resolved from `notes.tenant_id` (or from the
 * token) in the unverified body, then the signature is verified with THAT
 * tenant's secret — forging is impossible without it. On a verified capture we
 * post a `self_pay_upi` CollectionEntry (no agent float credit).
 */
const PAYMENT_EVENTS = new Set(['payment_link.paid', 'payment.captured', 'order.paid']);

type Entity = { notes?: Record<string, string>; id?: string; amount?: number };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(routeKey('webhook:rzp-collections', ip), { limit: 300, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  let payload: { event?: string; payload?: { payment_link?: { entity?: Entity }; payment?: { entity?: Entity } } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event;
  if (!event || !PAYMENT_EVENTS.has(event)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const linkEntity = payload.payload?.payment_link?.entity;
  const payEntity = payload.payload?.payment?.entity;
  const token = linkEntity?.notes?.token || payEntity?.notes?.token || undefined;
  const providerRef = linkEntity?.id || payEntity?.id || undefined;
  const notesTenantId = linkEntity?.notes?.tenant_id || payEntity?.notes?.tenant_id || undefined;
  const paidAmount = payEntity?.amount != null ? Math.round(payEntity.amount) / 100 : undefined;

  // Resolve which tenant this settlement belongs to (notes first, else token).
  const tenantId = notesTenantId ?? (await resolveTenantForToken(token, providerRef));
  if (!tenantId) return NextResponse.json({ error: 'Cannot resolve tenant' }, { status: 400 });

  // Verify the signature with THIS tenant's webhook secret.
  const gateway = await getTenantRazorpayConfig(tenantId);
  if (!gateway.webhookSecret) {
    return NextResponse.json({ error: 'Tenant gateway not configured' }, { status: 400 });
  }
  if (!verifyRazorpayWebhookSignature(rawBody, gateway.webhookSecret, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  // Idempotency — dedupe on the Razorpay event id (or a body hash fallback),
  // namespaced per tenant so two tenants can't collide.
  const headerId = request.headers.get('x-razorpay-event-id');
  const eventId = `${tenantId}:${headerId ?? `fallback_${event}_${crypto.createHash('sha256').update(rawBody).digest('hex')}`}`;
  const dup = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: 'razorpay', eventId } },
  });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  let result: { status: string; entryId?: string } = { status: 'invalid' };
  if (token || providerRef) {
    result = await reconcileSelfPayToken({ token, providerRef, paidAmount, agentId: null });
  }

  await prisma.webhookEvent
    .create({ data: { provider: 'razorpay', eventId, event, payload: rawBody, status: 'processed' } })
    .catch(() => {});

  return NextResponse.json({ ok: true, event, selfPay: result.status, entryId: result.entryId ?? null });
}
