import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/14-ledger-report.md
// Per-account general ledger with running balance, scoped by Account.normalSide.
//
// NOTE: ReportBuilderParams has no dedicated `accountId` field. Per task instruction, the
// `loanId` param slot is reused to carry the target accountId for this single builder —
// callers must pass the chart-of-accounts Account.id in `params.loanId`.
export async function buildLedgerReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId, loanId: accountId } = params;

  if (!accountId) {
    return {
      title: 'reports.ledger.title',
      columns: [
        { key: 'entryDate', label: 'reports.col.date', align: 'left', type: 'date' },
        { key: 'voucherType', label: 'reports.col.voucher', align: 'left', type: 'text' },
        { key: 'narration', label: 'reports.col.narration', align: 'left', type: 'text' },
        { key: 'debit', label: 'reports.col.debit', align: 'right', type: 'currency', total: true },
        { key: 'credit', label: 'reports.col.credit', align: 'right', type: 'currency', total: true },
        { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
      ],
      rows: [],
      totals: { debit: 0, credit: 0 },
      kpis: [],
      meta: { currencySymbol: '₹' },
    };
  }

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId },
    select: { name: true, normalSide: true },
  });
  const normalSide = account?.normalSide || 'debit';
  const sign = (debit: number, credit: number) => (normalSide === 'credit' ? credit - debit : debit - credit);

  const priorLines = await prisma.journalLine.findMany({
    where: {
      accountId,
      entry: { tenantId, ...branchFilter, entryDate: { lt: dateFrom } },
    },
    select: { debit: true, credit: true },
  });
  const opening = priorLines.reduce((sum, l) => sum + sign(Number(l.debit), Number(l.credit)), 0);

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      entry: { tenantId, ...branchFilter, entryDate: { gte: dateFrom, lte: dateTo } },
    },
    include: {
      entry: { select: { entryDate: true, postingDate: true, voucherType: true, narration: true } },
    },
    orderBy: [{ entry: { postingDate: 'asc' } }],
  });

  let runningBalance = opening;
  let totalDebit = 0;
  let totalCredit = 0;

  const rows = lines.map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    totalDebit += debit;
    totalCredit += credit;
    runningBalance += sign(debit, credit);
    return {
      entryDate: l.entry.entryDate.toISOString().slice(0, 10),
      voucherType: l.entry.voucherType,
      narration: l.description || l.entry.narration || '',
      debit,
      credit,
      balance: runningBalance,
    };
  });

  const closing = runningBalance;

  return {
    title: 'reports.ledger.title',
    columns: [
      { key: 'entryDate', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'voucherType', label: 'reports.col.voucher', align: 'left', type: 'text' },
      { key: 'narration', label: 'reports.col.narration', align: 'left', type: 'text' },
      { key: 'debit', label: 'reports.col.debit', align: 'right', type: 'currency', total: true },
      { key: 'credit', label: 'reports.col.credit', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
    ],
    rows,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
    },
    kpis: [
      { label: 'opening', value: opening },
      { label: 'totalDebit', value: totalDebit },
      { label: 'totalCredit', value: totalCredit },
      { label: 'closing', value: closing },
    ],
    meta: {
      currencySymbol: '₹',
      branchName: account?.name,
    },
  };
}
