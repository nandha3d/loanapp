import prisma from '../../db';
import { getSetting } from '../../tenant';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildRepeatBorrowers(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId } = params;

  const branchFilter = branchId ? { branchId } : {};

  const tiersSetting = await getSetting(tenantId, 'report_repeat_tiers', '2,4,6');
  const tiers = tiersSetting
    .split(',')
    .map((t) => parseInt(t.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
  const minTier = tiers.length > 0 ? tiers[0] : 2;

  const customerWhere: any = {
    tenantId,
    appType,
    ...branchFilter,
    ...(agentId ? { agentId } : {}),
  };

  // Find candidate customers in scope first (branch/agent/appType/tenant scoping lives on Customer).
  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: { id: true, name: true },
  });
  const customerIds = customers.map((c) => c.id);
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  if (customerIds.length === 0) {
    return emptyPayload();
  }

  const grouped = await prisma.loan.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds }, tenantId, appType },
    _count: { _all: true },
    _sum: { disbursed: true },
  });

  const eligible = grouped.filter((g) => g._count._all >= minTier);

  if (eligible.length === 0) {
    return emptyPayload();
  }

  const eligibleIds = eligible.map((g) => g.customerId);

  // Active loans count + last loan date per eligible customer
  const loans = await prisma.loan.findMany({
    where: { customerId: { in: eligibleIds }, tenantId, appType },
    select: { customerId: true, status: true, startDate: true },
  });

  const activeLoansByCustomer = new Map<string, number>();
  const lastLoanDateByCustomer = new Map<string, Date>();
  for (const l of loans) {
    if (l.status === 'active') {
      activeLoansByCustomer.set(l.customerId, (activeLoansByCustomer.get(l.customerId) || 0) + 1);
    }
    const existing = lastLoanDateByCustomer.get(l.customerId);
    if (!existing || l.startDate > existing) {
      lastLoanDateByCustomer.set(l.customerId, l.startDate);
    }
  }

  function tierLabel(count: number): string {
    let label = `${minTier}+`;
    for (const t of tiers) {
      if (count >= t) label = `${t}+`;
    }
    return label;
  }

  let totalLoanCount = 0;
  let totalLifetimeDisbursed = 0;
  const tierCounts: Record<string, number> = {};

  const rows = eligible
    .sort((a, b) => b._count._all - a._count._all)
    .map((g) => {
      const loanCount = g._count._all;
      const lifetimeDisbursed = Number(g._sum.disbursed || 0);
      const tier = tierLabel(loanCount);
      totalLoanCount += loanCount;
      totalLifetimeDisbursed += lifetimeDisbursed;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;

      return {
        customerName: nameById.get(g.customerId) || '',
        loanCount,
        lifetimeDisbursed,
        activeLoans: activeLoansByCustomer.get(g.customerId) || 0,
        lastLoanDate: lastLoanDateByCustomer.get(g.customerId) || null,
        tier,
      };
    });

  const totalCustomersInScope = customers.length;
  const shareOfBook = totalCustomersInScope > 0 ? Math.round((eligible.length / totalCustomersInScope) * 100) : 0;
  const avgLoansPerCustomer = eligible.length > 0 ? Number((totalLoanCount / eligible.length).toFixed(2)) : 0;

  return {
    title: 'reports.repeatBorrowers.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCount', label: 'reports.col.loanCount', align: 'right', type: 'number', total: true },
      { key: 'lifetimeDisbursed', label: 'reports.col.lifetimeDisbursed', align: 'right', type: 'currency', total: true },
      { key: 'activeLoans', label: 'reports.col.activeLoans', align: 'right', type: 'number' },
      { key: 'lastLoanDate', label: 'reports.col.lastLoan', align: 'center', type: 'date' },
      { key: 'tier', label: 'reports.col.tier', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      loanCount: totalLoanCount,
      lifetimeDisbursed: totalLifetimeDisbursed,
    },
    kpis: [
      { label: 'repeatCustomers', value: eligible.length },
      { label: 'shareOfBook', value: `${shareOfBook}%` },
      { label: 'avgLoansPerCustomer', value: avgLoansPerCustomer },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}

function emptyPayload(): ReportPayload {
  return {
    title: 'reports.repeatBorrowers.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCount', label: 'reports.col.loanCount', align: 'right', type: 'number', total: true },
      { key: 'lifetimeDisbursed', label: 'reports.col.lifetimeDisbursed', align: 'right', type: 'currency', total: true },
      { key: 'activeLoans', label: 'reports.col.activeLoans', align: 'right', type: 'number' },
      { key: 'lastLoanDate', label: 'reports.col.lastLoan', align: 'center', type: 'date' },
      { key: 'tier', label: 'reports.col.tier', align: 'center', type: 'badge' },
    ],
    rows: [],
    totals: { loanCount: 0, lifetimeDisbursed: 0 },
    kpis: [
      { label: 'repeatCustomers', value: 0 },
      { label: 'shareOfBook', value: '0%' },
      { label: 'avgLoansPerCustomer', value: 0 },
    ],
    meta: { currencySymbol: '₹' },
  };
}
