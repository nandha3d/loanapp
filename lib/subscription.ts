import prisma from '@/lib/db';
import { getEnabledModules } from './moduleGate';

export type TenantSubscriptionAccess = {
  plan: string;
  status: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
};

export function isTenantTrialExpired(sub: TenantSubscriptionAccess | null | undefined, now = new Date()): boolean {
  if (!sub || sub.plan !== 'trial' || !sub.trialEndsAt) return false;
  return new Date(sub.trialEndsAt).getTime() < now.getTime();
}

export function isTenantSubscriptionExpired(sub: TenantSubscriptionAccess | null | undefined, now = new Date()): boolean {
  if (!sub) return false;
  if (sub.status === 'expired' || sub.status === 'cancelled') return true;
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() < now.getTime()) return true;
  return false;
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
  // DB stores as JSON string in LongText — parse first
  if (typeof rawModules === 'string') {
    try {
      const parsed = JSON.parse(rawModules);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // fallback: comma-separated string
      return rawModules.split(',').map((m) => m.trim()).filter(Boolean);
    }
  }
  if (Array.isArray(rawModules)) return rawModules as string[];
  return ['microlending'];
}

export async function assertTenantSubscriptionAccess(tenantId: string): Promise<void> {
  if (!tenantId) return;
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub) return;

  if (isTenantTrialExpired(sub)) {
    throw new Error('Your trial has expired. Please upgrade your subscription to continue.');
  }

  const isExpired = isTenantSubscriptionExpired(sub);
  if (isExpired) {
    throw new Error('Your subscription has expired or been cancelled. Please renew to continue.');
  }

  if (sub.status === 'past_due') {
    const gracePeriodEnd = (sub as any).gracePeriodEnd as Date | null | undefined;
    if (gracePeriodEnd && gracePeriodEnd > new Date()) return;
    throw new Error('Your subscription payment is overdue. Please update your payment method to continue.');
  }
}

export async function checkLimit(tenantId: string, resource: 'loans' | 'agents' | 'vehicles' | 'chits') {
  if (!tenantId) return;
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
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

export async function getSubscription(tenantId: string | null | undefined) {
  if (!tenantId) return null;
  return prisma.tenantSubscription.findUnique({ where: { tenantId } });
}

export async function upsertSubscription(tenantId: string, data: any) {
  return prisma.tenantSubscription.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });
}
