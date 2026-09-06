import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/08-penalty-income-report.md
// Wraps the existing Penalty model (gross/settled/waived) grouped by settlement date.
export async function buildPenaltyIncomeReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const penalties = await prisma.penalty.findMany({
    where: {
      settledAt: { gte: dateFrom, lte: dateTo },
      loan: { tenantId, appType, ...branchFilter },
    },
    select: { settledAt: true, grossPenalty: true, settledAmount: true, waivedAmount: true },
    orderBy: { settledAt: 'asc' },
  });

  const groupMap = new Map<string, { accrued: number; settled: number; waived: number }>();

  penalties.forEach((p) => {
    const key = (p.settledAt as Date).toISOString().slice(0, 10);
    if (!groupMap.has(key)) groupMap.set(key, { accrued: 0, settled: 0, waived: 0 });
    const item = groupMap.get(key)!;
    item.accrued += Number(p.grossPenalty);
    item.settled += Number(p.settledAmount);
    item.waived += Number(p.waivedAmount);
  });

  let grandAccrued = 0;
  let grandSettled = 0;
  let grandWaived = 0;
  let grandOutstanding = 0;

  const rows = Array.from(groupMap.entries()).map(([period, item]) => {
    const outstanding = Math.max(0, item.accrued - item.settled - item.waived);
    grandAccrued += item.accrued;
    grandSettled += item.settled;
    grandWaived += item.waived;
    grandOutstanding += outstanding;
    return {
      period,
      accrued: item.accrued,
      settled: item.settled,
      waived: item.waived,
      outstanding,
    };
  });

  const realizationPct = grandAccrued > 0 ? Math.round((grandSettled / grandAccrued) * 100) : 0;

  return {
    title: 'reports.penaltyIncome.title',
    columns: [
      { key: 'period', label: 'reports.col.period', align: 'left', type: 'text' },
      { key: 'accrued', label: 'reports.col.accrued', align: 'right', type: 'currency', total: true },
      { key: 'settled', label: 'reports.col.settled', align: 'right', type: 'currency', total: true },
      { key: 'waived', label: 'reports.col.waived', align: 'right', type: 'currency', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      accrued: grandAccrued,
      settled: grandSettled,
      waived: grandWaived,
      outstanding: grandOutstanding,
    },
    kpis: [
      { label: 'penaltyIncome', value: grandSettled },
      { label: 'waivedTotal', value: grandWaived },
      { label: 'realizationRate', value: `${realizationPct}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
