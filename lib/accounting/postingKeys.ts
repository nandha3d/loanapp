/**
 * Canonical keys for GL posting overrides. A tenant can remap any of these to
 * their own account code via AccountingSettings.postingOverrides (JSON, e.g.
 * `{ "cash_on_hand": "1105" }`). Unmapped keys fall back to the default CoA
 * codes seeded by lib/accounting/seedDefaultCoA.ts.
 */
export const POSTING_DEFAULTS = {
  loan_receivable: '1310',
  interest_income: '4100',
  cash_on_hand: '1100',
  bank_account: '1200',
  other_expenses: '5900',
  owners_capital: '3100',
} as const;

export type PostingKey = keyof typeof POSTING_DEFAULTS;
