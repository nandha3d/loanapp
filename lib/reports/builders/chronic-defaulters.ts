import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { getSetting } from '../../tenant';

export async function buildChronicDefaulters(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, loanType } = params;

  const branchFilter = branchId ? { branchId } : {};

  const thresholdSetting = await getSetting(tenantId, 'report_chronic_threshold', '3');
  const threshold = Number(thresholdSetting) || 3;

  const dateFrom = from ? new Date(from) : undefined;
  if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
  const dateTo = to ? new Date(to) : undefined;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  // Loans (active set), scoped, with historical missed instalments + penalties
  // across the requested window so we can spot repeated default patterns.
  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      ...(loanType ? { loanType } : {}),
      ...(agentId ? { customer: { agentId } } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      instalments: {
        where: {
          status: 'missed',
          ...(dateFrom || dateTo
            ? { dueDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
            : {}),
        },
        select: { dueDate: true },
      },
      penalties: {
        select: { grossPenalty: true },
      },
    },
  });

  type Agg = {
    name: string;
    missedEvents: number;
    defaultLoanIds: Set<string>;
    penaltyTotal: number;
    lastDefault: Date | null;
    outstanding: number;
  };
  const byCustomer = new Map<string, Agg>();

  loans.forEach((l) => {
    const cust = l.customer;
    if (!cust || l.instalments.length === 0) return;

    const agg = byCustomer.get(cust.id) || {
      name: cust.name,
      missedEvents: 0,
      defaultLoanIds: new Set<string>(),
      penaltyTotal: 0,
      lastDefault: null,
      outstanding: 0,
    };

    agg.missedEvents += l.instalments.length;
    agg.defaultLoanIds.add(l.id);

    const loanPenaltyTotal = l.penalties.reduce((sum, p) => sum + Number(p.grossPenalty), 0);
    agg.penaltyTotal += loanPenaltyTotal;

    const payable = Number(l.totalPayable);
    const collected = Number(l.totalCollected || 0);
    agg.outstanding += Math.max(0, payable - collected);

    l.instalments.forEach((inst) => {
      const due = new Date(inst.dueDate);
      if (!agg.lastDefault || due > agg.lastDefault) agg.lastDefault = due;
    });

    byCustomer.set(cust.id, agg);
  });

  let totalPenalties = 0;
  let totalOutstanding = 0;

  const rows: Record<string, any>[] = [];

  byCustomer.forEach((agg) => {
    if (agg.missedEvents < threshold) return;

    totalPenalties += agg.penaltyTotal;
    totalOutstanding += agg.outstanding;

    rows.push({
      customerName: agg.name,
      missedEvents: agg.missedEvents,
      defaultLoans: agg.defaultLoanIds.size,
      penaltyTotal: agg.penaltyTotal,
      lastDefault: agg.lastDefault,
      outstanding: agg.outstanding,
    });
  });

  rows.sort((a, b) => b.missedEvents - a.missedEvents);

  return {
    title: 'reports.chronic.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'missedEvents', label: 'reports.col.missedEvents', align: 'right', type: 'number', total: true },
      { key: 'defaultLoans', label: 'reports.col.defaultLoans', align: 'right', type: 'number' },
      { key: 'penaltyTotal', label: 'reports.col.penaltyTotal', align: 'right', type: 'currency', total: true },
      { key: 'lastDefault', label: 'reports.col.lastDefault', align: 'center', type: 'date' },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      penaltyTotal: totalPenalties,
      outstanding: totalOutstanding,
    },
    kpis: [
      { label: 'chronicCount', value: rows.length, tone: rows.length > 0 ? 'bad' : 'good' },
      { label: 'totalPenalties', value: totalPenalties },
      { label: 'totalOutstanding', value: totalOutstanding },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
