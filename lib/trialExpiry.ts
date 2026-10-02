import prisma from '@/lib/db';
import { isUnpaidExpiredTrial } from '@/lib/subscription';
import { planFeatureUpdate } from '@/lib/planFeatures';
import { reconcilePlanLimits } from '@/lib/planLimits';

/**
 * Moves a tenant onto the Free plan: Free's limits and feature checklist apply
 * and extra branches/agents are locked (earliest-created survive). Free is a
 * normal plan with no deadline; the tenant can upgrade whenever they like.
 * Returns false when there is no active Free plan to move to.
 */
export async function downgradeToFree(tenantId: string): Promise<boolean> {
  const free = await prisma.subscriptionPlanCatalog.findFirst({ where: { plan: 'free', isActive: true } });
  if (!free) return false;
  const current = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!current) return false;

  await prisma.tenantSubscription.update({
    where: { id: current.id },
    data: {
      plan: free.plan,
      status: 'active',
      maxActiveLoans: free.maxActiveLoans,
      maxAgents: free.maxAgents,
      maxBranches: free.maxBranches,
      trialEndsAt: null,
      gracePeriodEnd: null,
      selectedAddons: '[]',
      basePlanPrice: 0,
      modulesPrice: 0,
      addonsPrice: 0,
      totalMonthlyPrice: 0,
      billingCycle: 'monthly',
      ...planFeatureUpdate(free, current),
    },
  });
  await reconcilePlanLimits(tenantId);
  return true;
}

/** Lazy per-tenant check used on reads; the daily cron sweeps everyone else. */
export async function settleExpiredTrial(tenantId: string): Promise<boolean> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { tenant: { select: { customDomain: true } } },
  });
  return isUnpaidExpiredTrial(sub) ? downgradeToFree(tenantId) : false;
}
