import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { getSetting } from '../../tenant';

export async function buildAging(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId, loanType } = params;

  const branchFilter = branchId ? { branchId } : {};

  // Get bucket edges from setting
  const bucketSetting = await getSetting(tenantId, 'report_aging_buckets', '7,15,30,60,90');
  const edges = bucketSetting.split(',').map(Number); // e.g. [7, 15, 30, 60, 90]

  // Query all active or overdue loans
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
      customer: { select: { id: true } },
      instalments: {
        where: { status: { in: ['missed', 'upcoming'] } },
        orderBy: { dueDate: 'asc' },
      },
      penalties: {
        where: { status: 'pending' },
        select: { grossPenalty: true, settledAmount: true, waivedAmount: true },
      },
    },
  });

  // Initialize buckets
  const buckets: {
    label: string;
    key: string;
    customerIds: Set<string>;
    outstanding: number;
    interest: number;
    penalty: number;
  }[] = [];

  for (let i = 0; i <= edges.length; i++) {
    let label = '';
    let key = '';
    if (i === 0) {
      label = `1–${edges[0]} days`;
      key = `d1_${edges[0]}`;
    } else if (i === edges.length) {
      label = `${edges[i - 1]}+ days`;
      key = `d${edges[i - 1]}plus`;
    } else {
      label = `${edges[i - 1] + 1}–${edges[i]} days`;
      key = `d${edges[i - 1] + 1}_${edges[i]}`;
    }
    buckets.push({
      label,
      key: `reports.bucket.${key}`,
      customerIds: new Set(),
      outstanding: 0,
      interest: 0,
      penalty: 0,
    });
  }

  const nowTime = new Date().getTime();

  loans.forEach((l) => {
    // If loan has no missed instalments, skip it or find oldest missed
    const missedInstalments = l.instalments.filter(i => new Date(i.dueDate).getTime() < nowTime);
    if (missedInstalments.length === 0) return;

    const oldestMissedDueDate = new Date(missedInstalments[0].dueDate);
    const daysMissed = Math.floor((nowTime - oldestMissedDueDate.getTime()) / 86400000);
    if (daysMissed <= 0) return;

    // Determine bucket index
    let bucketIdx = 0;
    for (let i = 0; i < edges.length; i++) {
      if (daysMissed <= edges[i]) {
        bucketIdx = i;
        break;
      }
      if (i === edges.length - 1) {
        bucketIdx = edges.length;
      }
    }

    const principal = Number(l.principal);
    const payable = Number(l.totalPayable);
    const collected = Number(l.totalCollected || 0);

    const interestTotal = Math.max(0, payable - principal);
    const remainingPayable = Math.max(0, payable - collected);

    const principalRatio = payable > 0 ? principal / payable : 1;
    const outstanding = remainingPayable * principalRatio;
    const interest = remainingPayable * (1 - principalRatio);

    const penalty = l.penalties.reduce((sum, p) => {
      return sum + Math.max(0, Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount));
    }, 0);

    const bucket = buckets[bucketIdx];
    bucket.customerIds.add(l.customer.id);
    bucket.outstanding += outstanding;
    bucket.interest += interest;
    bucket.penalty += penalty;
  });

  let totalCustomers = 0;
  let totalOutstanding = 0;
  let totalInterest = 0;
  let totalPenalty = 0;

  const rows = buckets.map(b => {
    const custCount = b.customerIds.size;
    totalCustomers += custCount;
    totalOutstanding += b.outstanding;
    totalInterest += b.interest;
    totalPenalty += b.penalty;

    return {
      bucket: b.label,
      customers: custCount,
      outstanding: b.outstanding,
      interest: b.interest,
      penalty: b.penalty,
    };
  });

  const lastBucketOutstanding = buckets[buckets.length - 1].outstanding;
  const concentration = totalOutstanding > 0 ? Math.round((lastBucketOutstanding / totalOutstanding) * 100) : 0;

  return {
    title: 'reports.aging.title',
    columns: [
      { key: 'bucket', label: 'reports.col.bucket', align: 'left', type: 'badge' },
      { key: 'customers', label: 'reports.col.customers', align: 'right', type: 'number', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'interest', label: 'reports.col.interest', align: 'right', type: 'currency', total: true },
      { key: 'penalty', label: 'reports.col.penalty', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      customers: totalCustomers,
      outstanding: totalOutstanding,
      interest: totalInterest,
      penalty: totalPenalty,
    },
    kpis: [
      { label: 'totalOverdueCustomers', value: totalCustomers },
      { label: 'totalOutstanding', value: totalOutstanding },
      { label: 'ninetyPlusConcentration', value: `${concentration}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
