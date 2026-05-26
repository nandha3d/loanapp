'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';

export async function getCashFlowData(from: string, to: string) {
  const tenantId = await getDefaultTenantId();
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Get cash/bank accounts
  const cashAccounts = await prisma.account.findMany({ where: { tenantId, isCash: true, isActive: true }, select: { id: true, code: true, name: true } });
  const cashIds = new Set(cashAccounts.map(a => a.id));

  // Opening cash balance (all entries before from)
  const openingLines = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { accountId: { in: [...cashIds] }, entry: { tenantId, status: 'posted', entryDate: { lt: fromDate } } },
    _sum: { debit: true, credit: true },
  });
  const openingCash = openingLines.reduce((s, l) => s + Number(l._sum.debit ?? 0) - Number(l._sum.credit ?? 0), 0);

  // Period lines for cash accounts
  const periodLines = await prisma.journalLine.findMany({
    where: { accountId: { in: [...cashIds] }, entry: { tenantId, status: 'posted', entryDate: { gte: fromDate, lte: toDate } } },
    include: { entry: { select: { sourceType: true, narration: true, entryDate: true } } },
  });

  // Classify by source type
  const operating: Array<{ label: string; amount: number }> = [];
  const investing: Array<{ label: string; amount: number }> = [];
  const financing: Array<{ label: string; amount: number }> = [];

  const sourceGroups = new Map<string, number>();
  for (const l of periodLines) {
    const net = Number(l.debit) - Number(l.credit); // positive = cash in
    const src = l.entry.sourceType;
    sourceGroups.set(src, (sourceGroups.get(src) ?? 0) + net);
  }

  const operatingSources = ['collection', 'penalty_settlement', 'manual', 'bill_payment', 'depreciation', 'tax_payment'];
  const investingSources = ['loan_disbursement', 'bank_reconciliation'];
  const financingSources = ['period_close', 'reversal'];

  for (const [src, amt] of sourceGroups) {
    const label = src.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (investingSources.includes(src)) investing.push({ label, amount: amt });
    else if (financingSources.includes(src)) financing.push({ label, amount: amt });
    else operating.push({ label, amount: amt });
  }

  const netOperating = operating.reduce((s, a) => s + a.amount, 0);
  const netInvesting = investing.reduce((s, a) => s + a.amount, 0);
  const netFinancing = financing.reduce((s, a) => s + a.amount, 0);
  const netChange = netOperating + netInvesting + netFinancing;
  const closingCash = openingCash + netChange;

  return JSON.parse(JSON.stringify({ operating, investing, financing, netOperating, netInvesting, netFinancing, netChange, openingCash, closingCash, from, to }));
}
