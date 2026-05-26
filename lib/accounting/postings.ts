/**
 * System posting map — maps business events to account codes.
 * Tenants can override per-entry via accountingSettings.postingOverrides (JSON).
 * References accounts by CODE (4 digits), not id, so the seed can be regenerated.
 */
export const POSTING_MAP = {
  LOAN_DISBURSEMENT: {
    debit:  { code: '1310', label: 'Loan Principal Receivable' },
    credit: { code: '1210', label: 'HDFC Current Account' }, // overridden per bank
  },
  COLLECTION_PRINCIPAL: {
    debit:  { code: '1100', label: 'Cash on Hand' },
    credit: { code: '1310', label: 'Loan Principal Receivable' },
  },
  COLLECTION_INTEREST: {
    debit:  { code: '1100', label: 'Cash on Hand' },
    credit: { code: '4100', label: 'Interest Income' },
  },
  PENALTY_ACCRUAL: {
    debit:  { code: '1330', label: 'Penalties Receivable' },
    credit: { code: '4200', label: 'Penalty Income' },
  },
  PENALTY_SETTLEMENT: {
    debit:  { code: '1100', label: 'Cash on Hand' },
    credit: { code: '1330', label: 'Penalties Receivable' },
  },
  CAPITAL_ADD: {
    debit:  { code: '1210', label: 'HDFC Current Account' },
    credit: { code: '3100', label: "Owner's Capital" },
  },
  EXPENSE_GENERIC: {
    debit:  { code: '5900', label: 'Other Expenses' },
    credit: { code: '1100', label: 'Cash on Hand' },
  },
  BILL_POST: {
    debit:  { code: '5900', label: 'Expense (category-specific)' },
    credit: { code: '2110', label: 'Vendor Payables' },
  },
  BILL_PAYMENT: {
    debit:  { code: '2110', label: 'Vendor Payables' },
    credit: { code: '1210', label: 'Bank Account' },
  },
  TDS_ON_PAYMENT: {
    debit:  { code: '2110', label: 'Vendor Payables' },
    credit: { code: '2210', label: 'TDS u/s 194A' },
  },
} as const;

export type PostingKey = keyof typeof POSTING_MAP;

/**
 * Merge tenant overrides (from accountingSettings.postingOverrides JSON) into the default map.
 * Override shape: { "LOAN_DISBURSEMENT": { "credit": { "code": "1220", "label": "SBI" } } }
 */
export function resolvePostingMap(overridesJson: string): typeof POSTING_MAP {
  try {
    const overrides = JSON.parse(overridesJson) as Partial<typeof POSTING_MAP>;
    return { ...POSTING_MAP, ...overrides } as typeof POSTING_MAP;
  } catch {
    return POSTING_MAP;
  }
}

/**
 * Build the dedup key for auto-generated journal entries.
 * Returns null for manual entries.
 */
export function buildDedupKey(sourceType: string, sourceId: string | null | undefined): string | null {
  if (!sourceId || sourceType === 'manual') return null;
  return `${sourceType}:${sourceId}`;
}
