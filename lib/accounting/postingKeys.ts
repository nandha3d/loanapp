/**
 * Canonical keys for GL posting overrides. A tenant can remap any of these to
 * their own account code via AccountingSettings.postingOverrides (JSON, e.g.
 * `{ "cash_on_hand": "1105" }`). Unmapped keys fall back to the default CoA
 * codes seeded by lib/accounting/seedDefaultCoA.ts.
 */
export const POSTING_DEFAULTS = {
  loan_receivable: '1310',
  interest_income: '4100',
  processing_fee_income: '4300',
  cash_on_hand: '1100',
  bank_account: '1200',
  other_expenses: '5900',
  owners_capital: '3100',
} as const;

export type PostingKey = keyof typeof POSTING_DEFAULTS;

/**
 * Builds the value for `JournalEntry.dedupKey`, which carries a UNIQUE index —
 * so a re-run of an auto-posting path is rejected by the database rather than
 * by a read-then-write check that two concurrent callers can both pass.
 *
 * Tenant-qualified because the unique index is global, and because that is the
 * shape already persisted by the loan-origination posting. Returns null for
 * manual entries, which are allowed to repeat.
 */
export function buildDedupKey(
  sourceType: string,
  tenantId: string,
  sourceId: string | null | undefined,
): string | null {
  if (!sourceId || sourceType === 'manual') return null;
  return `${sourceType}:${tenantId}:${sourceId}`;
}

/** True when a write failed the `dedupKey` unique index — i.e. already posted. */
export function isDuplicateJournalEntry(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}
