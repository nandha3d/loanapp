import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { getSetting } from '../../tenant';

export async function buildBranchComparison(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, loanType } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // Composite score weights: efficiency (recovery) / disbursement-volume proxy / outstanding-ratio (inverted)
  const weightsRaw = await getSetting(tenantId, 'report_branch_score_weights', '40,30,30');
  const [wEfficiency, wVolume, wOutstanding] = weightsRaw
    .split(',')
    .map((v) => Number(v.trim()) || 0);

  // Multi-branch rollup — spans ALL branches for this tenant.
  const branches = await prisma.branch.findMany({
    where: { tenantId, status: 'active' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const branchIds = branches.map((b) => b.id);

  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      deletedAt: null,
      branchId: { in: branchIds },
      ...(loanType ? { loanType } : {}),
      startDate: { gte: dateFrom, lte: dateTo },
    },
    select: {
      branchId: true,
      status: true,
      principal: true,
      totalPayable: true,
      totalCollected: true,
      npaStatus: true,
    },
  });

  const collections = await prisma.dailyCollection.findMany({
    where: {
      tenantId,
      appType,
      branchId: { in: branchIds },
      date: { gte: dateFrom, lte: dateTo },
    },
    select: { branchId: true, totalExpected: true, totalCollected: true },
  });

  const byBranch = new Map<
    string,
    {
      disbursed: number;
      collected: number;
      outstanding: number;
      expected: number;
      collectedInRange: number;
      loanCount: number;
      overdueCount: number;
      npaCount: number;
    }
  >();
  branchIds.forEach((id) =>
    byBranch.set(id, {
      disbursed: 0,
      collected: 0,
      outstanding: 0,
      expected: 0,
      collectedInRange: 0,
      loanCount: 0,
      overdueCount: 0,
      npaCount: 0,
    }),
  );

  loans.forEach((loan) => {
    if (!loan.branchId) return;
    const entry = byBranch.get(loan.branchId);
    if (!entry) return;
    const principal = Number(loan.principal);
    const payable = Number(loan.totalPayable);
    const collected = Number(loan.totalCollected || 0);

    entry.loanCount += 1;
    entry.disbursed += principal;
    entry.collected += collected;
    entry.outstanding += Math.max(0, payable - collected);
    if (loan.status === 'overdue') entry.overdueCount += 1;
    if (loan.npaStatus) entry.npaCount += 1;
  });

  collections.forEach((c) => {
    if (!c.branchId) return;
    const entry = byBranch.get(c.branchId);
    if (!entry) return;
    entry.expected += Number(c.totalExpected);
    entry.collectedInRange += Number(c.totalCollected);
  });

  const maxDisbursed = Math.max(1, ...branches.map((b) => byBranch.get(b.id)!.disbursed));

  let grandDisbursed = 0;
  let grandCollected = 0;

  const computed = branches.map((b) => {
    const entry = byBranch.get(b.id)!;
    const recovery = entry.expected > 0 ? Math.round((entry.collectedInRange / entry.expected) * 100) : 0;
    const overduePct = entry.loanCount > 0 ? Math.round((entry.overdueCount / entry.loanCount) * 100) : 0;
    const npaPct = entry.loanCount > 0 ? Math.round((entry.npaCount / entry.loanCount) * 100) : 0;

    // volume score: this branch's disbursement relative to the tenant's top branch
    const volumeScore = Math.round((entry.disbursed / maxDisbursed) * 100);
    // outstanding-ratio score (inverted — lower outstanding ratio is better)
    const outstandingRatio = entry.disbursed > 0 ? entry.outstanding / entry.disbursed : 0;
    const outstandingScore = Math.max(0, Math.round(100 - outstandingRatio * 100));

    const totalWeight = wEfficiency + wVolume + wOutstanding || 1;
    const score = Math.round(
      (recovery * wEfficiency + volumeScore * wVolume + outstandingScore * wOutstanding) / totalWeight,
    );

    grandDisbursed += entry.disbursed;
    grandCollected += entry.collected;

    return {
      branchName: b.name,
      disbursed: entry.disbursed,
      collected: entry.collected,
      recovery,
      overduePct,
      npaPct,
      score,
    };
  });

  const ranked = [...computed].sort((a, b) => b.score - a.score);
  const rows = ranked.map((r, idx) => ({ rank: idx + 1, ...r }));

  const topBranch = rows[0]?.branchName || '—';
  const bottomBranch = rows[rows.length - 1]?.branchName || '—';
  const spread =
    rows.length > 0 ? Math.max(...rows.map((r) => r.recovery)) - Math.min(...rows.map((r) => r.recovery)) : 0;

  return {
    title: 'reports.branchComparison.title',
    columns: [
      { key: 'rank', label: 'reports.col.rank', align: 'center', type: 'number' },
      { key: 'branchName', label: 'reports.col.branch', align: 'left', type: 'text' },
      { key: 'disbursed', label: 'reports.col.disbursed', align: 'right', type: 'currency', total: true },
      { key: 'collected', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'recovery', label: 'reports.col.recovery', align: 'right', type: 'percent' },
      { key: 'overduePct', label: 'reports.col.overduePct', align: 'right', type: 'percent' },
      { key: 'npaPct', label: 'reports.col.npaPct', align: 'right', type: 'percent' },
      { key: 'score', label: 'reports.col.score', align: 'right', type: 'number' },
    ],
    rows,
    totals: {
      disbursed: grandDisbursed,
      collected: grandCollected,
    },
    kpis: [
      { label: 'topBranch', value: topBranch },
      { label: 'bottomBranch', value: bottomBranch },
      { label: 'spread', value: `${spread}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
