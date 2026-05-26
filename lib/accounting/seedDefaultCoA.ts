import { prisma } from '@/lib/db';
import { defaultNormalSide } from './enums';

type SeedAccount = {
  code: string;
  name: string;
  classType: string;
  subType?: string;
  isCash?: boolean;
  parentCode?: string;
};

export const DEFAULT_COA: SeedAccount[] = [
  // Assets
  { code: '1000', name: 'Assets', classType: 'asset' },
  { code: '1100', name: 'Cash on Hand', classType: 'asset', subType: 'cash', isCash: true, parentCode: '1000' },
  { code: '1110', name: 'Petty Cash', classType: 'asset', subType: 'cash', isCash: true, parentCode: '1100' },
  { code: '1200', name: 'Bank Accounts', classType: 'asset', subType: 'bank', isCash: true, parentCode: '1000' },
  { code: '1210', name: 'HDFC Current Account', classType: 'asset', subType: 'bank', isCash: true, parentCode: '1200' },
  { code: '1220', name: 'SBI Current Account', classType: 'asset', subType: 'bank', isCash: true, parentCode: '1200' },
  { code: '1300', name: 'Loans Receivable', classType: 'asset', subType: 'receivable', parentCode: '1000' },
  { code: '1310', name: 'Loan Principal Receivable', classType: 'asset', subType: 'receivable', parentCode: '1300' },
  { code: '1320', name: 'Loan Interest Receivable', classType: 'asset', subType: 'receivable', parentCode: '1300' },
  { code: '1330', name: 'Penalties Receivable', classType: 'asset', subType: 'receivable', parentCode: '1300' },
  { code: '1400', name: 'Input GST', classType: 'asset', subType: 'tax', parentCode: '1000' },
  { code: '1410', name: 'Input CGST', classType: 'asset', subType: 'tax', parentCode: '1400' },
  { code: '1420', name: 'Input SGST', classType: 'asset', subType: 'tax', parentCode: '1400' },
  { code: '1430', name: 'Input IGST', classType: 'asset', subType: 'tax', parentCode: '1400' },
  { code: '1500', name: 'Fixed Assets', classType: 'asset', subType: 'fixed_asset', parentCode: '1000' },
  { code: '1510', name: 'Office Equipment', classType: 'asset', subType: 'fixed_asset', parentCode: '1500' },
  { code: '1520', name: 'Vehicles', classType: 'asset', subType: 'fixed_asset', parentCode: '1500' },
  { code: '1900', name: 'Accumulated Depreciation', classType: 'asset', subType: 'depreciation', parentCode: '1000' },
  // Liabilities
  { code: '2000', name: 'Liabilities', classType: 'liability' },
  { code: '2100', name: 'Bills Payable', classType: 'liability', subType: 'payable', parentCode: '2000' },
  { code: '2110', name: 'Vendor Payables', classType: 'liability', subType: 'payable', parentCode: '2100' },
  { code: '2200', name: 'TDS Payable', classType: 'liability', subType: 'tax', parentCode: '2000' },
  { code: '2210', name: 'TDS u/s 194A', classType: 'liability', subType: 'tax', parentCode: '2200' },
  { code: '2300', name: 'Output GST', classType: 'liability', subType: 'tax', parentCode: '2000' },
  { code: '2310', name: 'Output CGST', classType: 'liability', subType: 'tax', parentCode: '2300' },
  { code: '2320', name: 'Output SGST', classType: 'liability', subType: 'tax', parentCode: '2300' },
  { code: '2330', name: 'Output IGST', classType: 'liability', subType: 'tax', parentCode: '2300' },
  { code: '2400', name: 'Bank Loans', classType: 'liability', subType: 'payable', parentCode: '2000' },
  { code: '2500', name: 'Accrued Expenses', classType: 'liability', subType: 'payable', parentCode: '2000' },
  // Equity
  { code: '3000', name: 'Equity', classType: 'equity' },
  { code: '3100', name: "Owner's Capital", classType: 'equity', subType: 'capital', parentCode: '3000' },
  { code: '3200', name: 'Retained Earnings', classType: 'equity', subType: 'reserves', parentCode: '3000' },
  { code: '3300', name: 'Current Year Earnings', classType: 'equity', subType: 'reserves', parentCode: '3000' },
  // Income
  { code: '4000', name: 'Income', classType: 'income' },
  { code: '4100', name: 'Interest Income', classType: 'income', subType: 'operating_income', parentCode: '4000' },
  { code: '4200', name: 'Penalty Income', classType: 'income', subType: 'operating_income', parentCode: '4000' },
  { code: '4300', name: 'Processing Fees', classType: 'income', subType: 'operating_income', parentCode: '4000' },
  { code: '4900', name: 'Other Income', classType: 'income', subType: 'other_income', parentCode: '4000' },
  // Expenses
  { code: '5000', name: 'Expenses', classType: 'expense' },
  { code: '5100', name: 'Salaries & Wages', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
  { code: '5200', name: 'Rent', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
  { code: '5300', name: 'Utilities', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
  { code: '5400', name: 'Travel & Conveyance', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
  { code: '5500', name: 'Marketing', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
  { code: '5600', name: 'Bank Charges', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
  { code: '5700', name: 'Bad Debts', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
  { code: '5800', name: 'Depreciation Expense', classType: 'expense', subType: 'depreciation', parentCode: '5000' },
  { code: '5900', name: 'Other Expenses', classType: 'expense', subType: 'operating_expense', parentCode: '5000' },
];

/**
 * Seed the default Chart of Accounts for a tenant.
 * Idempotent — only creates accounts that don't exist yet.
 * Returns { created, skipped }.
 */
export async function seedDefaultCoA(tenantId: string): Promise<{ created: number; skipped: number }> {
  // Build a map of existing codes
  const existing = await prisma.account.findMany({
    where: { tenantId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((a) => a.code));

  // Build code→id map for parent resolution (we'll create root accounts first)
  const codeToId = new Map<string, string>();

  let created = 0;
  let skipped = 0;

  // Sort by code so parents are always created before children
  const sorted = [...DEFAULT_COA].sort((a, b) => a.code.localeCompare(b.code));

  for (const acc of sorted) {
    if (existingCodes.has(acc.code)) {
      skipped++;
      // Still need to populate codeToId for children
      const full = await prisma.account.findUnique({
        where: { tenantId_code: { tenantId, code: acc.code } },
        select: { id: true },
      });
      if (full) codeToId.set(acc.code, full.id);
      continue;
    }

    const parentId = acc.parentCode ? codeToId.get(acc.parentCode) : undefined;

    const newAcc = await prisma.account.create({
      data: {
        tenantId,
        code: acc.code,
        name: acc.name,
        classType: acc.classType,
        subType: acc.subType,
        normalSide: defaultNormalSide(acc.classType as 'asset' | 'liability' | 'equity' | 'income' | 'expense'),
        isCash: acc.isCash ?? false,
        isSystem: true,
        parentId: parentId ?? null,
      },
      select: { id: true },
    });

    codeToId.set(acc.code, newAcc.id);
    created++;
  }

  return { created, skipped };
}
