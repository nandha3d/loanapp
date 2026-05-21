'use server';

import prisma from '@/lib/db';

// ─── Helpers ────────────────────────────────────────
function startOfDay(date = new Date()) {
  const v = new Date(date);
  v.setHours(0, 0, 0, 0);
  return v;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

function outstanding(inst: { dueAmount: unknown; receivedAmount: unknown }) {
  return Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount || 0));
}

function getLocalDateString(date: Date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Types ──────────────────────────────────────────
export type AgingBucket = { label: string; count: number; amount: number; color: string };
export type TrendDay = { label: string; dateKey: string; expected: number; collected: number };
export type AgentRow = { id: string; name: string; collected: number; customers: number; overdue: number; efficiency: number };
export type FunnelStep = { label: string; count: number; color: string };
export type Segment = { label: string; count: number; color: string };
export type InsightItem = { icon: string; text: string; color: string };
export type AttentionLoan = {
  customerId: string; customerName: string; customerCode: string;
  loanCode: string; loanId: string; dueToday: number; overdueDays: number;
  overdueAmount: number; riskLevel: string; riskColor: string;
  badges: string[];
};
export type ForecastDay = { label: string; expected: number; cumulative: number };
export type PortfolioSummary = {
  totalDisbursed: number; activePrincipal: number; totalRecovered: number;
  npaAmount: number; recoveryRatio: number; avgLoanSize: number;
  activeCount: number; closedCount: number; overdueCount: number;
};

export type AnalyticsData = {
  collectionEfficiency: { pct: number; color: string; label: string; expected: number; collected: number };
  capitalBalance: number;
  portfolio: PortfolioSummary;
  trend7d: TrendDay[];
  prevWeekCollected: number;
  currentWeekCollected: number;
  agingBuckets: AgingBucket[];
  riskScore: { score: number; label: string; color: string };
  agentLeaderboard: AgentRow[];
  borrowerSegments: Segment[];
  cashflowForecast7d: ForecastDay[];
  cashflowForecast30d: { total: number };
  projectedOverdue: number;
  collectionFunnel: FunnelStep[];
  attentionLoans: AttentionLoan[];
  smartInsights: InsightItem[];
  operationalFeed: { id: string; user: string; action: string; entity: string; time: Date }[];
  frequencyTotals: { daily: number; weekly: number; biweekly: number; monthly: number };
  borrowerLeaderboard: {
    id: string;
    name: string;
    customerCode: string;
    totalActivePrincipal: number;
    overdueAmount: number;
    missedCount: number;
  }[];
  todayCashCollected: number;
  todayUpiCollected: number;
  routeHealth: { name: string; customers: number; overdue: number; collected: number }[];
  emiPressure: { count: number; amount: number };
};

// ─── Main Data Fetcher ──────────────────────────────
export async function getAnalyticsData(
  tenantId: string,
  appType: string,
  branchId?: string | null
): Promise<AnalyticsData> {
  const today = startOfDay();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
  const prevWeekStart = new Date(today); prevWeekStart.setDate(prevWeekStart.getDate() - 13);
  const next7 = new Date(today); next7.setDate(next7.getDate() + 7);
  const next30 = new Date(today); next30.setDate(next30.getDate() + 30);

  const bf = branchId ? { branchId } : {};
  const lw: any = { tenantId, appType, ...bf };

  // ── Parallel queries ──────────────────────────────
  const [
    activeLoans,
    closedLoans,
    overdueLoans,
    todayInstalments,
    overdueInstalments,
    weekInstalments,
    prevWeekCollections,
    future7dInstalments,
    future30dInstalments,
    pendingPenalties,
    todayCollections,
    weekCollections,
    accountEntries,
    routes,
    recentLogs,
    totalCustomers,
    emiPressureInstalments,
    frequencyGroupBy,
  ] = await Promise.all([
    // Active loans aggregate
    prisma.loan.aggregate({
      where: { ...lw, status: { in: ['active', 'overdue'] } },
      _sum: { principal: true, disbursed: true, totalCollected: true },
      _count: true,
    }),
    // Closed loans aggregate
    prisma.loan.aggregate({
      where: { ...lw, status: 'closed' },
      _sum: { totalCollected: true, principal: true },
      _count: true,
    }),
    // Overdue loan count
    prisma.loan.count({ where: { ...lw, status: 'overdue' } }),
    // Today's instalments
    prisma.instalment.findMany({
      where: { loan: { ...lw, status: { in: ['active', 'overdue', 'closed'] } }, dueDate: { gte: today, lt: tomorrow } },
      select: { id: true, dueAmount: true, receivedAmount: true, status: true },
    }),
    // ALL overdue instalments for aging + attention
    prisma.instalment.findMany({
      where: {
        loan: { ...lw, status: { in: ['active', 'overdue'] } },
        dueDate: { lt: today },
        status: { in: ['upcoming', 'missed', 'partial'] },
      },
      select: {
        id: true, dueDate: true, dueAmount: true, receivedAmount: true, status: true, instalmentNo: true,
        loan: {
          select: {
            id: true, loanCode: true, penaltyRate: true, totalInstalments: true, paidCount: true,
            customer: { select: { id: true, name: true, customerCode: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    }),
    // This week instalments for trend
    prisma.instalment.findMany({
      where: { loan: { ...lw }, dueDate: { gte: weekStart, lt: tomorrow } },
      select: { dueDate: true, dueAmount: true, receivedAmount: true },
    }),
    // Previous week collections for WoW comparison
    prisma.collectionEntry.findMany({
      where: { tenantId, submittedAt: { gte: prevWeekStart, lt: weekStart } },
      select: { receivedAmount: true },
    }),
    // Future 7 days
    prisma.instalment.findMany({
      where: { loan: { ...lw, status: { in: ['active', 'overdue'] } }, dueDate: { gte: tomorrow, lt: next7 } },
      select: { dueDate: true, dueAmount: true },
      orderBy: { dueDate: 'asc' },
    }),
    // Future 30 days aggregate
    prisma.instalment.aggregate({
      where: { loan: { ...lw, status: { in: ['active', 'overdue'] } }, dueDate: { gte: tomorrow, lt: next30 } },
      _sum: { dueAmount: true },
    }),
    // Pending penalties
    prisma.penalty.aggregate({
      where: { loan: { ...lw }, status: { in: ['pending', 'partial'] } },
      _sum: { grossPenalty: true },
      _count: true,
    }),
    // Today's collection entries
    prisma.collectionEntry.findMany({
      where: { tenantId, submittedAt: { gte: today, lt: tomorrow } },
      select: { receivedAmount: true, paymentMode: true, agentId: true, customer: { select: { routeId: true } } },
    }),
    // This week collection entries for agent leaderboard and trend
    prisma.collectionEntry.findMany({
      where: { tenantId, submittedAt: { gte: weekStart, lt: tomorrow } },
      select: { receivedAmount: true, agentId: true, agent: { select: { id: true, name: true } }, submittedAt: true },
    }),
    // Account entries for capital
    prisma.accountEntry.findMany({
      where: { tenantId },
      select: { type: true, amount: true },
    }),
    // Routes for route health
    prisma.route.findMany({
      where: { tenantId, appType, status: 'active' },
      include: {
        routeAgents: { include: { agent: true } },
        _count: { select: { customers: true } },
        customers: {
          select: {
            id: true,
            loans: {
              where: { status: { in: ['active', 'overdue'] } },
              select: {
                instalments: {
                  where: { dueDate: { lt: today }, status: { in: ['upcoming', 'missed', 'partial'] } },
                  select: { dueAmount: true, receivedAmount: true },
                },
              },
            },
          },
        },
      },
    }),
    // Audit logs for operational feed
    prisma.auditLog.findMany({
      where: { tenantId, user: { role: { not: 'developer' } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { user: true },
    }),
    // Total customers for segmentation and leaderboards
    prisma.customer.findMany({
      where: { tenantId, appType, ...bf, status: 'active' },
      select: {
        id: true,
        name: true,
        customerCode: true,
        createdAt: true,
        loans: {
          where: { status: { in: ['active', 'overdue', 'closed'] } },
          select: {
            id: true,
            principal: true,
            status: true,
            paidCount: true,
            totalInstalments: true,
            instalments: {
              select: {
                id: true,
                dueDate: true,
                dueAmount: true,
                receivedAmount: true,
                status: true,
              },
            },
          },
        },
      },
    }),
    // EMI pressure: customers with multiple EMIs due this week
    prisma.instalment.findMany({
      where: {
        loan: { ...lw, status: { in: ['active', 'overdue'] } },
        dueDate: { gte: today, lt: next7 },
        status: { in: ['upcoming'] },
      },
      select: { dueAmount: true, loan: { select: { customerId: true } } },
    }),
    // Loan frequency aggregates
    prisma.loan.groupBy({
      by: ['frequency'],
      where: { ...lw, status: { in: ['active', 'overdue'] } },
      _sum: { principal: true },
    }),
  ]);

  // ── Computations ──────────────────────────────────

  // 1. Collection Efficiency
  const todayExpected = todayInstalments.reduce((s, i) => s + Number(i.dueAmount), 0);
  const todayCollected = todayCollections.reduce((s, i) => s + Number(i.receivedAmount), 0);
  const effPct = todayExpected > 0 ? Math.round((todayCollected / todayExpected) * 100) : 100;
  const collectionEfficiency = {
    pct: effPct,
    color: effPct >= 90 ? '#10B981' : effPct >= 70 ? '#F59E0B' : '#EF4444',
    label: effPct >= 90 ? 'Excellent' : effPct >= 70 ? 'Average' : 'Poor',
    expected: todayExpected,
    collected: todayCollected,
  };

  // 2. Capital balance
  let capitalBalance = 0;
  for (const e of accountEntries) {
    const a = Number(e.amount);
    if (e.type === 'capital_add') capitalBalance += a;
    else if (e.type === 'capital_withdraw') capitalBalance -= a;
    else if (e.type === 'loan_disburse') capitalBalance -= a;
    else if (e.type === 'collection') capitalBalance += a;
    else if (e.type === 'expense') capitalBalance -= a;
  }

  // 3. Portfolio summary
  const totalDisbursed = Number(activeLoans._sum.disbursed || 0) + Number(closedLoans._sum.principal || 0);
  const activePrincipal = Number(activeLoans._sum.principal || 0);
  const totalRecovered = Number(activeLoans._sum.totalCollected || 0) + Number(closedLoans._sum.totalCollected || 0);
  const activeCount = activeLoans._count;
  const closedCount = closedLoans._count;
  const npaAmount = overdueInstalments.reduce((s, i) => s + outstanding(i), 0);
  const portfolio: PortfolioSummary = {
    totalDisbursed,
    activePrincipal,
    totalRecovered,
    npaAmount,
    recoveryRatio: totalDisbursed > 0 ? Math.round((totalRecovered / totalDisbursed) * 100) : 0,
    avgLoanSize: activeCount > 0 ? Math.round(activePrincipal / activeCount) : 0,
    activeCount,
    closedCount,
    overdueCount: overdueLoans,
  };

  // 4. Trend 7 days
  const trend7d: TrendDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dk = getLocalDateString(d);
    const rows = weekInstalments.filter(r => getLocalDateString(r.dueDate) === dk);
    const cols = weekCollections.filter(c => getLocalDateString(c.submittedAt) === dk);
    return {
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      dateKey: dk,
      expected: rows.reduce((s, r) => s + Number(r.dueAmount), 0),
      collected: cols.reduce((s, r) => s + Number(r.receivedAmount), 0),
    };
  });

  // WoW comparison
  const currentWeekCollected = weekCollections.reduce((s, r) => s + Number(r.receivedAmount), 0);
  const prevWeekCollected = prevWeekCollections.reduce((s, r) => s + Number(r.receivedAmount), 0);

  // 5. Aging buckets
  const agingBuckets = computeAgingBuckets(overdueInstalments, today);

  // 6. Risk score
  const totalActiveInstalments = activeCount > 0 ? activeLoans._count * 10 : 1; // rough
  const overdueRatio = overdueInstalments.length / Math.max(1, totalActiveInstalments);
  const penaltyCount = pendingPenalties._count;
  const riskRaw = Math.min(100, Math.round(
    overdueRatio * 40 * 100 +
    Math.min(penaltyCount, 20) * 1.25 +
    Math.min(overdueLoans, 10) * 1.5
  ));
  const riskScore = {
    score: riskRaw,
    label: riskRaw <= 25 ? 'Low' : riskRaw <= 50 ? 'Medium' : riskRaw <= 75 ? 'High' : 'Critical',
    color: riskRaw <= 25 ? '#10B981' : riskRaw <= 50 ? '#F59E0B' : riskRaw <= 75 ? '#F97316' : '#EF4444',
  };

  // 7. Agent leaderboard
  const agentMap = new Map<string, { name: string; collected: number }>();
  for (const c of weekCollections) {
    const existing = agentMap.get(c.agentId) || { name: c.agent?.name || 'Unknown', collected: 0 };
    existing.collected += Number(c.receivedAmount);
    agentMap.set(c.agentId, existing);
  }
  const agentLeaderboard: AgentRow[] = Array.from(agentMap.entries()).map(([id, d]) => ({
    id, name: d.name, collected: d.collected,
    customers: 0, overdue: 0,
    efficiency: 0,
  })).sort((a, b) => b.collected - a.collected);

  // 8. Borrower segments
  const borrowerSegments = computeBorrowerSegments(totalCustomers, today);

  // 9. Cashflow forecast 7d
  const cashflowForecast7d: ForecastDay[] = [];
  let cumulative = 0;
  for (let i = 1; i <= 6; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const dk = getLocalDateString(d);
    const dayAmt = future7dInstalments
      .filter(r => getLocalDateString(r.dueDate) === dk)
      .reduce((s, r) => s + Number(r.dueAmount), 0);
    cumulative += dayAmt;
    cashflowForecast7d.push({
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      expected: dayAmt,
      cumulative,
    });
  }

  // 10. Collection funnel
  const funnel = computeCollectionFunnel(todayInstalments);

  // 11. Attention loans
  const attentionLoans = computeAttentionLoans(overdueInstalments, today);

  // 12. Smart insights
  const smartInsights = generateSmartInsights(currentWeekCollected, prevWeekCollected, overdueInstalments, penaltyCount, agentLeaderboard);

  // 13. Operational feed
  const operationalFeed = recentLogs.map(l => ({
    id: l.id,
    user: l.user?.name || 'System',
    action: l.action,
    entity: l.entityType,
    time: l.createdAt,
  }));

  // 14. Cash/UPI split
  const todayCashCollected = todayCollections.filter(e => e.paymentMode === 'cash').reduce((s, e) => s + Number(e.receivedAmount), 0);
  const todayUpiCollected = todayCollections.filter(e => e.paymentMode === 'upi' || e.paymentMode === 'online').reduce((s, e) => s + Number(e.receivedAmount), 0);

  // 15. Route health
  const routeHealth = routes.map(route => {
    const routeOverdue = route.customers.reduce((s, c) =>
      s + c.loans.reduce((ls, l) =>
        ls + l.instalments.reduce((is, inst) => is + outstanding(inst), 0), 0), 0);
    const routeCollected = todayCollections
      .filter(e => e.customer?.routeId === route.id)
      .reduce((s, e) => s + Number(e.receivedAmount), 0);
    return {
      name: route.name,
      customers: route._count.customers,
      overdue: routeOverdue,
      collected: routeCollected,
    };
  });

  // 16. EMI pressure
  const emiByCustomer = new Map<string, number>();
  for (const inst of emiPressureInstalments) {
    const cid = inst.loan.customerId;
    emiByCustomer.set(cid, (emiByCustomer.get(cid) || 0) + Number(inst.dueAmount));
  }
  const multiEmiCustomers = Array.from(emiByCustomer.entries()).filter(([, count]) => count > 0);
  const emiPressure = {
    count: multiEmiCustomers.length,
    amount: multiEmiCustomers.reduce((s, [, a]) => s + a, 0),
  };

  // 17. Loan Frequency Totals
  const frequencyTotals = { daily: 0, weekly: 0, biweekly: 0, monthly: 0 };
  for (const group of frequencyGroupBy) {
    const sum = Number(group._sum.principal || 0);
    if (group.frequency === 'daily') frequencyTotals.daily = sum;
    else if (group.frequency === 'weekly') frequencyTotals.weekly = sum;
    else if (group.frequency === 'biweekly') frequencyTotals.biweekly = sum;
    else if (group.frequency === 'monthly') frequencyTotals.monthly = sum;
  }

  // 18. Borrower Leaderboard
  const borrowerLeaderboard = totalCustomers.map(customer => {
    let totalActivePrincipal = 0;
    let overdueAmount = 0;
    let missedCount = 0;

    for (const loan of customer.loans) {
      if (loan.status === 'active' || loan.status === 'overdue') {
        totalActivePrincipal += Number(loan.principal);
        for (const inst of loan.instalments) {
          const outstandingAmt = Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount || 0));
          if (inst.dueDate < today && inst.status !== 'paid') {
            overdueAmount += outstandingAmt;
            missedCount++;
          }
        }
      }
    }

    return {
      id: customer.id,
      name: customer.name,
      customerCode: customer.customerCode,
      totalActivePrincipal,
      overdueAmount,
      missedCount,
    };
  });

  return {
    collectionEfficiency,
    capitalBalance,
    portfolio,
    trend7d,
    prevWeekCollected,
    currentWeekCollected,
    agingBuckets,
    riskScore,
    agentLeaderboard,
    borrowerSegments,
    cashflowForecast7d,
    cashflowForecast30d: { total: Number(future30dInstalments._sum.dueAmount || 0) },
    projectedOverdue: npaAmount,
    collectionFunnel: funnel,
    attentionLoans,
    smartInsights,
    operationalFeed,
    frequencyTotals,
    borrowerLeaderboard,
    todayCashCollected,
    todayUpiCollected,
    routeHealth,
    emiPressure,
  };
}

// ─── Computation Helpers ────────────────────────────

function computeAgingBuckets(overdueInstalments: any[], today: Date): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: '1–7 Days', count: 0, amount: 0, color: '#F59E0B' },
    { label: '8–30 Days', count: 0, amount: 0, color: '#F97316' },
    { label: '31–90 Days', count: 0, amount: 0, color: '#EF4444' },
    { label: '90+ Days', count: 0, amount: 0, color: '#991B1B' },
  ];
  for (const inst of overdueInstalments) {
    const days = daysBetween(startOfDay(inst.dueDate), today);
    const amt = outstanding(inst);
    if (amt <= 0) continue;
    const idx = days <= 7 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : 3;
    buckets[idx].count++;
    buckets[idx].amount += amt;
  }
  return buckets;
}

function computeBorrowerSegments(customers: any[], today: Date): Segment[] {
  let reliable = 0, delayed = 0, chronic = 0, highValue = 0, newBorrower = 0;
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const c of customers) {
    if (c.createdAt >= thirtyDaysAgo) { newBorrower++; continue; }
    if (c.loans.length === 0) { reliable++; continue; }
    const totalMissed = c.loans.reduce((s: number, l: any) => {
      const missedInsts = l.instalments?.filter((inst: any) => inst.status === 'missed' || (inst.dueDate < today && inst.status !== 'paid')) || [];
      return s + missedInsts.length;
    }, 0);
    const totalPrincipal = c.loans.reduce((s: number, l: any) => s + Number(l.principal), 0);
    if (totalPrincipal > 100000) highValue++;
    if (totalMissed === 0) reliable++;
    else if (totalMissed <= 3) delayed++;
    else chronic++;
  }
  return [
    { label: 'Reliable Payers', count: reliable, color: '#10B981' },
    { label: 'Delayed Payers', count: delayed, color: '#F59E0B' },
    { label: 'Chronic Defaulters', count: chronic, color: '#EF4444' },
    { label: 'High Value', count: highValue, color: '#3B82F6' },
    { label: 'New Borrowers', count: newBorrower, color: '#8B5CF6' },
  ];
}

function computeCollectionFunnel(todayInstalments: any[]): FunnelStep[] {
  const total = todayInstalments.length;
  const paid = todayInstalments.filter(i => i.status === 'paid').length;
  const partial = todayInstalments.filter(i => i.status === 'partial').length;
  const missed = todayInstalments.filter(i => i.status === 'missed').length;
  const upcoming = todayInstalments.filter(i => i.status === 'upcoming').length;
  return [
    { label: 'Due Today', count: total, color: '#3B82F6' },
    { label: 'Paid', count: paid, color: '#10B981' },
    { label: 'Partial', count: partial, color: '#F59E0B' },
    { label: 'Pending', count: upcoming, color: '#6B7280' },
    { label: 'Missed', count: missed, color: '#EF4444' },
  ];
}

function computeAttentionLoans(overdueInstalments: any[], today: Date): AttentionLoan[] {
  // Group by loan
  const loanMap = new Map<string, { loan: any; totalOverdue: number; maxDays: number; count: number }>();
  for (const inst of overdueInstalments) {
    const lid = inst.loan.id;
    const days = daysBetween(startOfDay(inst.dueDate), today);
    const amt = outstanding(inst);
    if (amt <= 0) continue;
    const existing = loanMap.get(lid) || { loan: inst.loan, totalOverdue: 0, maxDays: 0, count: 0 };
    existing.totalOverdue += amt;
    existing.maxDays = Math.max(existing.maxDays, days);
    existing.count++;
    loanMap.set(lid, existing);
  }

  return Array.from(loanMap.values())
    .sort((a, b) => (b.maxDays * b.totalOverdue) - (a.maxDays * a.totalOverdue))
    .slice(0, 10)
    .map(entry => {
      const urgency = entry.maxDays * entry.totalOverdue;
      const riskLevel = entry.maxDays > 30 ? 'Critical' : entry.maxDays > 14 ? 'High' : entry.maxDays > 7 ? 'Medium' : 'Low';
      const riskColor = entry.maxDays > 30 ? '#991B1B' : entry.maxDays > 14 ? '#EF4444' : entry.maxDays > 7 ? '#F59E0B' : '#10B981';
      const badges: string[] = [];
      if (entry.maxDays > 30) badges.push('Repeat Defaulter');
      if (entry.count >= 3) badges.push(`Skipped ${entry.count} EMIs`);
      if (entry.totalOverdue > 10000) badges.push('Large Amount');
      return {
        customerId: entry.loan.customer.id,
        customerName: entry.loan.customer.name,
        customerCode: entry.loan.customer.customerCode,
        loanCode: entry.loan.loanCode,
        loanId: entry.loan.id,
        dueToday: 0,
        overdueDays: entry.maxDays,
        overdueAmount: entry.totalOverdue,
        riskLevel,
        riskColor,
        badges,
      };
    });
}

function generateSmartInsights(
  currentWeek: number, prevWeek: number,
  overdueInstalments: any[], penaltyCount: number,
  agentLeaderboard: AgentRow[]
): InsightItem[] {
  const insights: InsightItem[] = [];

  // WoW collection change
  if (prevWeek > 0) {
    const change = Math.round(((currentWeek - prevWeek) / prevWeek) * 100);
    if (change < 0) {
      insights.push({ icon: 'trending_down', text: `Collections dropped ${Math.abs(change)}% compared to last week.`, color: '#EF4444' });
    } else if (change > 0) {
      insights.push({ icon: 'trending_up', text: `Collections increased ${change}% compared to last week.`, color: '#10B981' });
    }
  }

  // Overdue growth
  if (overdueInstalments.length > 5) {
    insights.push({ icon: 'warning', text: `${overdueInstalments.length} instalments are currently overdue across portfolio.`, color: '#F59E0B' });
  }

  // Penalty
  if (penaltyCount > 0) {
    insights.push({ icon: 'gavel', text: `${penaltyCount} active penalties pending resolution.`, color: '#F97316' });
  }

  // Top agent
  if (agentLeaderboard.length > 0) {
    insights.push({ icon: 'emoji_events', text: `${agentLeaderboard[0].name} leads collections this week.`, color: '#3B82F6' });
  }

  // Default insight
  if (insights.length === 0) {
    insights.push({ icon: 'check_circle', text: 'Portfolio is in healthy condition. All metrics normal.', color: '#10B981' });
  }

  return insights;
}
