type JournalLineInput = { accountId?: unknown; debit?: unknown; credit?: unknown };

export function validateManualJournalLines(lines: unknown, posting: boolean): string | null {
  if (!Array.isArray(lines)) return 'invalid_lines';
  let debitCents = 0;
  let creditCents = 0;
  let meaningful = 0;
  for (const line of lines as JournalLineInput[]) {
    if (!line || typeof line.accountId !== 'string' || !line.accountId) return 'invalid_lines';
    if ((line.debit != null && typeof line.debit !== 'number') ||
        (line.credit != null && typeof line.credit !== 'number')) return 'invalid_lines';
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 ||
        !Number.isSafeInteger(Math.round(debit * 100)) || !Number.isSafeInteger(Math.round(credit * 100)) ||
        Math.abs(debit * 100 - Math.round(debit * 100)) > 0.00001 ||
        Math.abs(credit * 100 - Math.round(credit * 100)) > 0.00001 ||
        (debit > 0 && credit > 0)) return 'invalid_lines';
    debitCents += Math.round(debit * 100);
    creditCents += Math.round(credit * 100);
    if (debit > 0 || credit > 0) meaningful++;
  }
  if (!posting) return null;
  if (meaningful < 2) return 'min_lines';
  if (debitCents === 0) return 'empty_entry';
  if (debitCents !== creditCents) return 'not_balanced';
  return null;
}
