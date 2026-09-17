import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildWalletFloatLedger(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // WalletTransaction spans all modules per tenant — must scope by appType
  // (module isolation) and restrict to agent float accounts only.
  const baseWhere: any = {
    tenantId,
    appType,
    accountKind: 'agent',
    ...(agentId ? { agentId } : {}),
  };

  // Resolve the agent set: explicit agentId, or all agents under the branch/tenant
  // that have any wallet activity for this module.
  const agentIds = await prisma.walletTransaction.findMany({
    where: baseWhere,
    distinct: ['agentId'],
    select: { agentId: true },
  });
  const ids = agentIds.map((a) => a.agentId).filter((id): id is string => !!id);

  if (ids.length === 0) {
    return {
      title: 'reports.walletFloatLedger.title',
      columns: walletColumns(),
      rows: [],
      totals: { opening: 0, released: 0, collected: 0, deposited: 0, closing: 0 },
      kpis: [
        { label: 'totalFloatOutstanding', value: 0 },
        { label: 'agentsHoldingCash', value: 0 },
        { label: 'largestBalance', value: 0 },
        { label: 'undepositedCash', value: 0 },
      ],
      meta: { currencySymbol: '₹' },
    };
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: ids },
      tenantId,
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const scopedAgentIds = users.map((u) => u.id);

  let totalOpening = 0;
  let totalReleased = 0;
  let totalCollected = 0;
  let totalDeposited = 0;
  let totalClosing = 0;
  let agentsHoldingCash = 0;
  let largestBalance = 0;

  const rows: Record<string, any>[] = [];

  for (const aId of scopedAgentIds) {
    const agentWhere = { tenantId, appType, accountKind: 'agent', agentId: aId };

    // Opening = latest balanceAfter strictly before `from` (or 0 if none).
    const priorTx = await prisma.walletTransaction.findFirst({
      where: { ...agentWhere, createdAt: { lt: dateFrom } },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    const opening = priorTx ? Number(priorTx.balanceAfter) : 0;

    // Transactions within range, grouped by type.
    const rangeTx = await prisma.walletTransaction.findMany({
      where: { ...agentWhere, createdAt: { gte: dateFrom, lte: dateTo } },
      orderBy: { createdAt: 'desc' },
      select: { type: true, amount: true, balanceAfter: true, createdAt: true },
    });

    let released = 0;
    let collected = 0;
    let deposited = 0;

    for (const tx of rangeTx) {
      const amt = Number(tx.amount);
      if (tx.type === 'release' || tx.type === 'disburse') released += amt;
      else if (tx.type === 'collection') collected += amt;
      else if (tx.type === 'adjustment' || tx.type === 'inject') {
        // Treat negative adjustments as deposits/outflows, positive as inflow credit.
        if (amt < 0) deposited += Math.abs(amt);
        else collected += amt;
      }
    }

    const closing = rangeTx.length > 0 ? Number(rangeTx[0].balanceAfter) : opening + released + collected - deposited;

    totalOpening += opening;
    totalReleased += released;
    totalCollected += collected;
    totalDeposited += deposited;
    totalClosing += closing;
    if (closing > 0) agentsHoldingCash++;
    if (closing > largestBalance) largestBalance = closing;

    rows.push({
      agentName: userMap.get(aId) || aId,
      opening,
      released,
      collected,
      deposited,
      closing,
    });
  }

  return {
    title: 'reports.walletFloatLedger.title',
    columns: walletColumns(),
    rows,
    totals: {
      opening: totalOpening,
      released: totalReleased,
      collected: totalCollected,
      deposited: totalDeposited,
      closing: totalClosing,
    },
    kpis: [
      { label: 'totalFloatOutstanding', value: totalClosing },
      { label: 'agentsHoldingCash', value: agentsHoldingCash },
      { label: 'largestBalance', value: largestBalance },
      { label: 'undepositedCash', value: totalClosing },
    ],
    meta: { currencySymbol: '₹' },
  };
}

function walletColumns() {
  return [
    { key: 'agentName', label: 'reports.col.agent', align: 'left' as const, type: 'text' as const },
    { key: 'opening', label: 'reports.col.opening', align: 'right' as const, type: 'currency' as const, total: true },
    { key: 'released', label: 'reports.col.released', align: 'right' as const, type: 'currency' as const, total: true },
    { key: 'collected', label: 'reports.col.collected', align: 'right' as const, type: 'currency' as const, total: true },
    { key: 'deposited', label: 'reports.col.deposited', align: 'right' as const, type: 'currency' as const, total: true },
    { key: 'closing', label: 'reports.col.closing', align: 'right' as const, type: 'currency' as const, total: true },
  ];
}
