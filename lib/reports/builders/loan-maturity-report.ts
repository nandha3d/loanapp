import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { getSetting } from '../../tenant';

export async function buildLoanMaturityReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId, loanType, status } = params;

  const branchFilter = branchId ? { branchId } : {};

  // Maturity windows are AppSetting-configurable, default "7,30".
  const windowSetting = await getSetting(tenantId, 'report_maturity_windows', '7,30');
  const windows = windowSetting.split(',').map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);

  const asOf = new Date();
  asOf.setHours(0, 0, 0, 0);
  const asOfTime = asOf.getTime();

  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      status: { in: status ? [status] : ['active', 'overdue'] },
      ...(loanType ? { loanType } : {}),
      ...(agentId ? { customer: { agentId } } : {}),
      endDate: { not: null },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { endDate: 'asc' },
  });

  let countToday = 0, outstandingToday = 0;
  const windowCounts = windows.map(() => ({ count: 0, outstanding: 0 }));
  let countMatured = 0, outstandingMatured = 0;

  const rows: Record<string, any>[] = [];
  let totalOutstanding = 0;

  for (const l of loans) {
    if (!l.endDate) continue;
    const endDate = new Date(l.endDate);
    endDate.setHours(0, 0, 0, 0);
    const daysToMaturity = Math.round((endDate.getTime() - asOfTime) / 86400000);

    const payable = Number(l.totalPayable);
    const collected = Number(l.totalCollected || 0);
    const outstanding = Math.max(0, payable - collected);

    let bucket: string;
    if (daysToMaturity < 0 && outstanding > 0) {
      bucket = 'reports.bucket.maturedUnpaid';
      countMatured++;
      outstandingMatured += outstanding;
    } else if (daysToMaturity === 0) {
      bucket = 'reports.bucket.today';
      countToday++;
      outstandingToday += outstanding;
    } else {
      // Find the smallest window the loan falls within.
      let matchedIdx = -1;
      for (let i = 0; i < windows.length; i++) {
        if (daysToMaturity <= windows[i]) {
          matchedIdx = i;
          break;
        }
      }
      if (matchedIdx === -1) {
        // Beyond all configured windows — skip from the bucketed report.
        continue;
      }
      bucket = `reports.bucket.d${windows[matchedIdx]}`;
      windowCounts[matchedIdx].count++;
      windowCounts[matchedIdx].outstanding += outstanding;
    }

    totalOutstanding += outstanding;

    rows.push({
      loanCode: l.loanCode,
      customerName: l.customer.name,
      endDate: l.endDate,
      daysToMaturity,
      outstanding,
      bucket,
    });
  }

  const kpis = [
    { label: 'endingToday', value: countToday },
    ...windows.map((w, i) => ({ label: `next${w}d`, value: windowCounts[i].count })),
    { label: 'maturedUnpaid', value: countMatured, tone: countMatured > 0 ? 'warn' as const : undefined },
  ];

  return {
    title: 'reports.loanMaturity.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanNo', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customer', align: 'left', type: 'text' },
      { key: 'endDate', label: 'reports.col.endDate', align: 'center', type: 'date' },
      { key: 'daysToMaturity', label: 'reports.col.daysToMaturity', align: 'right', type: 'number' },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'bucket', label: 'reports.col.bucket', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      outstanding: totalOutstanding,
    },
    kpis,
    meta: {
      currencySymbol: '₹',
    },
  };
}
