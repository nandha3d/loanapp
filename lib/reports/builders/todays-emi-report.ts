import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { startOfBusinessToday, startOfBusinessTomorrow } from '../../businessTime';
import { COLLECTIBLE_LOAN_STATUSES } from '../../collectionPolicy';

export async function buildTodaysEmiReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId, routeId, status } = params;

  // Always "today" — from/to are ignored per spec (this is a day worklist,
  // not a date-range report).
  const today = startOfBusinessToday();
  const tomorrow = startOfBusinessTomorrow();

  const branchFilter = branchId ? { branchId } : {};

  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: today, lt: tomorrow },
      status: { in: status ? [status] : ['upcoming', 'missed'] },
      ...(agentId ? { agentId } : {}),
      loan: {
        tenantId,
        appType,
        status: { in: [...COLLECTIBLE_LOAN_STATUSES] },
        ...branchFilter,
        ...(routeId ? { customer: { routeId } } : {}),
      },
    },
    include: {
      loan: {
        select: {
          loanCode: true,
          customer: { select: { name: true, route: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
  });

  // Instalment.agentId has no Prisma relation to User, so resolve agent
  // names with a single follow-up lookup keyed on the distinct ids.
  const agentIds = Array.from(new Set(instalments.map(i => i.agentId).filter((id): id is string => !!id)));
  const agents = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const agentNameById = new Map(agents.map(a => [a.id, a.name]));

  let totalDue = 0;
  let totalCollected = 0;
  let totalPending = 0;

  const rows = instalments.map((inst) => {
    const due = Number(inst.dueAmount);
    const collected = Number(inst.receivedAmount || 0);
    const pending = Math.max(0, due - collected);

    totalDue += due;
    totalCollected += collected;
    totalPending += pending;

    return {
      customerName: inst.loan?.customer?.name || '—',
      loanCode: inst.loan?.loanCode || '—',
      dueAmount: due,
      receivedAmount: collected,
      pending,
      agentName: (inst.agentId && agentNameById.get(inst.agentId)) || '—',
      routeName: inst.loan?.customer?.route?.name || '—',
      status: inst.status,
    };
  });

  return {
    title: 'reports.todaysEmi.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'dueAmount', label: 'reports.col.amountDue', align: 'right', type: 'currency', total: true },
      { key: 'receivedAmount', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'pending', label: 'reports.col.pending', align: 'right', type: 'currency', total: true },
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'routeName', label: 'reports.col.route', align: 'left', type: 'text' },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      dueAmount: totalDue,
      receivedAmount: totalCollected,
      pending: totalPending,
    },
    kpis: [
      { label: 'totalDueToday', value: totalDue },
      { label: 'collectedSoFar', value: totalCollected, tone: 'good' },
      { label: 'pending', value: totalPending, tone: totalPending > 0 ? 'warn' : 'good' },
      { label: 'count', value: rows.length },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
