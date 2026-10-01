import prisma from '@/lib/db';

type Line = { label: string; amount: number };

const INVESTING_SOURCES = ['loan_disbursement', 'bank_reconciliation'];
const FINANCING_SOURCES = ['period_close', 'reversal'];

/**
 * ACC-02: the cash-flow statement (opening → operating / investing / financing
 * → closing) shown by the web Cash Flow page and the mobile Cash flow view.
 * Cash accounts = `isCash: true, isActive: true`; posted entries only; scoped
 * to tenant + module + active branch (SCOPE-1..3). `from`/`to` are yyyy-MM-dd.
 */
export async function getCashFlowStatement(
  tenantId: string,
  appType: string,
  branchId: string | null,
  from: string,
  to: string,
) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const cashAccounts = await prisma.account.findMany({ where: { tenantId, isCash: true, isActive: true }, select: { id: true } });
  const cashIds = cashAccounts.map(a => a.id);
  const entryScope = { tenantId, appType, ...(branchId ? { branchId } : {}), status: 'posted' };

  const openingLines = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { accountId: { in: cashIds }, entry: { ...entryScope, entryDate: { lt: fromDate } } },
    _sum: { debit: true, credit: true },
  });
  const openingCash = openingLines.reduce((s, l) => s + Number(l._sum.debit ?? 0) - Number(l._sum.credit ?? 0), 0);

  const periodLines = await prisma.journalLine.findMany({
    where: { accountId: { in: cashIds }, entry: { ...entryScope, entryDate: { gte: fromDate, lte: toDate } } },
    include: { entry: { select: { sourceType: true } } },
  });

  const sourceGroups = new Map<string, number>();
  for (const l of periodLines) {
    const net = Number(l.debit) - Number(l.credit); // positive = cash in
    const src = l.entry.sourceType;
    sourceGroups.set(src, (sourceGroups.get(src) ?? 0) + net);
  }

  const operating: Line[] = [];
  const investing: Line[] = [];
  const financing: Line[] = [];
  for (const [src, amt] of sourceGroups) {
    const label = src.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (INVESTING_SOURCES.includes(src)) investing.push({ label, amount: amt });
    else if (FINANCING_SOURCES.includes(src)) financing.push({ label, amount: amt });
    else operating.push({ label, amount: amt });
  }

  const netOperating = operating.reduce((s, a) => s + a.amount, 0);
  const netInvesting = investing.reduce((s, a) => s + a.amount, 0);
  const netFinancing = financing.reduce((s, a) => s + a.amount, 0);
  const netChange = netOperating + netInvesting + netFinancing;
  const closingCash = openingCash + netChange;

  return { operating, investing, financing, netOperating, netInvesting, netFinancing, netChange, openingCash, closingCash, from, to };
}
