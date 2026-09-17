import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildMissedCollectionReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, routeId } = params;

  const branchFilter = branchId ? { branchId } : {};

  // Default both ends to "today" when not supplied.
  const today = new Date();
  const dateFrom = from ? new Date(from) : new Date(today);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = to ? new Date(to) : new Date(today);
  dateTo.setHours(23, 59, 59, 999);

  const instalments = await prisma.instalment.findMany({
    where: {
      loan: {
        tenantId,
        appType,
        ...branchFilter,
        ...(agentId ? { customer: { agentId } } : {}),
        ...(routeId ? { customer: { routeId } } : {}),
      },
      dueDate: { gte: dateFrom, lte: dateTo },
      status: { in: ['missed', 'partial', 'upcoming'] },
    },
    include: {
      loan: {
        select: {
          loanCode: true,
          customer: { select: { name: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Resolve agent names for the rows that have an agentId on the instalment.
  const agentIds = Array.from(new Set(instalments.map((i) => i.agentId).filter(Boolean))) as string[];
  const agents = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

  let totalDue = 0;
  let totalReceived = 0;
  let totalShortfall = 0;

  const byAgentShortfall = new Map<string, number>();

  const rows = instalments
    .map((i) => {
      const dueAmount = Number(i.dueAmount);
      const receivedAmount = Number(i.receivedAmount || 0);
      const shortfall = Math.max(0, dueAmount - receivedAmount);
      return { i, dueAmount, receivedAmount, shortfall };
    })
    .filter((r) => r.shortfall > 0)
    .map(({ i, dueAmount, receivedAmount, shortfall }) => {
      totalDue += dueAmount;
      totalReceived += receivedAmount;
      totalShortfall += shortfall;

      const agentName = i.agentId ? agentNameById.get(i.agentId) || '—' : '—';
      if (agentName !== '—') {
        byAgentShortfall.set(agentName, (byAgentShortfall.get(agentName) || 0) + shortfall);
      }

      return {
        customerName: i.loan.customer.name,
        loanCode: i.loan.loanCode,
        dueDate: i.dueDate,
        dueAmount,
        receivedAmount,
        shortfall,
        agentName,
        phone: i.loan.customer.phone,
      };
    })
    .sort((a, b) => b.shortfall - a.shortfall);

  let worstAgent = '—';
  let worstShortfall = -1;
  for (const [name, amt] of byAgentShortfall.entries()) {
    if (amt > worstShortfall) {
      worstShortfall = amt;
      worstAgent = name;
    }
  }

  return {
    title: 'reports.missedCollection.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customer', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanNo', align: 'left', type: 'text' },
      { key: 'dueDate', label: 'reports.col.dueDate', align: 'center', type: 'date' },
      { key: 'dueAmount', label: 'reports.col.amountDue', align: 'right', type: 'currency', total: true },
      { key: 'receivedAmount', label: 'reports.col.received', align: 'right', type: 'currency', total: true },
      { key: 'shortfall', label: 'reports.col.shortfall', align: 'right', type: 'currency', total: true },
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'phone', label: 'reports.col.phone', align: 'left', type: 'text' },
    ],
    rows,
    totals: {
      dueAmount: totalDue,
      receivedAmount: totalReceived,
      shortfall: totalShortfall,
    },
    kpis: [
      { label: 'missedCount', value: rows.length },
      { label: 'totalShortfall', value: totalShortfall, tone: rows.length > 0 ? 'bad' : 'good' },
      { label: 'worstAgent', value: worstAgent },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
