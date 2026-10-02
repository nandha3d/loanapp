import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateVerticalSubscriptionPricing } from '@/lib/pricing';
import { getPlatformPaymentSettings } from '@/lib/platformPayment';
import { getRazorpaySubscription, normalizeBillingCycle, verifyRazorpaySubscriptionSignature } from '@/lib/razorpay';
import { normalizeEnabledModules } from '@/lib/subscription';
import { planFeatureUpdate } from '@/lib/planFeatures';
import { reconcilePlanLimits } from '@/lib/planLimits';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Activates the plan the moment Razorpay Checkout reports success, instead of
 * waiting for the webhook (which needs a public URL + secret and can lag or be
 * misconfigured). Mirrors the webhook's `subscription.activated` update and is
 * idempotent with it. Trust comes from Razorpay's checkout signature plus a
 * server-side re-read of the subscription — never from client-supplied fields.
 */
export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(routeKey('subscribe:confirm', getClientIp(request)), {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const paymentId = typeof body?.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
  const subscriptionId = typeof body?.razorpay_subscription_id === 'string' ? body.razorpay_subscription_id : '';
  const signature = typeof body?.razorpay_signature === 'string' ? body.razorpay_signature : '';
  if (!paymentId || !subscriptionId.startsWith('sub_') || !signature) {
    return NextResponse.json({ error: 'Invalid payment confirmation' }, { status: 400 });
  }

  const platform = await getPlatformPaymentSettings();
  if (!platform.keySecret || !verifyRazorpaySubscriptionSignature(paymentId, subscriptionId, signature, platform.keySecret)) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
  }

  const tenantSub = await prisma.tenantSubscription.findUnique({
    where: { razorpaySubId: subscriptionId },
    include: { tenant: { select: { customDomain: true } } },
  });
  if (!tenantSub) return NextResponse.json({ error: 'Unknown subscription' }, { status: 404 });
  if (tenantSub.plan === 'lifetime' || tenantSub.tenant.customDomain) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const rzp = await getRazorpaySubscription(subscriptionId);
  if (!rzp) return NextResponse.json({ error: 'Could not verify subscription with Razorpay' }, { status: 502 });

  // Trial/deferred start: mandate authorised, first charge later (webhook handles it).
  if (rzp.status === 'authenticated') {
    await prisma.tenantSubscription.update({ where: { id: tenantSub.id }, data: { status: 'authenticated' } });
    return NextResponse.json({ ok: true, status: 'authenticated' });
  }
  if (rzp.status !== 'active') {
    return NextResponse.json({ ok: true, status: rzp.status, activated: false });
  }

  const requestedPlan = rzp.notes?.loantrack_plan || tenantSub.plan;
  const catalog = await prisma.subscriptionPlanCatalog.findFirst({
    where: { plan: requestedPlan, isActive: true, monthlyPrice: { gt: 0 } },
  });
  if (!catalog) return NextResponse.json({ error: 'Plan unavailable' }, { status: 409 });

  const enabledModules = normalizeEnabledModules(tenantSub.enabledModules);
  const selectedAddons = stringList(tenantSub.selectedAddons);
  const addonRows = selectedAddons.length
    ? await prisma.addonCatalog.findMany({
        where: { addon: { in: selectedAddons }, isActive: true },
        select: { monthlyPrice: true },
      })
    : [];
  const addonsPrice = addonRows.reduce((sum, addon) => sum + addon.monthlyPrice, 0);
  const pricing = calculateVerticalSubscriptionPricing(catalog.monthlyPrice, enabledModules, addonsPrice);

  await prisma.tenantSubscription.update({
    where: { id: tenantSub.id },
    data: {
      status: 'active',
      billingCycle: normalizeBillingCycle(rzp.notes?.loantrack_cycle),
      plan: catalog.plan,
      maxActiveLoans: catalog.maxActiveLoans,
      maxAgents: catalog.maxAgents,
      maxBranches: catalog.maxBranches,
      basePlanPrice: pricing.basePlanPrice,
      modulesPrice: pricing.modulesPrice,
      addonsPrice: pricing.addonsPrice,
      totalMonthlyPrice: pricing.totalMonthlyPrice,
      trialEndsAt: null,
      gracePeriodEnd: null,
      ...planFeatureUpdate(catalog, tenantSub),
      ...(rzp.current_end ? { currentPeriodEnd: new Date(rzp.current_end * 1000) } : {}),
    },
  });

  await reconcilePlanLimits(tenantSub.tenantId);

  return NextResponse.json({ ok: true, status: 'active', activated: true, plan: catalog.plan });
}
