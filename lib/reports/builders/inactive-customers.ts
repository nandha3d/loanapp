import prisma from '../../db';
import { getSetting } from '../../tenant';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildInactiveCustomers(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId, to } = params;

  const branchFilter = branchId ? { branchId } : {};

  const asOf = to ? new Date(to) : new Date();
  asOf.setHours(23, 59, 59, 999);

  const windowsSetting = await getSetting(tenantId, 'report_inactive_windows', '60');
  const windows = windowsSetting
    .split(',')
    .map((w) => parseInt(w.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
  const minWindowDays = windows.length > 0 ? windows[0] : 60;

  const customerWhere: any = {
    tenantId,
    appType,
    ...branchFilter,
    ...(agentId ? { agentId } : {}),
  };

  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: {
      id: true,
      name: true,
      phone: true,
      loans: { select: { id: true, status: true, startDate: true } },
      collectionEntries: { select: { submittedAt: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
    },
  });

  function windowLabel(days: number): string {
    let label = `>=${minWindowDays}d`;
    for (const w of windows) {
      if (days >= w) label = `>=${w}d`;
    }
    return label;
  }

  let totalLifetimeLoans = 0;
  const windowCounts: Record<string, number> = {};

  const rows: Record<string, any>[] = [];

  for (const c of customers) {
    const hasActiveLoan = c.loans.some((l) => l.status === 'active');
    if (hasActiveLoan) continue;

    // Most recent activity = latest of (last collection entry, last loan startDate)
    const lastCollectionDate = c.collectionEntries[0]?.submittedAt || null;
    const lastLoanDate = c.loans.reduce<Date | null>((max, l) => {
      if (!max || l.startDate > max) return l.startDate;
      return max;
    }, null);

    let lastActivity: Date | null = null;
    if (lastCollectionDate && lastLoanDate) {
      lastActivity = lastCollectionDate > lastLoanDate ? lastCollectionDate : lastLoanDate;
    } else {
      lastActivity = lastCollectionDate || lastLoanDate;
    }

    if (!lastActivity) continue; // no activity at all — not enough data to classify, skip

    const daysInactive = Math.floor((asOf.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    if (daysInactive < minWindowDays) continue;

    const loanCount = c.loans.length;
    totalLifetimeLoans += loanCount;
    const win = windowLabel(daysInactive);
    windowCounts[win] = (windowCounts[win] || 0) + 1;

    rows.push({
      customerName: c.name,
      phone: c.phone,
      lastLoanDate: lastActivity,
      daysInactive,
      loanCount,
      window: win,
    });
  }

  rows.sort((a, b) => b.daysInactive - a.daysInactive);

  const kpis = [
    { label: 'totalDormant', value: rows.length },
    ...windows.map((w) => ({ label: `inactive_${w}d`, value: windowCounts[`>=${w}d`] || 0 })),
  ];

  return {
    title: 'reports.inactiveCustomers.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'phone', label: 'reports.col.phone', align: 'left', type: 'text' },
      { key: 'lastLoanDate', label: 'reports.col.lastLoan', align: 'center', type: 'date' },
      { key: 'daysInactive', label: 'reports.col.daysInactive', align: 'right', type: 'number' },
      { key: 'loanCount', label: 'reports.col.loans', align: 'right', type: 'number', total: true },
      { key: 'window', label: 'reports.col.window', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      loanCount: totalLifetimeLoans,
    },
    kpis,
    meta: {
      currencySymbol: '₹',
    },
  };
}
