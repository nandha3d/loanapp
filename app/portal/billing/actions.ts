'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { calculateVerticalSubscriptionPricing } from '@/lib/pricing';
import {
  RazorpayApiError,
  createRazorpayPlan,
  createRazorpaySubscription,
  getConfiguredRazorpayPlanId,
  getRazorpaySubscription,
  normalizeRazorpayPlanId,
} from '@/lib/razorpay';
import { getSubscription, normalizeEnabledModules } from '@/lib/subscription';
import { getDefaultTenantId } from '@/lib/tenant';

type CheckoutResult = { error: string } | undefined;

function parseStringList(value: unknown): string[] {
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

function validateCheckoutUrl(value: string | null): string | null {
  if (!value) return null;
  if (process.env.RAZORPAY_MOCK_CHECKOUT === 'true' && value.startsWith('/portal/billing/')) {
    return value;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'rzp.io' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function initiateCheckout(planId: string): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user) return { error: 'Please sign in again to continue.' };

  const sessionUser = session.user as { role?: string; tenantId?: string | null };
  const role = sessionUser.role;
  if (role !== 'superadmin' && role !== 'developer' && role !== 'admin') {
    return { error: 'Only a workspace owner or administrator can manage billing.' };
  }
  if (!/^[a-z0-9_-]{1,50}$/i.test(planId)) return { error: 'Invalid subscription plan.' };

  // Billing must remain reachable after the normal tenant resolver begins
  // returning HTTP 402 for Server Actions. Non-developers can only bill the
  // tenant embedded in their authenticated session.
  const tenantId = role === 'developer'
    ? await getDefaultTenantId()
    : sessionUser.tenantId;
  if (!tenantId) return { error: 'No workspace is associated with this account.' };
  const current = await getSubscription(tenantId);
  if (!current) return { error: 'No subscription is configured for this workspace.' };
  if (current.plan === 'lifetime' || current.tenant?.customDomain) {
    return { error: 'This custom-domain workspace has lifetime access and does not require checkout.' };
  }
  if (current.status === 'authenticated' && current.razorpaySubId) {
    return { error: 'Razorpay payment authorization is already complete. Your first charge is scheduled for the end of the trial.' };
  }
  if (
    current.status === 'active' &&
    current.razorpaySubId &&
    current.currentPeriodEnd &&
    current.currentPeriodEnd >= new Date()
  ) {
    return { error: 'A recurring subscription is already active. Contact support before changing its plan.' };
  }

  let checkoutUrl: string | null = null;
  try {
    // Reuse an unfinished Razorpay subscription so retries do not create
    // multiple mandates for the same tenant.
    if (current.razorpaySubId?.startsWith('sub_')) {
      const existing = await getRazorpaySubscription(current.razorpaySubId);
      if (existing && ['created', 'pending', 'halted'].includes(existing.status)) {
        checkoutUrl = validateCheckoutUrl(existing.short_url);
        if (!checkoutUrl) {
          return { error: 'The existing Razorpay checkout link is unavailable. Please contact support.' };
        }
      } else if (existing && ['authenticated', 'active'].includes(existing.status)) {
        return { error: 'This recurring payment is already authorized in Razorpay.' };
      }
    }

    if (!checkoutUrl) {
      const catalog = await prisma.subscriptionPlanCatalog.findFirst({
        where: { plan: planId, isActive: true, monthlyPrice: { gt: 0 } },
      });
      if (!catalog) return { error: 'That paid plan is no longer available.' };

      // A plan pinned by an operator wins — first the one saved against this
      // catalog row in Developer → Billing → Pricing, then the environment.
      // Both name an existing, immutable Razorpay plan, so checkout needs no
      // write access to the Plans API and retries stop littering the account
      // with one new plan per attempt. Falls back to minting a plan from this
      // tenant's computed total.
      let razorpayPlanId =
        normalizeRazorpayPlanId(catalog.razorpayPlanId) ??
        getConfiguredRazorpayPlanId(catalog.plan);
      if (!razorpayPlanId) {
        const enabledModules = normalizeEnabledModules(current.enabledModules);
        const selectedAddons = parseStringList(current.selectedAddons);
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

        razorpayPlanId = await createRazorpayPlan({
          tenantId,
          planId: catalog.plan,
          displayName: catalog.displayName,
          amountRupees: pricing.totalMonthlyPrice,
        });
      }
      const now = Date.now();
      const trialEnd = current.trialEndsAt?.getTime() ?? 0;
      const startAt = trialEnd > now + 5 * 60 * 1000
        ? Math.floor(trialEnd / 1000)
        : undefined;
      const subscription = await createRazorpaySubscription(catalog.plan, tenantId, {
        razorpayPlanId,
        startAt,
      });

      await prisma.tenantSubscription.update({
        where: { tenantId },
        data: { razorpaySubId: subscription.id },
      });
      checkoutUrl = validateCheckoutUrl(subscription.short_url);
    }
  } catch (error) {
    console.error('Checkout initialization failed', {
      tenantId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    // Billing is owner/admin-only, so the operator seeing this message is the
    // person who can fix a misconfiguration. Saying "try again" for a rejected
    // API key just sends them round the same loop.
    if (error instanceof RazorpayApiError) {
      if (error.code === 'KEYS_MISSING') {
        return { error: 'Razorpay is not configured for this deployment. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then try again.' };
      }
      if (error.status === 401) {
        return { error: 'Razorpay rejected the API credentials for this deployment. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET belong to the same live Razorpay account, then try again.' };
      }
      return { error: `Razorpay could not start this checkout: ${error.message}` };
    }
    return { error: 'Payment checkout could not be started. Please try again or contact support.' };
  }

  if (!checkoutUrl) {
    return { error: 'Razorpay did not provide a valid checkout link. Please try again.' };
  }

  // redirect() throws by design in Next.js, so it must remain outside the
  // checkout error handler.
  redirect(checkoutUrl);
}
