import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/14-cash-book.md
// JournalLine postings restricted to accounts flagged Account.isCash = true, in [from, to],
// with running balance (debit - credit cumulative) and an opening balance computed from all
// cash postings before `from`.
export async function buildCashBook(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Opening balance: all cash postings strictly before the period.
  const priorLines = await prisma.journalLine.findMany({
    where: {
      account: { tenantId, isCash: true },
      entry: { tenantId, ...branchFilter, entryDate: { lt: dateFrom } },
    },
    select: { debit: true, credit: true },
  });
  const opening = priorLines.reduce((sum, l) => sum + (Number(l.debit) - Number(l.credit)), 0);

  const lines = await prisma.journalLine.findMany({
    where: {
      account: { tenantId, isCash: true },
      entry: { tenantId, ...branchFilter, entryDate: { gte: dateFrom, lte: dateTo } },
    },
    include: {
      entry: { select: { entryDate: true, postingDate: true, narration: true } },
    },
    orderBy: [{ entry: { postingDate: 'asc' } }],
  });

  let runningBalance = opening;
  let totalReceipt = 0;
  let totalPayment = 0;

  const rows = lines.map((l) => {
    const receipt = Number(l.debit);
    const payment = Number(l.credit);
    runningBalance += receipt - payment;
    totalReceipt += receipt;
    totalPayment += payment;
    return {
      entryDate: l.entry.entryDate.toISOString().slice(0, 10),
      narration: l.description || l.entry.narration || '',
      receipt,
      payment,
      balance: runningBalance,
    };
  });

  const closing = runningBalance;

  return {
    title: 'reports.cashBook.title',
    columns: [
      { key: 'entryDate', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'narration', label: 'reports.col.particulars', align: 'left', type: 'text' },
      { key: 'receipt', label: 'reports.col.receipt', align: 'right', type: 'currency', total: true },
      { key: 'payment', label: 'reports.col.payment', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
    ],
    rows,
    totals: {
      receipt: totalReceipt,
      payment: totalPayment,
    },
    kpis: [
      { label: 'openingCash', value: opening },
      { label: 'totalReceipts', value: totalReceipt },
      { label: 'totalPayments', value: totalPayment },
      { label: 'closingCash', value: closing },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
