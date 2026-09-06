import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateVerticalSubscriptionPricing } from '@/lib/pricing';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay';
import {
  normalizeEnabledModules,
  normalizeRazorpaySubscriptionStatus,
} from '@/lib/subscription';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';

type RazorpayPaymentEntity = {
  id?: string;
  amount?: number; // paise; this is the total captured from the customer
};

type RazorpaySubscriptionEntity = {
  id?: string;
  current_end?: number;
  status?: string;
  notes?: Record<string, string | undefined>;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    subscription?: { entity?: RazorpaySubscriptionEntity };
    payment?: { entity?: RazorpayPaymentEntity };
  };
};

// Platform subscription billing only. Borrower collection webhooks are handled
// separately at /api/webhooks/razorpay/collections using each tenant's keys.
const HANDLED_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.pending',
  'subscription.halted',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.expired',
]);

function addOneMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(routeKey('webhook:razorpay', ip), {
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 });
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

  const subscription = payload.payload?.subscription?.entity;
  const razorpaySubId = subscription?.id;
  if (!razorpaySubId || !razorpaySubId.startsWith('sub_')) {
    return NextResponse.json({ error: 'Missing Razorpay subscription id' }, { status: 400 });
  }

  const headerEventId = request.headers.get('x-razorpay-event-id');
  const eventId = headerEventId && headerEventId.length <= 255
    ? headerEventId
    : `fallback_${event}_${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
  const eventPayload = JSON.stringify({ event, razorpaySubId });

  // Reserve the event before mutating billing state. This closes the race where
  // two simultaneous Razorpay retries could otherwise create duplicate invoices.
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: 'razorpay', eventId } },
  });
  const processingIsFresh = existingEvent?.status === 'processing' &&
    Date.now() - existingEvent.processedAt.getTime() < 5 * 60 * 1000;
  if (existingEvent?.status === 'processed' || processingIsFresh) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  try {
    if (existingEvent) {
      await prisma.webhookEvent.update({
        where: { id: existingEvent.id },
        data: { status: 'processing', payload: eventPayload },
      });
    } else {
      await prisma.webhookEvent.create({
        data: { provider: 'razorpay', eventId, event, payload: eventPayload, status: 'processing' },
      });
    }
  } catch {
    // Another request won the unique-key race and is already handling it.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    const tenantIdFromNotes = subscription.notes?.tenant_id;
    let tenantSub = await prisma.tenantSubscription.findUnique({
      where: { razorpaySubId },
      include: { tenant: { select: { customDomain: true } } },
    });

    // Recovery path for subscriptions created before the ID was persisted, or
    // when the database write failed after Razorpay successfully created it.
    if (!tenantSub && tenantIdFromNotes) {
      tenantSub = await prisma.tenantSubscription.findUnique({
        where: { tenantId: tenantIdFromNotes },
        include: { tenant: { select: { customDomain: true } } },
      });
      if (tenantSub) {
        // Never let a late event from an old/cancelled subscription replace a
        // newer subscription already linked to this tenant.
        if (tenantSub.razorpaySubId && tenantSub.razorpaySubId !== razorpaySubId) {
          await prisma.webhookEvent.update({
            where: { provider_eventId: { provider: 'razorpay', eventId } },
            data: { status: 'processed' },
          });
          return NextResponse.json({ ok: true, ignored: true, reason: 'stale_subscription' });
        }
        tenantSub = await prisma.tenantSubscription.update({
          where: { id: tenantSub.id },
          data: { razorpaySubId },
          include: { tenant: { select: { customDomain: true } } },
        });
      }
    }

    if (!tenantSub) throw new Error('No tenant subscription matches the Razorpay event');

    if (tenantSub.plan === 'lifetime' || tenantSub.tenant.customDomain) {
      await prisma.webhookEvent.update({ where: { provider_eventId: { provider: 'razorpay', eventId } }, data: { status: 'processed' } });
      return NextResponse.json({ ok: true, ignored: true, reason: 'lifetime_workspace' });
    }

    const normalizedStatus = normalizeRazorpaySubscriptionStatus(event);
    const updateData: {
      status: string;
      currentPeriodEnd?: Date;
      gracePeriodEnd?: Date | null;
      trialEndsAt?: Date | null;
      plan?: string;
      maxActiveLoans?: number;
      maxAgents?: number;
      maxBranches?: number;
      basePlanPrice?: number;
      modulesPrice?: number;
      addonsPrice?: number;
      totalMonthlyPrice?: number;
    } = { status: normalizedStatus };

    if (subscription.current_end) {
      updateData.currentPeriodEnd = new Date(subscription.current_end * 1000);
    } else if (event === 'subscription.charged') {
      // A signed charged event proves payment even if current_end is omitted.
      updateData.currentPeriodEnd = addOneMonth(new Date());
    }

    if (event === 'subscription.halted' || event === 'subscription.pending') {
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 7);
      updateData.gracePeriodEnd = graceEnd;
    } else if (event === 'subscription.charged' || event === 'subscription.activated') {
      updateData.gracePeriodEnd = null;
    }
    if (event === 'subscription.charged') updateData.trialEndsAt = null;

    // Only a successful activation/charge changes plan limits. The desired plan
    // comes from notes written by our server, and the signed webhook is verified.
    if (event === 'subscription.activated' || event === 'subscription.charged') {
      const requestedPlan = subscription.notes?.loantrack_plan || tenantSub.plan;
      const catalog = await prisma.subscriptionPlanCatalog.findFirst({
        where: { plan: requestedPlan, isActive: true, monthlyPrice: { gt: 0 } },
      });
      if (!catalog) throw new Error('Razorpay event references an unavailable SaaS plan');

      const enabledModules = normalizeEnabledModules(tenantSub.enabledModules);
      const selectedAddons = stringList(tenantSub.selectedAddons);
      const addonRows = selectedAddons.length
        ? await prisma.addonCatalog.findMany({
            where: { addon: { in: selectedAddons }, isActive: true },
            select: { monthlyPrice: true },
          })
        : [];
      const addonsPrice = addonRows.reduce((sum, addon) => sum + addon.monthlyPrice, 0);
      const pricing = calculateVerticalSubscriptionPricing(
        catalog.monthlyPrice,
        enabledModules,
        addonsPrice,
      );
      Object.assign(updateData, {
        plan: catalog.plan,
        maxActiveLoans: catalog.maxActiveLoans,
        maxAgents: catalog.maxAgents,
        maxBranches: catalog.maxBranches,
        basePlanPrice: pricing.basePlanPrice,
        modulesPrice: pricing.modulesPrice,
        addonsPrice: pricing.addonsPrice,
        totalMonthlyPrice: pricing.totalMonthlyPrice,
      });
    }

    const updatedSub = await prisma.tenantSubscription.update({
      where: { id: tenantSub.id },
      data: updateData,
    });

    if (event === 'subscription.charged') {
      const payment = payload.payload?.payment?.entity;
      const capturedTotal = payment?.amount != null
        ? payment.amount / 100
        : updatedSub.totalMonthlyPrice;
      await prisma.billingInvoice.create({
        data: {
          tenantId: updatedSub.tenantId,
          subscriptionId: updatedSub.id,
          amount: capturedTotal,
          tax: 0,
          total: capturedTotal,
          status: 'paid',
          dueDate: new Date(),
          paidAt: new Date(),
          razorpayId: payment?.id,
          billingPeriod: new Date().toISOString().slice(0, 7),
        },
      });
    }

    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
      data: { status: 'processed' },
    });

    return NextResponse.json({ ok: true, event, razorpaySubId, subscriptionsUpdated: 1 });
  } catch (error) {
    console.error('Razorpay webhook processing failed', {
      event,
      razorpaySubId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
      data: { status: 'failed' },
    }).catch(() => undefined);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
