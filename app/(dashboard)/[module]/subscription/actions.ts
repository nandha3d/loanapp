'use server';

import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { getSubscription, normalizeEnabledModules } from '@/lib/subscription';
import { calculateVerticalSubscriptionPricing } from '@/lib/pricing';
import { initiateCheckout } from '@/app/portal/billing/actions';
import { revalidatePath } from 'next/cache';

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

/**
 * Initiates checkout via Razorpay (or mock-checkout).
 * Calls the central initiateCheckout action.
 */
export async function initiateSubscriptionUpgrade(planId: string) {
  return await initiateCheckout(planId);
}

/**
 * Direct development/test upgrade simulator.
 * Allows activating an upgraded tier immediately when live Razorpay API credentials
 * are unavailable in local or staging environments.
 */
export async function simulatePlanUpgrade(planId: string) {
  const session = await auth();
  if (!session?.user) return { error: 'Please sign in again to continue.' };

  const sessionUser = session.user as { role?: string; tenantId?: string | null };
  const role = sessionUser.role;
  if (role !== 'superadmin' && role !== 'developer' && role !== 'admin') {
    return { error: 'Only a workspace owner or administrator can upgrade plans.' };
  }

  const tenantId = role === 'developer'
    ? await getDefaultTenantId()
    : (sessionUser.tenantId || await getDefaultTenantId());
  if (!tenantId) return { error: 'No workspace is associated with this account.' };

  const current = await getSubscription(tenantId);
  if (!current) return { error: 'No subscription found for this workspace.' };

  const catalog = await prisma.subscriptionPlanCatalog.findFirst({
    where: { plan: planId, isActive: true },
  });
  if (!catalog) return { error: 'Selected subscription plan is not available.' };

  const enabledModules = normalizeEnabledModules(current.enabledModules);
  const selectedAddons = parseStringList(current.selectedAddons);
  const addonRows = selectedAddons.length
    ? await prisma.addonCatalog.findMany({
        where: { addon: { in: selectedAddons }, isActive: true },
        select: { monthlyPrice: true },
      })
    : [];
  const addonsPrice = addonRows.reduce((sum, addon) => sum + addon.monthlyPrice, 0);

  const isFreePlan = catalog.plan === 'free' || catalog.monthlyPrice === 0;
  const basePlanPrice = isFreePlan ? 0 : catalog.monthlyPrice;
  const effectiveAddonsPrice = isFreePlan ? 0 : addonsPrice;
  const totalMonthlyPrice = basePlanPrice + effectiveAddonsPrice;

  const oneMonthLater = new Date();
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  const updated = await prisma.tenantSubscription.update({
    where: { tenantId },
    data: {
      plan: catalog.plan,
      status: 'active',
      maxBranches: catalog.maxBranches,
      maxActiveLoans: catalog.maxActiveLoans,
      maxAgents: catalog.maxAgents,
      currentPeriodEnd: oneMonthLater,
      trialEndsAt: null,
      basePlanPrice,
      modulesPrice: 0,
      addonsPrice: effectiveAddonsPrice,
      totalMonthlyPrice,
      razorpaySubId: `sim_${catalog.plan}_${Date.now()}`,
    },
  });

  if (totalMonthlyPrice > 0) {
    await prisma.billingInvoice.create({
      data: {
        tenantId,
        subscriptionId: updated.id,
        amount: totalMonthlyPrice,
        tax: 0,
        total: totalMonthlyPrice,
        status: 'paid',
        dueDate: oneMonthLater,
        paidAt: new Date(),
        billingPeriod: `${new Date().toLocaleDateString()} - ${oneMonthLater.toLocaleDateString()}`,
      },
    });
  }

  // Also log the audit event if possible
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: (session.user as any).id || null,
        action: 'SUBSCRIPTION_UPGRADED',
        entityType: 'tenant_subscription',
        entityId: updated.id,
        oldValue: current.plan,
        newValue: catalog.plan,
      },
    });
  } catch {
    // Ignore audit log error if schema does not support
  }

  revalidatePath('/[module]/subscription', 'page');
  revalidatePath('/[module]/settings', 'page');

  return { ok: true, plan: catalog.displayName, maxBranches: catalog.maxBranches };
}
