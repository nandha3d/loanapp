import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { getSetting } from '../../tenant';

export async function buildUpcomingEmiReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId, routeId, loanType } = params;

  const branchFilter = branchId ? { branchId } : {};

  const windowSetting = await getSetting(tenantId, 'report_upcoming_windows', '3,7,15');
  const windows = windowSetting.split(',').map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
  const maxWindow = windows[windows.length - 1] || 15;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + maxWindow);
  cutoff.setHours(23, 59, 59, 999);

  const instalments = await prisma.instalment.findMany({
    where: {
      status: 'upcoming',
      dueDate: { gte: today, lte: cutoff },
      ...(agentId ? { agentId } : {}),
      loan: {
        tenantId,
        appType,
        ...branchFilter,
        ...(loanType ? { loanType } : {}),
        ...(routeId ? { customer: { routeId } } : {}),
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

  const nowTime = today.getTime();

  // Per-window KPI accumulators: count + amount for each configured window.
  const windowStats = windows.map(w => ({ window: w, count: 0, amount: 0 }));

  let totalAmount = 0;

  const rows = instalments.map((inst) => {
    const dueDate = new Date(inst.dueDate);
    const daysToDue = Math.max(0, Math.round((dueDate.getTime() - nowTime) / 86400000));
    const amount = Number(inst.dueAmount);

    // Smallest configured window that still covers this instalment.
    const windowEdge = windows.find(w => daysToDue <= w) ?? maxWindow;
    const stat = windowStats.find(s => s.window === windowEdge);
    if (stat) {
      stat.count += 1;
      stat.amount += amount;
    }
    totalAmount += amount;

    return {
      customerName: inst.loan?.customer?.name || '—',
      loanCode: inst.loan?.loanCode || '—',
      dueDate: inst.dueDate,
      daysToDue,
      dueAmount: amount,
      window: `≤${windowEdge}`,
      agentName: (inst.agentId && agentNameById.get(inst.agentId)) || '—',
    };
  });

  const kpis = windowStats.map(s => ({
    label: `dueNext${s.window}d`,
    value: `${s.count} / ₹${s.amount.toLocaleString('en-IN')}`,
  }));

  return {
    title: 'reports.upcomingEmi.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'dueDate', label: 'reports.col.dueDate', align: 'center', type: 'date' },
      { key: 'daysToDue', label: 'reports.col.daysToDue', align: 'right', type: 'number' },
      { key: 'dueAmount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'window', label: 'reports.col.window', align: 'center', type: 'badge' },
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
    ],
    rows,
    totals: {
      dueAmount: totalAmount,
    },
    kpis,
    meta: {
      currencySymbol: '₹',
    },
  };
}
