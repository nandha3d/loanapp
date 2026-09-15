import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/14-bank-book.md
// JournalLine postings against the tenant's BankAccount.ledgerAccountId values, in range,
// listed per bank account with running balance. Reconciliation status is read from
// BankStatementLine.matchedJournalLineId (set => reconciled) where available.
export async function buildBankBook(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { tenantId, isActive: true, ...branchFilter },
    select: { id: true, name: true, ledgerAccountId: true },
  });

  if (bankAccounts.length === 0) {
    return {
      title: 'reports.bankBook.title',
      columns: [
        { key: 'entryDate', label: 'reports.col.date', align: 'left', type: 'date' },
        { key: 'bankAccountName', label: 'reports.col.bankAccount', align: 'left', type: 'text' },
        { key: 'narration', label: 'reports.col.particulars', align: 'left', type: 'text' },
        { key: 'deposit', label: 'reports.col.deposit', align: 'right', type: 'currency', total: true },
        { key: 'withdrawal', label: 'reports.col.withdrawal', align: 'right', type: 'currency', total: true },
        { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
        { key: 'reconciled', label: 'reports.col.reconciled', align: 'center', type: 'badge' },
      ],
      rows: [],
      totals: { deposit: 0, withdrawal: 0 },
      kpis: [],
      meta: { currencySymbol: '₹' },
    };
  }

  const ledgerAccountIds = bankAccounts.map((b) => b.ledgerAccountId);
  const ledgerToBank = new Map(bankAccounts.map((b) => [b.ledgerAccountId, b.name]));

  const priorLines = await prisma.journalLine.findMany({
    where: {
      accountId: { in: ledgerAccountIds },
      entry: { tenantId, entryDate: { lt: dateFrom } },
    },
    select: { accountId: true, debit: true, credit: true },
  });
  const openingByAccount = new Map<string, number>();
  priorLines.forEach((l) => {
    const cur = openingByAccount.get(l.accountId) || 0;
    openingByAccount.set(l.accountId, cur + Number(l.debit) - Number(l.credit));
  });

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: { in: ledgerAccountIds },
      entry: { tenantId, entryDate: { gte: dateFrom, lte: dateTo } },
    },
    include: {
      entry: { select: { entryDate: true, postingDate: true, narration: true } },
      bankStatementLine: { select: { id: true, status: true } },
    },
    orderBy: [{ accountId: 'asc' }, { entry: { postingDate: 'asc' } }],
  });

  const runningByAccount = new Map<string, number>(openingByAccount);
  let totalDeposit = 0;
  let totalWithdrawal = 0;
  let unreconciledCount = 0;

  const rows = lines.map((l) => {
    const deposit = Number(l.debit);
    const withdrawal = Number(l.credit);
    totalDeposit += deposit;
    totalWithdrawal += withdrawal;
    const running = (runningByAccount.get(l.accountId) || 0) + deposit - withdrawal;
    runningByAccount.set(l.accountId, running);
    const reconciled = l.bankStatementLine?.status === 'matched';
    if (!reconciled) unreconciledCount++;
    return {
      entryDate: l.entry.entryDate.toISOString().slice(0, 10),
      bankAccountName: ledgerToBank.get(l.accountId) || '',
      narration: l.description || l.entry.narration || '',
      deposit,
      withdrawal,
      balance: running,
      reconciled: reconciled ? 'Reconciled' : 'Unreconciled',
    };
  });

  const openingTotal = Array.from(openingByAccount.values()).reduce((s, v) => s + v, 0);
  const closingTotal = Array.from(runningByAccount.values()).reduce((s, v) => s + v, 0);

  return {
    title: 'reports.bankBook.title',
    columns: [
      { key: 'entryDate', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'bankAccountName', label: 'reports.col.bankAccount', align: 'left', type: 'text' },
      { key: 'narration', label: 'reports.col.particulars', align: 'left', type: 'text' },
      { key: 'deposit', label: 'reports.col.deposit', align: 'right', type: 'currency', total: true },
      { key: 'withdrawal', label: 'reports.col.withdrawal', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
      { key: 'reconciled', label: 'reports.col.reconciled', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      deposit: totalDeposit,
      withdrawal: totalWithdrawal,
    },
    kpis: [
      { label: 'opening', value: openingTotal },
      { label: 'totalDeposits', value: totalDeposit },
      { label: 'totalWithdrawals', value: totalWithdrawal },
      { label: 'closing', value: closingTotal },
      { label: 'unreconciledCount', value: unreconciledCount, tone: unreconciledCount > 0 ? 'warn' : 'good' },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
