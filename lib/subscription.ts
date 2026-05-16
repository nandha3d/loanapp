import prisma from '@/lib/db';
import { getEnabledModules } from './moduleGate';

export type TenantSubscriptionAccess = {
  plan: string;
  status: string;
  trialEndsAt?: Date | null;
};

export function isTenantTrialExpired(sub: TenantSubscriptionAccess | null | undefined, now = new Date()): boolean {
  if (!sub || sub.plan !== 'trial' || !sub.trialEndsAt) return false;
  return sub.trialEndsAt.getTime() < now.getTime();
}

export function normalizeRazorpaySubscriptionStatus(event: string): string {
  switch (event) {
    case 'subscription.activated':
    case 'subscription.charged':
      return 'active';
    case 'subscription.halted':
      return 'past_due';
    case 'subscription.cancelled':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export function normalizeEnabledModules(rawModules: any): string[] {
  if (!rawModules) return ['microlending'];
  if (Array.isArray(rawModules)) return rawModules as string[];
  if (typeof rawModules === 'string') {
    return rawModules.split(',').map((m) => m.trim()).filter(Boolean);
  }
  return ['microlending'];
}

export async function assertTenantSubscriptionAccess(tenantId: string): Promise<void> {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub) return;

  if (isTenantTrialExpired(sub)) {
    throw new Error('Your trial has expired. Please upgrade your subscription to continue.');
  }

  if (sub.status === 'past_due') {
    // Allow continued access during a grace period if one is configured
    const gracePeriodEnd = (sub as any).gracePeriodEnd as Date | null | undefined;
    if (gracePeriodEnd && gracePeriodEnd > new Date()) return;
    throw new Error('Your subscription payment is overdue. Please update your payment method to continue.');
  }

  if (sub.status === 'expired') {
    throw new Error('Your subscription has expired. Please renew to continue.');
  }

  if (sub.status === 'cancelled') {
    throw new Error('Your subscription has been cancelled. Please contact support.');
  }

  if (sub.status !== 'active') {
    throw new Error('Your subscription is currently inactive. Please contact the administrator.');
  }
}

export async function checkLimit(tenantId: string, resource: 'loans' | 'agents' | 'vehicles' | 'chits') {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  // If no subscription record exists, apply permissive defaults
  if (!sub) return;
  await assertTenantSubscriptionAccess(tenantId);

  if (resource === 'loans') {
    const count = await prisma.loan.count({ where: { tenantId, status: 'active' } });
    if (count >= sub.maxActiveLoans) {
      throw new Error(`Active loan limit reached (${sub.maxActiveLoans}). Upgrade your plan to create more loans.`);
    }
  }

  if (resource === 'agents') {
    const count = await prisma.user.count({ where: { tenantId, role: 'agent', status: 'active' } });
    if (count >= sub.maxAgents) {
      throw new Error(`Agent limit reached (${sub.maxAgents}). Upgrade your plan to add more agents.`);
    }
  }

  if (resource === 'vehicles') {
    const enabled = await getEnabledModules(tenantId);
    if (!enabled.includes('autofinance')) throw new Error('Auto Finance module not enabled on your plan.');
  }

  if (resource === 'chits') {
    const enabled = await getEnabledModules(tenantId);
    if (!enabled.includes('chitfunds')) throw new Error('Chit Funds module not enabled on your plan.');
  }
}

export async function getSubscription(tenantId: string) {
  return prisma.tenantSubscription.findUnique({ where: { tenantId } });
}

export async function upsertSubscription(tenantId: string, data: {
  plan: string;
  status: string;
  maxActiveLoans: number;
  maxAgents: number;
  enabledModules: any;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  razorpaySubId?: string | null;
}) {
  return prisma.tenantSubscription.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });
}
