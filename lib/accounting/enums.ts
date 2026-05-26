export const ACCOUNT_CLASSES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

export const ASSET_SUBTYPES = ['cash', 'bank', 'receivable', 'fixed_asset', 'current_asset', 'tax', 'depreciation'] as const;
export const LIABILITY_SUBTYPES = ['payable', 'tax'] as const;
export const EQUITY_SUBTYPES = ['capital', 'reserves'] as const;
export const INCOME_SUBTYPES = ['operating_income', 'other_income'] as const;
export const EXPENSE_SUBTYPES = ['operating_expense', 'depreciation', 'cogs'] as const;

export type AssetSubType = (typeof ASSET_SUBTYPES)[number];
export type LiabilitySubType = (typeof LIABILITY_SUBTYPES)[number];
export type EquitySubType = (typeof EQUITY_SUBTYPES)[number];
export type IncomeSubType = (typeof INCOME_SUBTYPES)[number];
export type ExpenseSubType = (typeof EXPENSE_SUBTYPES)[number];

export const CLASS_SUBTYPES: Record<AccountClass, readonly string[]> = {
  asset: ASSET_SUBTYPES,
  liability: LIABILITY_SUBTYPES,
  equity: EQUITY_SUBTYPES,
  income: INCOME_SUBTYPES,
  expense: EXPENSE_SUBTYPES,
};

/** Assets and expenses have a debit normal side. Everything else credit. */
export function defaultNormalSide(classType: AccountClass): 'debit' | 'credit' {
  return classType === 'asset' || classType === 'expense' ? 'debit' : 'credit';
}

export const JOURNAL_STATUSES = ['draft', 'pending_approval', 'posted', 'reversed', 'rejected'] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export const SOURCE_TYPES = [
  'manual',
  'loan_disbursement',
  'collection',
  'penalty_accrual',
  'penalty_settlement',
  'bill',
  'bill_payment',
  'bank_reconciliation',
  'depreciation',
  'tax_payment',
  'period_close',
  'reversal',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PERIOD_STATUSES = ['open', 'soft_locked', 'locked', 'closed'] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const BILL_STATUSES = ['draft', 'posted', 'partially_paid', 'paid', 'cancelled'] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const TAX_CODES = {
  GST_18: { label: 'GST 18%', rate: 0.18 },
  GST_12: { label: 'GST 12%', rate: 0.12 },
  GST_5: { label: 'GST 5%', rate: 0.05 },
  EXEMPT: { label: 'Exempt', rate: 0 },
  TDS_194A_10: { label: 'TDS 194A 10%', rate: 0.10 },
  TDS_194C_1: { label: 'TDS 194C 1%', rate: 0.01 },
  TDS_194C_2: { label: 'TDS 194C 2%', rate: 0.02 },
  TDS_194J_10: { label: 'TDS 194J 10%', rate: 0.10 },
} as const;
export type TaxCode = keyof typeof TAX_CODES;
