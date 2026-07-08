import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/08-profit-report.md
// Basic (non-premium) operator P&L proxy built from AccountEntry. Does NOT reimplement the
// premium accounting P&L engine — for premium tenants that engine should be wrapped separately.
export async function buildProfitReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const entries = await prisma.accountEntry.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      entryDate: { gte: dateFrom, lte: dateTo },
      type: { in: ['collection', 'expense'] },
    },
    select: { type: true, category: true, amount: true },
  });

  // Income: 'collection' entries. Categorize interest/penalty/fees vs general collection where tagged.
  const incomeByCategory = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();

  entries.forEach((e) => {
    const amt = Number(e.amount);
    if (e.type === 'collection') {
      incomeByCategory.set(e.category, (incomeByCategory.get(e.category) || 0) + amt);
    } else if (e.type === 'expense') {
      expenseByCategory.set(e.category, (expenseByCategory.get(e.category) || 0) + amt);
    }
  });

  const rows: Record<string, any>[] = [];
  let totalIncome = 0;
  let totalExpense = 0;

  Array.from(incomeByCategory.entries()).forEach(([category, amount]) => {
    totalIncome += amount;
    rows.push({ line: 'Income', category, amount });
  });

  Array.from(expenseByCategory.entries()).forEach(([category, amount]) => {
    totalExpense += amount;
    rows.push({ line: 'Expense', category, amount: -amount });
  });

  const netProfit = totalIncome - totalExpense;
  rows.push({ line: 'Net Profit', category: 'total', amount: netProfit });

  const marginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  return {
    title: 'reports.profit.title',
    columns: [
      { key: 'line', label: 'reports.col.line', align: 'left', type: 'text' },
      { key: 'category', label: 'reports.col.category', align: 'left', type: 'badge' },
      { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      amount: netProfit,
    },
    kpis: [
      { label: 'totalIncome', value: totalIncome },
      { label: 'totalExpense', value: totalExpense },
      { label: 'netProfit', value: netProfit, tone: netProfit >= 0 ? 'good' : 'bad' },
      { label: 'margin', value: `${marginPct}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
