import { z } from 'zod';
import prisma from '@/lib/db';
import { getOrCreateAccountingSettings } from '@/lib/accounting/premium';
import {
  assertPremiumAccountingAccess,
  PremiumAccountingActor,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';

const money = z.number().finite().min(0).refine((value) =>
  Number.isSafeInteger(Math.round(value * 100)) &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.00001);

const schema = z.object({
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  gstin: z.string().max(15).refine((value) => !value || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(value)),
  state: z.string().max(100),
  gstScheme: z.enum(['regular', 'composition', 'exempt']),
  baseCurrency: z.string().length(3),
  postingOverrides: z.string(),
  costCentresEnabled: z.boolean(),
  baseAccountingMode: z.enum(['derive_only', 'mirror', 'replace']),
  showPremiumBannerInBase: z.boolean(),
  adminJeCap: money,
  adminBillCap: money,
  twoLevelApprovalThreshold: money,
  adminCanEditCoA: z.boolean(),
  adminCanLockPeriod: z.boolean(),
  varianceAlertPct: money,
  apOverdueAlertDays: z.number().int().min(0),
  tallyConnectorEnabled: z.boolean(),
  tallyConnectorUrl: z.string().max(2048),
  tallyCompanyName: z.string().max(255),
  allowFutureDated: z.boolean(),
  defaultBankAccountId: z.string(),
  defaultCashAccountId: z.string(),
}).partial().strict();

export function parseAccountingSettingsPatch(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    throw new PremiumAccountingServiceError('Invalid accounting settings', 400);
  }
  const data = parsed.data;
  if (data.postingOverrides !== undefined) {
    try {
      const overrides = JSON.parse(data.postingOverrides);
      if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new Error();
    } catch {
      throw new PremiumAccountingServiceError('invalid_json', 400);
    }
  }
  return data;
}

export async function updateAccountingSettings(actor: PremiumAccountingActor, input: unknown) {
  await assertPremiumAccountingAccess(actor);
  if (!['superadmin', 'developer'].includes(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }
  const data = parseAccountingSettingsPatch(input);
  const settings = await getOrCreateAccountingSettings(actor.tenantId);
  for (const [key, subType] of [
    ['defaultBankAccountId', 'bank'],
    ['defaultCashAccountId', 'cash'],
  ] as const) {
    const id = data[key];
    if (id && id !== settings[key] && !await prisma.account.findFirst({
      where: { id, tenantId: actor.tenantId, isActive: true, subType },
      select: { id: true },
    })) {
      throw new PremiumAccountingServiceError('Account not found', 404);
    }
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.accountingSettings.update({
      where: { id: settings.id },
      data: {
        ...data,
        ...(data.defaultBankAccountId !== undefined ? { defaultBankAccountId: data.defaultBankAccountId || null } : {}),
        ...(data.defaultCashAccountId !== undefined ? { defaultCashAccountId: data.defaultCashAccountId || null } : {}),
      },
    });
    await tx.accountingAuditLog.create({
      data: {
        tenantId: actor.tenantId,
        appType: actor.appType,
        branchId: actor.branchId,
        userId: actor.userId,
        action: 'update',
        entityType: 'settings',
        entityId: settings.id,
        after: JSON.stringify(Object.keys(data)),
      },
    });
    return updated;
  });
}
