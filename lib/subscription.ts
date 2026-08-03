import prisma from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { getEnabledModules } from './moduleGate';

export type TenantSubscriptionAccess = {
  plan: string;
  status: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  gracePeriodEnd?: Date | null;
  createdAt?: Date | null;
  razorpaySubId?: string | null;
  tenant?: { customDomain?: string | null } | null;
};

export type SubscriptionBlockReason =
  | 'missing_subscription'
  | 'trial_expired'
  | 'payment_required'
  | 'payment_overdue'
  | 'subscription_expired'
  | 'subscription_cancelled';

export type TenantSubscriptionAccessState = {
  blocked: boolean;
  reason: SubscriptionBlockReason | null;
  message: string | null;
  effectiveTrialEndsAt: Date | null;
};

// SaaS used to expose a permanent `free` plan. Existing rows do not have a
// trialEndsAt, so treat their creation date as the beginning of a 14-day trial.
// Custom-domain tenants are exempt below and remain lifetime-free.
export const LEGACY_SAAS_FREE_TRIAL_DAYS = 14;

function validDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getEffectiveTrialEndsAt(
  sub: TenantSubscriptionAccess | null | undefined,
): Date | null {
  if (!sub || sub.plan === 'lifetime' || sub.tenant?.customDomain) return null;
  const explicit = validDate(sub.trialEndsAt);
  if (explicit) return explicit;
  if ((sub.plan === 'free' || sub.plan === 'trial') && sub.createdAt) {
    const end = validDate(sub.createdAt);
    if (!end) return null;
    end.setDate(end.getDate() + LEGACY_SAAS_FREE_TRIAL_DAYS);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  return null;
}

export function getTenantSubscriptionAccessState(
  sub: TenantSubscriptionAccess | null | undefined,
  now = new Date(),
): TenantSubscriptionAccessState {
  if (!sub) {
    return {
      blocked: true,
      reason: 'missing_subscription',
      message: 'No subscription is configured for this workspace. Please choose a plan to continue.',
      effectiveTrialEndsAt: null,
    };
  }

  // Custom-domain installations and explicit lifetime plans are never billed.
  // Feature/module limits remain enforced from the subscription row.
  if (sub.plan === 'lifetime' || sub.tenant?.customDomain) {
    return { blocked: false, reason: null, message: null, effectiveTrialEndsAt: null };
  }

  const effectiveTrialEndsAt = getEffectiveTrialEndsAt(sub);
  const currentPeriodEnd = validDate(sub.currentPeriodEnd);
  const hasPaidCoverage = Boolean(currentPeriodEnd && currentPeriodEnd.getTime() >= now.getTime());

  if (sub.status === 'cancelled') {
    return {
      blocked: true,
      reason: 'subscription_cancelled',
      message: 'Your subscription was cancelled. Complete payment to restore access.',
      effectiveTrialEndsAt,
    };
  }
  if (sub.status === 'expired') {
    return {
      blocked: true,
      reason: 'subscription_expired',
      message: 'Your subscription has expired. Complete payment to restore access.',
      effectiveTrialEndsAt,
    };
  }

  // A successfully paid period covers access through its end date, including
  // the time before the next retry is due.
  if (hasPaidCoverage) {
    return { blocked: false, reason: null, message: null, effectiveTrialEndsAt };
  }

  if (effectiveTrialEndsAt) {
    if (effectiveTrialEndsAt.getTime() >= now.getTime()) {
      return { blocked: false, reason: null, message: null, effectiveTrialEndsAt };
    }
    return {
      blocked: true,
      reason: 'trial_expired',
      message: 'Your free trial has ended. Complete payment to continue using LoanTrack.',
      effectiveTrialEndsAt,
    };
  }

  if (sub.status === 'past_due' || sub.status === 'pending' || sub.status === 'halted') {
    return {
      blocked: true,
      reason: 'payment_overdue',
      message: 'Your subscription payment is overdue. Complete payment to restore access.',
      effectiveTrialEndsAt,
    };
  }

  if (currentPeriodEnd && currentPeriodEnd.getTime() < now.getTime()) {
    return {
      blocked: true,
      reason: 'subscription_expired',
      message: 'Your paid subscription period has ended. Renew to continue.',
      effectiveTrialEndsAt,
    };
  }

  // All SaaS plans require either an active trial or a paid period. This is a
  // deliberate fail-closed rule for legacy or malformed rows.
  return {
    blocked: true,
    reason: 'payment_required',
    message: 'Payment is required to activate this workspace.',
    effectiveTrialEndsAt,
  };
}

export function isTenantTrialExpired(
  sub: TenantSubscriptionAccess | null | undefined,
  now = new Date(),
): boolean {
  return getTenantSubscriptionAccessState(sub, now).reason === 'trial_expired';
}

export function isTenantSubscriptionExpired(
  sub: TenantSubscriptionAccess | null | undefined,
  now = new Date(),
): boolean {
  return getTenantSubscriptionAccessState(sub, now).blocked;
}

export function normalizeRazorpaySubscriptionStatus(event: string): string {
  switch (event) {
    case 'subscription.activated':
    case 'subscription.charged':
      return 'active';
    case 'subscription.authenticated':
      return 'authenticated';
    case 'subscription.pending':
    case 'subscription.halted':
      return 'past_due';
    case 'subscription.cancelled':
      return 'cancelled';
    case 'subscription.completed':
    case 'subscription.expired':
      return 'expired';
    default:
      return 'unknown';
  }
}

export class SubscriptionAccessError extends Error {
  readonly reason: SubscriptionBlockReason;
  readonly statusCode = 402;

  constructor(state: TenantSubscriptionAccessState) {
    super(state.message || 'Payment required');
    this.name = 'SubscriptionAccessError';
    this.reason = state.reason || 'payment_required';
  }
}

export function isSubscriptionAccessError(error: unknown): error is SubscriptionAccessError {
  return error instanceof SubscriptionAccessError;
}

export function normalizeEnabledModules(rawModules: unknown): string[] {
  if (!rawModules) return ['microlending'];
  let parsedValue = rawModules;
  if (typeof rawModules === 'string') {
    try {
      parsedValue = JSON.parse(rawModules);
    } catch {
      parsedValue = rawModules.split(',').map((m) => m.trim()).filter(Boolean);
    }
  }
  if (Array.isArray(parsedValue)) {
    return parsedValue.filter((module): module is string => typeof module === 'string');
  }
  return ['microlending'];
}

export async function assertTenantSubscriptionAccess(tenantId: string): Promise<void> {
  if (!tenantId) return;
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { tenant: { select: { customDomain: true } } },
  });
  const state = getTenantSubscriptionAccessState(sub);
  if (state.blocked) throw new SubscriptionAccessError(state);
}

export async function checkLimit(tenantId: string, resource: 'loans' | 'agents' | 'vehicles' | 'chits') {
  if (!tenantId) return;
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub) throw new SubscriptionAccessError(getTenantSubscriptionAccessState(null));
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
  return prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { tenant: { select: { customDomain: true } } },
  });
}

export async function upsertSubscription(
  tenantId: string,
  data: Omit<Prisma.TenantSubscriptionUncheckedCreateInput, 'tenantId'>,
) {
  return prisma.tenantSubscription.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });
}
