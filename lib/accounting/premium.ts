import { prisma } from '@/lib/db';
import { flagCache } from '@/lib/cache/tenantCache';

/**
 * Server-side gate: is premium accounting enabled for this tenant?
 * Cached in-process for 30s — this is read on nearly every accounting hit.
 */
export async function isPremiumAccountingEnabled(tenantId: string): Promise<boolean> {
  const cacheKey = `acct:${tenantId}`;
  const cached = flagCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { premiumAccountingEnabled: true },
  });
  const enabled = Boolean(sub?.premiumAccountingEnabled);
  flagCache.set(cacheKey, enabled);
  return enabled;
}

/**
 * Get or create accounting settings for a tenant.
 */
export async function getOrCreateAccountingSettings(tenantId: string) {
  let settings = await prisma.accountingSettings.findUnique({ where: { tenantId } });
  if (!settings) {
    settings = await prisma.accountingSettings.create({
      data: { tenantId, postingOverrides: '{}' },
    });
  }
  return settings;
}

/**
 * Tenant-configured fiscal-year start month (1=Jan … 12=Dec).
 * Stored on AccountingSettings.fiscalYearStartMonth, default 4 (Indian FY).
 */
export async function getFyStartMonth(tenantId: string): Promise<number> {
  const settings = await getOrCreateAccountingSettings(tenantId);
  const month = settings.fiscalYearStartMonth ?? 4;
  return month >= 1 && month <= 12 ? month : 4;
}

/**
 * Compute fiscal year string (e.g. '2026-27') from a date and start month.
 * Pass the tenant's start month from getFyStartMonth() — the default of 4
 * is only a fallback for legacy call sites.
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
  appType?: string | null;
  branchId?: string | null;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: object;
  after?: object;
  reason?: string;
}) {
  const { tenantId, appType, branchId, userId, action, entityType, entityId, before, after, reason } = params;
  await prisma.accountingAuditLog.create({
    data: {
      tenantId,
      appType,
      branchId,
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

export class PeriodLockedError extends Error {
  code = 'period_locked';
  constructor(message = 'Accounting period is locked or closed') {
    super(message);
    this.name = 'PeriodLockedError';
  }
}

/**
 * Period lock check: throws PeriodLockedError if the period for date is locked/closed.
 * Developer role bypasses the period lock.
 */
export async function assertPeriodOpen(
  tenantId: string,
  appType: string,
  date: Date,
  role?: string,
): Promise<void> {
  const periodKey = getPeriodKey(date);
  const period = await prisma.accountingPeriod.findFirst({
    where: { tenantId, appType, periodKey },
  });
  if (period && ['locked', 'closed'].includes(period.status) && role !== 'developer') {
    throw new PeriodLockedError();
  }
}

/**
 * Compute the next journal entry number for a tenant and entry date based on fiscal year.
 */
export async function assignNextEntryNo(tenantId: string, entryDate: Date): Promise<string> {
  const fyStartMonth = await getFyStartMonth(tenantId); // 1-based
  const fy = getFiscalYear(entryDate, fyStartMonth);
  const fyKey = fy.replace('-', '');
  const startMonth = fyStartMonth - 1; // JS Date month index
  const fyStart = entryDate.getMonth() >= startMonth
    ? new Date(entryDate.getFullYear(), startMonth, 1)
    : new Date(entryDate.getFullYear() - 1, startMonth, 1);
  const existing = await prisma.journalEntry.findMany({
    where: { tenantId, entryNo: { startsWith: `JE-${fyKey}-` }, entryDate: { gte: fyStart } },
    select: { entryNo: true },
    orderBy: { entryNo: 'desc' },
    take: 50,
  });
  const max = existing.reduce((highest, entry) => {
    const next = Number(entry.entryNo?.match(/^JE-\d{6,8}-(\d+)$/)?.[1] ?? 0);
    return Number.isFinite(next) && next > highest ? next : highest;
  }, 0);
  return `JE-${fyKey}-${String(max + 1).padStart(4, '0')}`;
}

