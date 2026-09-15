import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/14-day-book.md
// Single-day chronological listing of all JournalLine postings (joined to JournalEntry).
// Uses `from` as the target day, ignores `to` (per task instruction).
export async function buildDayBook(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, branchId } = params;

  const dayStart = new Date(from);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(from);
  dayEnd.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const lines = await prisma.journalLine.findMany({
    where: {
      entry: {
        tenantId,
        ...branchFilter,
        entryDate: { gte: dayStart, lte: dayEnd },
      },
    },
    include: {
      entry: { select: { entryDate: true, postingDate: true, voucherType: true, narration: true } },
      account: { select: { name: true } },
    },
    orderBy: [{ entry: { postingDate: 'asc' } }],
  });

  let totalDebit = 0;
  let totalCredit = 0;

  const rows = lines.map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    totalDebit += debit;
    totalCredit += credit;
    return {
      entryDate: l.entry.postingDate.toISOString(),
      voucherType: l.entry.voucherType,
      accountName: l.account.name,
      narration: l.description || l.entry.narration || '',
      debit,
      credit,
    };
  });

  return {
    title: 'reports.dayBook.title',
    columns: [
      { key: 'entryDate', label: 'reports.col.time', align: 'left', type: 'date' },
      { key: 'voucherType', label: 'reports.col.voucher', align: 'left', type: 'text' },
      { key: 'accountName', label: 'reports.col.account', align: 'left', type: 'text' },
      { key: 'narration', label: 'reports.col.narration', align: 'left', type: 'text' },
      { key: 'debit', label: 'reports.col.debit', align: 'right', type: 'currency', total: true },
      { key: 'credit', label: 'reports.col.credit', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
    },
    kpis: [
      { label: 'entriesToday', value: rows.length },
      { label: 'totalDebit', value: totalDebit },
      { label: 'totalCredit', value: totalCredit, tone: totalDebit === totalCredit ? 'good' : 'bad' },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
