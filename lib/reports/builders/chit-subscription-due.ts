import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildChitSubscriptionDue(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const subscriptions = await prisma.chitSubscription.findMany({
    where: {
      status: status ? status : { not: 'paid' },
      dueDate: { gte: dateFrom, lte: dateTo },
      member: {
        chitGroup: { tenantId, appType: 'chitfunds', ...branchFilter, deletedAt: null },
      },
    },
    include: {
      member: {
        include: {
          customer: { select: { name: true } },
          chitGroup: { select: { name: true } },
        },
      },
    },
    orderBy: { dueDate: 'desc' },
  });

  let totalDue = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  let overdueAmount = 0;
  const now = new Date();

  const rows = subscriptions
    .map((s) => {
      const dueAmount = Number(s.dueAmount);
      const paidAmount = Number(s.paidAmount);
      const balance = dueAmount - paidAmount;
      return { s, dueAmount, paidAmount, balance };
    })
    .filter((r) => r.balance > 0)
    .map(({ s, dueAmount, paidAmount, balance }) => {
      totalDue += dueAmount;
      totalPaid += paidAmount;
      totalBalance += balance;
      if (s.dueDate < now) overdueAmount += balance;

      return {
        chitName: s.member.chitGroup.name,
        memberName: s.member.customer.name,
        month: `Period ${s.periodNumber}`,
        dueAmount,
        paidAmount,
        balance,
        status: s.status,
      };
    });

  return {
    title: 'reports.chitSubscriptionDue.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', align: 'left', type: 'text' },
      { key: 'memberName', label: 'reports.col.member', align: 'left', type: 'text' },
      { key: 'month', label: 'reports.col.month', align: 'center', type: 'text' },
      { key: 'dueAmount', label: 'reports.col.subscriptionDue', align: 'right', type: 'currency', total: true },
      { key: 'paidAmount', label: 'reports.col.paid', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      dueAmount: totalDue,
      paidAmount: totalPaid,
      balance: totalBalance,
    },
    kpis: [
      { label: 'membersDue', value: rows.length },
      { label: 'totalSubscriptionDue', value: totalBalance },
      { label: 'overdueAmount', value: overdueAmount, tone: overdueAmount > 0 ? 'bad' : 'good' },
    ],
    meta: { currencySymbol: '₹' },
  };
}
