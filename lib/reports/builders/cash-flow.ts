import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildCashFlow(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Fetch entries
  const entries = await prisma.accountEntry.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      entryDate: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { entryDate: 'asc' },
  });

  // Group by Date (YYYY-MM-DD)
  const groupMap = new Map<string, { inflow: number; outflow: number }>();

  entries.forEach((e) => {
    const key = e.entryDate.toISOString().slice(0, 10);
    if (!groupMap.has(key)) {
      groupMap.set(key, { inflow: 0, outflow: 0 });
    }

    const item = groupMap.get(key)!;
    const amount = Number(e.amount);

    if (['collection', 'capital_add'].includes(e.type)) {
      item.inflow += amount;
    } else if (['loan_disburse', 'expense', 'capital_withdraw'].includes(e.type)) {
      item.outflow += amount;
    }
  });

  let runningBalance = 0;
  let grandInflow = 0;
  let grandOutflow = 0;
  let grandNet = 0;

  const rows = Array.from(groupMap.entries()).map(([dateStr, item]) => {
    const net = item.inflow - item.outflow;
    runningBalance += net;

    grandInflow += item.inflow;
    grandOutflow += item.outflow;
    grandNet += net;

    return {
      bucket: dateStr,
      inflow: item.inflow,
      outflow: item.outflow,
      net,
      balance: runningBalance,
    };
  });

  return {
    title: 'reports.cashFlow.title',
    columns: [
      { key: 'bucket', label: 'reports.col.period', align: 'left', type: 'text' },
      { key: 'inflow', label: 'reports.col.moneyIn', align: 'right', type: 'currency', total: true },
      { key: 'outflow', label: 'reports.col.moneyOut', align: 'right', type: 'currency', total: true },
      { key: 'net', label: 'reports.col.net', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.runningBalance', align: 'right', type: 'currency' },
    ],
    rows,
    totals: {
      inflow: grandInflow,
      outflow: grandOutflow,
      net: grandNet,
    },
    kpis: [
      { label: 'totalCashInflow', value: grandInflow },
      { label: 'totalCashOutflow', value: grandOutflow },
      { label: 'netCashFlow', value: grandNet },
      { label: 'closingBalance', value: runningBalance },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
