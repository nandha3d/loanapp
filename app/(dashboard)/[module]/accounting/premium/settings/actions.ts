'use server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { writeAuditLog, getOrCreateAccountingSettings } from '@/lib/accounting/premium';

export async function getSettings() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  return getOrCreateAccountingSettings(tenantId);
}

export async function updateSettings(input: Partial<{
  fiscalYearStartMonth: number;
  gstin: string;
  state: string;
  gstScheme: string;
  baseCurrency: string;
  postingOverrides: string;
  costCentresEnabled: boolean;
  baseAccountingMode: string;
  showPremiumBannerInBase: boolean;
  adminJeCap: number;
  adminBillCap: number;
  twoLevelApprovalThreshold: number;
  adminCanEditCoA: boolean;
  adminCanLockPeriod: boolean;
  varianceAlertPct: number;
  apOverdueAlertDays: number;
  tallyConnectorEnabled: boolean;
  tallyConnectorUrl: string;
  tallyCompanyName: string;
  allowFutureDated: boolean;
  defaultBankAccountId: string;
  defaultCashAccountId: string;
}>) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  // Validate GSTIN if provided
  if (input.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(input.gstin)) {
    return { ok: false, error: 'gstinInvalid' };
  }

  // Validate posting overrides JSON
  if (input.postingOverrides) {
    try { JSON.parse(input.postingOverrides); } catch { return { ok: false, error: 'invalid_json' }; }
  }

  const settings = await getOrCreateAccountingSettings(tenantId);
  await prisma.accountingSettings.update({
    where: { id: settings.id },
    data: {
      fiscalYearStartMonth: input.fiscalYearStartMonth,
      gstin: input.gstin,
      state: input.state,
      gstScheme: input.gstScheme,
      baseCurrency: input.baseCurrency,
      postingOverrides: input.postingOverrides,
      costCentresEnabled: input.costCentresEnabled,
      baseAccountingMode: input.baseAccountingMode,
      showPremiumBannerInBase: input.showPremiumBannerInBase,
      adminJeCap: input.adminJeCap,
      adminBillCap: input.adminBillCap,
      twoLevelApprovalThreshold: input.twoLevelApprovalThreshold,
      adminCanEditCoA: input.adminCanEditCoA,
      adminCanLockPeriod: input.adminCanLockPeriod,
      varianceAlertPct: input.varianceAlertPct,
      apOverdueAlertDays: input.apOverdueAlertDays,
      tallyConnectorEnabled: input.tallyConnectorEnabled,
      tallyConnectorUrl: input.tallyConnectorUrl,
      tallyCompanyName: input.tallyCompanyName,
      allowFutureDated: input.allowFutureDated,
      defaultBankAccountId: input.defaultBankAccountId || null,
      defaultCashAccountId: input.defaultCashAccountId || null,
    },
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'update', entityType: 'settings', entityId: settings.id });
  return { ok: true };
}

/** One-time migration: AccountEntry → JournalEntry (double-entry) */
export async function migrateBasicAccountingData(): Promise<{ ok: boolean; imported: number; skipped: number; error?: string }> {
  const session = await auth();
  if (!session) return { ok: false, imported: 0, skipped: 0, error: 'Unauthorized' };
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) return { ok: false, imported: 0, skipped: 0, error: 'Insufficient role' };

  const tenantId = await getDefaultTenantId();

  // Load all basic entries
  const entries = await prisma.accountEntry.findMany({ where: { tenantId }, orderBy: { entryDate: 'asc' } });
  if (entries.length === 0) return { ok: true, imported: 0, skipped: 0 };

  // Find accounts by code (CoA must be seeded first)
  const accounts = await prisma.account.findMany({
    where: { tenantId, code: { in: ['1100','1200','1310','1320','3100','4100','4200','5900'] } },
    select: { id: true, code: true },
  });
  const acct = Object.fromEntries(accounts.map(a => [a.code, a.id]));

  // Require core accounts
  if (!acct['1100'] || !acct['3100'] || !acct['1310'] || !acct['4100'] || !acct['5900']) {
    return { ok: false, imported: 0, skipped: 0, error: 'Chart of Accounts not seeded. Please initialise CoA first from Settings → Chart of Accounts.' };
  }

  // Check already migrated (narration contains tag)
  const existingNarrations = await prisma.journalEntry.findMany({
    where: { tenantId, narration: { contains: '[BASIC:' } },
    select: { narration: true },
  });
  const migratedIds = new Set(
    existingNarrations.flatMap(je => {
      const match = je.narration?.match(/\[BASIC:([^\]]+)\]/);
      return match ? [match[1]] : [];
    })
  );

  // Category → prefer bank account if bank/upi, else cash
  const cashId = acct['1100'];
  const bankId = acct['1200'] ?? cashId;
  const mapCategoryToAccount = (cat: string) =>
    ['bank','upi','neft','rtgs','imps'].includes(cat) ? bankId : cashId;

  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (migratedIds.has(entry.id)) { skipped++; continue; }

    const amt = Number(entry.amount);
    const date = entry.entryDate;
    const cat = (entry.category ?? 'cash').toLowerCase();
    const cashAcct = mapCategoryToAccount(cat);
    const narration = `${entry.description ?? entry.type} [BASIC:${entry.id}]`;

    // Build debit/credit lines based on entry type
    type JELine = { accountId: string; debit: number; credit: number; narration: string };
    let lines: JELine[] = [];

    switch (entry.type) {
      case 'capital_add':
        // Dr Cash/Bank Cr Owner's Capital
        lines = [
          { accountId: cashAcct, debit: amt, credit: 0, narration },
          { accountId: acct['3100'], debit: 0, credit: amt, narration },
        ]; break;
      case 'capital_withdraw':
        // Dr Owner's Capital Cr Cash/Bank
        lines = [
          { accountId: acct['3100'], debit: amt, credit: 0, narration },
          { accountId: cashAcct, debit: 0, credit: amt, narration },
        ]; break;
      case 'loan_disburse':
        // Dr Loan Principal Receivable Cr Cash/Bank
        lines = [
          { accountId: acct['1310'], debit: amt, credit: 0, narration },
          { accountId: cashAcct, debit: 0, credit: amt, narration },
        ]; break;
      case 'collection':
        // Dr Cash/Bank Cr Loan Principal Receivable
        // Basic doesn't split principal/interest, map entire amount to receivable
        lines = [
          { accountId: cashAcct, debit: amt, credit: 0, narration },
          { accountId: acct['1310'], debit: 0, credit: amt, narration },
        ]; break;
      case 'expense':
        // Dr Other Expenses Cr Cash/Bank
        lines = [
          { accountId: acct['5900'], debit: amt, credit: 0, narration },
          { accountId: cashAcct, debit: 0, credit: amt, narration },
        ]; break;
      default:
        // adjustment / unknown — Dr/Cr Other Income or Expenses depending on sign
        skipped++; continue;
    }

    const creatorId = entry.createdBy ?? session.user?.id!;
    await prisma.journalEntry.create({
      data: {
        tenantId,
        entryDate: date,
        narration,
        status: 'posted',
        sourceType: 'basic_migration',
        createdById: creatorId,
        lines: {
          create: lines.map((l, i) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.narration,
            lineNo: i + 1,
          })),
        },
      },
    });
    imported++;
  }

  return { ok: true, imported, skipped };
}

export async function getMigrationStats(): Promise<{ basicEntries: number; migratedCount: number }> {
  const session = await auth();
  if (!session) return { basicEntries: 0, migratedCount: 0 };
  const tenantId = await getDefaultTenantId();
  const [basicEntries, migratedCount] = await Promise.all([
    prisma.accountEntry.count({ where: { tenantId } }),
    prisma.journalEntry.count({ where: { tenantId, sourceType: 'basic_migration' } }),
  ]);
  return { basicEntries, migratedCount };
}

export async function getBankAndCashAccounts() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const accounts = await prisma.account.findMany({
    where: { tenantId, isActive: true, subType: { in: ['cash','bank'] } },
    select: { id: true, code: true, name: true, subType: true },
    orderBy: { code: 'asc' },
  });

  return { bankAccounts: accounts.filter(a => a.subType === 'bank'), cashAccounts: accounts.filter(a => a.subType === 'cash') };
}
