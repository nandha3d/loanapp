import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildPartialPaymentReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, loanType } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Partial = some amount received but less than what was due. Prefer the
  // explicit 'partial' status when present, but fall back to an amount
  // comparison so loans that never use that status string are still caught.
  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: dateFrom, lte: dateTo },
      ...(agentId ? { agentId } : {}),
      OR: [
        { status: 'partial' },
        { AND: [{ receivedAmount: { gt: 0 } }, { status: { not: 'partial' } }] },
      ],
      loan: {
        tenantId,
        appType,
        ...branchFilter,
        ...(loanType ? { loanType } : {}),
      },
    },
    include: {
      loan: { select: { loanCode: true, customer: { select: { name: true } } } },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Instalment.agentId has no Prisma relation to User, so resolve agent
  // names with a single follow-up lookup keyed on the distinct ids.
  const agentIds = Array.from(new Set(instalments.map(i => i.agentId).filter((id): id is string => !!id)));
  const agents = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const agentNameById = new Map(agents.map(a => [a.id, a.name]));

  let totalDue = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  let paidPctSum = 0;

  const rows: Record<string, any>[] = [];

  instalments.forEach((inst) => {
    const due = Number(inst.dueAmount);
    const received = Number(inst.receivedAmount || 0);

    // Only true partials: something received, but strictly less than due.
    if (!(received > 0 && received < due)) return;

    const balance = due - received;
    const paidPct = due > 0 ? Math.round((received / due) * 100) : 0;

    totalDue += due;
    totalPaid += received;
    totalBalance += balance;
    paidPctSum += paidPct;

    rows.push({
      customerName: inst.loan?.customer?.name || '—',
      loanCode: inst.loan?.loanCode || '—',
      dueDate: inst.dueDate,
      dueAmount: due,
      receivedAmount: received,
      balance,
      paidPct,
      agentName: (inst.agentId && agentNameById.get(inst.agentId)) || '—',
    });
  });

  const avgPaidPct = rows.length > 0 ? Math.round(paidPctSum / rows.length) : 0;

  return {
    title: 'reports.partialPayment.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'dueDate', label: 'reports.col.dueDate', align: 'center', type: 'date' },
      { key: 'dueAmount', label: 'reports.col.due', align: 'right', type: 'currency', total: true },
      { key: 'receivedAmount', label: 'reports.col.paid', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency', total: true },
      { key: 'paidPct', label: 'reports.col.paidPct', align: 'right', type: 'percent' },
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
    ],
    rows,
    totals: {
      dueAmount: totalDue,
      receivedAmount: totalPaid,
      balance: totalBalance,
    },
    kpis: [
      { label: 'partialCount', value: rows.length },
      { label: 'totalBalanceOwed', value: totalBalance, tone: totalBalance > 0 ? 'warn' : 'good' },
      { label: 'avgPaidPct', value: `${avgPaidPct}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
