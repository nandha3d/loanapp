import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay';
import { normalizeRazorpaySubscriptionStatus } from '@/lib/subscription';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';

type RazorpaySubscriptionEntity = {
  id?: string;
  current_end?: number;
  status?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: RazorpaySubscriptionEntity;
    };
  };
};

const HANDLED_EVENTS = new Set([
  'subscription.activated',
  'subscription.charged',
  'subscription.halted',
  'subscription.cancelled',
]);

export async function POST(request: NextRequest) {
  // Rate limit: 300 requests per IP per 10 minutes.
  // Intentionally generous so no legitimate Razorpay delivery is ever blocked.
  const ip = getClientIp(request);
  const rl = await checkRateLimit(routeKey('webhook:razorpay', ip), { limit: 300, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'RAZORPAY_WEBHOOK_SECRET is not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  if (!verifyRazorpayWebhookSignature(rawBody, webhookSecret, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const event = payload.event;
  if (!event || !HANDLED_EVENTS.has(event)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // ── Idempotency: deduplicate on the Razorpay event ID ────────────────────
  const razorpayEventId = request.headers.get('x-razorpay-event-id') ?? null;
  if (razorpayEventId) {
    const existing = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'razorpay', eventId: razorpayEventId } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const subscription = payload.payload?.subscription?.entity;
  const razorpaySubId = subscription?.id;
  if (!razorpaySubId) {
    return NextResponse.json({ error: 'Missing Razorpay subscription id' }, { status: 400 });
  }

  const data: {
    status: string;
    currentPeriodEnd?: Date;
  } = {
    status: normalizeRazorpaySubscriptionStatus(event),
  };

  if (subscription?.current_end) {
    data.currentPeriodEnd = new Date(subscription.current_end * 1000);
  }

  const updated = await prisma.tenantSubscription.updateMany({
    where: { razorpaySubId },
    data,
  });

  // Record this event to prevent future duplicate processing
  if (razorpayEventId) {
    await prisma.webhookEvent.create({
      data: {
        provider: 'razorpay',
        eventId: razorpayEventId,
        event,
        payload: rawBody,
        status: 'processed',
      },
    }).catch(() => {}); // non-blocking — don't fail the response
  }

  return NextResponse.json({
    ok: true,
    event,
    razorpaySubId,
    subscriptionsUpdated: updated.count,
  });
}
