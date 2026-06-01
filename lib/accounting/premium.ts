import { prisma } from '@/lib/db';

/**
 * Server-side gate: is premium accounting enabled for this tenant?
 */
export async function isPremiumAccountingEnabled(tenantId: string): Promise<boolean> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { premiumAccountingEnabled: true },
  });
  return Boolean(sub?.premiumAccountingEnabled);
}

/**
 * Get or create accounting settings for a tenant.
 */
export async function getOrCreateAccountingSettings(tenantId: string) {
  let settings = await prisma.accountingSettings.findUnique({ where: { tenantId } });
  if (!settings) {
    settings = await prisma.accountingSettings.create({
      data: {
        tenantId,
        postingOverrides: '{}',
      },
    });
  }
  return settings;
}

/**
 * Compute fiscal year string (e.g. '2026-27') from a date and start month.
 */
export function getFiscalYear(date: Date, startMonth = 4): string {
  const month = date.getMonth() + 1; // 1-based
  const year = date.getFullYear();
  if (month >= startMonth) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

/**
 * Compute period key (YYYY-MM) from a date.
 */
export function getPeriodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Format currency in Indian numbering system.
 */
export function formatIndianCurrency(amount: number | string, symbol = '₹'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0`;
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Audit log helper.
 */
export async function writeAuditLog(params: {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: object;
  after?: object;
  reason?: string;
}) {
  const { tenantId, userId, action, entityType, entityId, before, after, reason } = params;
  await prisma.accountingAuditLog.create({
    data: {
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      before: before ? JSON.stringify(before) : undefined,
      after: after ? JSON.stringify(after) : undefined,
      reason,
    },
  });
}
