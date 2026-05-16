import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay';
import { normalizeRazorpaySubscriptionStatus } from '@/lib/subscription';
import { PLAN_FEATURES, PLAN_PRICING } from '@/lib/plans';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import crypto from 'node:crypto';

type RazorpayPaymentEntity = {
  amount?: number; // in paise
  tax?: number;    // in paise
};

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
    payment?: {
      entity?: RazorpayPaymentEntity;
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
  let razorpayEventId = request.headers.get('x-razorpay-event-id') ?? null;
  if (!razorpayEventId) {
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    razorpayEventId = `fallback_${event}_${payloadHash}`;
  }
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
    gracePeriodEnd?: Date;
  } = {
    status: normalizeRazorpaySubscriptionStatus(event),
  };

  if (subscription?.current_end) {
    data.currentPeriodEnd = new Date(subscription.current_end * 1000);
  }

  // Grace Period handling for halted subscriptions
  if (event === 'subscription.halted') {
    data.status = 'past_due';
    
    // Get plan details to determine grace period
    const existingSub = await prisma.tenantSubscription.findUnique({
      where: { razorpaySubId },
    });
    
    let graceDays = 7;
    if (existingSub && existingSub.plan) {
      graceDays = PLAN_FEATURES[existingSub.plan]?.gracePeriodDays || 7;
    }
    
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + graceDays);
    data.gracePeriodEnd = graceEnd;
  }

  const updatedCount = await prisma.tenantSubscription.updateMany({
    where: { razorpaySubId },
    data,
  });

  // Apply plan-specific limits if the subscription exists
  if (updatedCount.count > 0) {
    const existingSub = await prisma.tenantSubscription.findUnique({
      where: { razorpaySubId },
    });
    
    if (existingSub && existingSub.plan && PLAN_FEATURES[existingSub.plan]) {
      const features = PLAN_FEATURES[existingSub.plan];
      await prisma.tenantSubscription.update({
        where: { id: existingSub.id },
        data: {
          maxActiveLoans: features.loans,
          maxAgents: features.agents,
          enabledModules: features.modules,
        }
      });
    }
  }

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

  // ── Invoice Generation ───────────────────────────────────────────────────
  if (event === 'subscription.charged') {
    const tenantSub = await prisma.tenantSubscription.findUnique({
      where: { razorpaySubId },
    });
    if (tenantSub) {
      // Create invoice record
      const paymentEntity = payload.payload?.payment?.entity;
      const planPricing = PLAN_PRICING[tenantSub.plan ?? ''] ?? PLAN_PRICING['basic'];
      // Razorpay amounts are in paise (1/100 rupee); fall back to plan pricing config
      const invoiceAmount = paymentEntity?.amount != null
        ? Math.round(paymentEntity.amount / 100)
        : planPricing.amount;
      const invoiceTax = paymentEntity?.tax != null
        ? Math.round(paymentEntity.tax / 100)
        : planPricing.tax;
      const invoiceTotal = invoiceAmount + invoiceTax;
      await prisma.billingInvoice.create({
        data: {
          tenantId: tenantSub.tenantId,
          subscriptionId: tenantSub.id,
          amount: invoiceAmount,
          tax: invoiceTax,
          total: invoiceTotal,
          status: 'paid',
          dueDate: new Date(),
          paidAt: new Date(),
          billingPeriod: new Date().toISOString().slice(0, 7), // YYYY-MM
        }
      });
    }
  }

  return NextResponse.json({
    ok: true,
    event,
    razorpaySubId,
    subscriptionsUpdated: updatedCount.count,
  });
}
