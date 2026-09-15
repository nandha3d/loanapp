import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { getSetting } from '../../tenant';

export async function buildHighRiskCustomers(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId, loanType } = params;

  const branchFilter = branchId ? { branchId } : {};

  const weightsSetting = await getSetting(tenantId, 'report_risk_weights', '40,30,30');
  const [wOverdue, wMissed, wOutstanding] = weightsSetting.split(',').map(Number);
  const weightTotal = (wOverdue || 0) + (wMissed || 0) + (wOutstanding || 0) || 1;

  const thresholdSetting = await getSetting(tenantId, 'report_high_risk_threshold', '60');
  const threshold = Number(thresholdSetting) || 60;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Active/overdue loans, scoped, with the signals needed for scoring.
  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      status: { in: ['active', 'overdue'] },
      ...(loanType ? { loanType } : {}),
      ...(agentId ? { customer: { agentId } } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      instalments: {
        where: { status: 'missed', dueDate: { gte: ninetyDaysAgo } },
        select: { dueDate: true },
      },
    },
  });

  const nowTime = Date.now();

  type Agg = {
    name: string;
    loanCount: number;
    missedCount: number;
    maxOverdue: number;
    outstanding: number;
    payable: number;
  };
  const byCustomer = new Map<string, Agg>();

  loans.forEach((l) => {
    const cust = l.customer;
    if (!cust) return;
    const agg = byCustomer.get(cust.id) || {
      name: cust.name,
      loanCount: 0,
      missedCount: 0,
      maxOverdue: 0,
      outstanding: 0,
      payable: 0,
    };

    agg.loanCount += 1;
    agg.missedCount += l.instalments.length;

    const payable = Number(l.totalPayable);
    const collected = Number(l.totalCollected || 0);
    const outstanding = Math.max(0, payable - collected);
    agg.outstanding += outstanding;
    agg.payable += payable;

    l.instalments.forEach((inst) => {
      const daysOverdue = Math.floor((nowTime - new Date(inst.dueDate).getTime()) / 86400000);
      if (daysOverdue > agg.maxOverdue) agg.maxOverdue = daysOverdue;
    });

    byCustomer.set(cust.id, agg);
  });

  // Normalize signals to 0-100 against the cohort max so the weighted score
  // stays meaningful across portfolios of different sizes.
  const maxOverdueAll = Math.max(1, ...Array.from(byCustomer.values()).map(a => a.maxOverdue));
  const maxMissedAll = Math.max(1, ...Array.from(byCustomer.values()).map(a => a.missedCount));

  let highRiskCount = 0;
  let totalAtRiskOutstanding = 0;
  let scoreSum = 0;

  const rows: Record<string, any>[] = [];

  byCustomer.forEach((agg) => {
    const outstandingRatio = agg.payable > 0 ? agg.outstanding / agg.payable : 0;
    const overdueSignal = (agg.maxOverdue / maxOverdueAll) * 100;
    const missedSignal = (agg.missedCount / maxMissedAll) * 100;
    const outstandingSignal = outstandingRatio * 100;

    const riskScore = Math.round(
      (wOverdue * overdueSignal + wMissed * missedSignal + wOutstanding * outstandingSignal) / weightTotal
    );

    let riskBand: 'Low' | 'Medium' | 'High' = 'Low';
    if (riskScore >= 75) riskBand = 'High';
    else if (riskScore >= threshold) riskBand = 'Medium';

    scoreSum += riskScore;

    if (riskScore < threshold) return;

    highRiskCount += 1;
    totalAtRiskOutstanding += agg.outstanding;

    rows.push({
      customerName: agg.name,
      loanCount: agg.loanCount,
      missedCount: agg.missedCount,
      maxOverdue: agg.maxOverdue,
      outstanding: agg.outstanding,
      riskScore,
      riskBand,
    });
  });

  rows.sort((a, b) => b.riskScore - a.riskScore);

  const avgScore = byCustomer.size > 0 ? Math.round(scoreSum / byCustomer.size) : 0;

  return {
    title: 'reports.highRisk.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCount', label: 'reports.col.loanCount', align: 'right', type: 'number' },
      { key: 'missedCount', label: 'reports.col.missedCount', align: 'right', type: 'number' },
      { key: 'maxOverdue', label: 'reports.col.maxOverdue', align: 'right', type: 'number' },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'riskScore', label: 'reports.col.riskScore', align: 'right', type: 'number' },
      { key: 'riskBand', label: 'reports.col.riskBand', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      outstanding: totalAtRiskOutstanding,
    },
    kpis: [
      { label: 'highRiskCount', value: highRiskCount, tone: highRiskCount > 0 ? 'bad' : 'good' },
      { label: 'totalAtRiskOutstanding', value: totalAtRiskOutstanding },
      { label: 'avgScore', value: avgScore },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
