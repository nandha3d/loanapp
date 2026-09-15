import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/13-cancelled-payments.md
// NOTE: no cancelled/void status exists on Payment. The closest real concept is CollectionEntry
// rows that were rejected during verification (verificationStatus='rejected') — these are
// field-collection entries nullified after entry, used here per task guidance.
export async function buildCancelledPayments(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { loan: { branchId } } : {};

  const entries = await prisma.collectionEntry.findMany({
    where: {
      tenantId,
      verificationStatus: 'rejected',
      submittedAt: { gte: dateFrom, lte: dateTo },
      ...branchFilter,
    },
    include: {
      loan: { select: { loanCode: true } },
      customer: { select: { name: true } },
      agent: { select: { name: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });

  let totalAmount = 0;
  const reasonCounts = new Map<string, number>();

  const rows = entries.map((e) => {
    const amount = Number(e.receivedAmount);
    totalAmount += amount;
    const reason = e.remarks || 'Rejected during verification';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    return {
      paymentDate: e.submittedAt.toISOString().slice(0, 10),
      cancelledAt: e.submittedAt.toISOString().slice(0, 10),
      customerName: e.customer?.name || '',
      loanCode: e.loan?.loanCode || '',
      amount,
      reason,
      cancelledBy: e.agent?.name || '',
    };
  });

  let topReason = '';
  let topReasonCount = 0;
  reasonCounts.forEach((count, reason) => {
    if (count > topReasonCount) {
      topReasonCount = count;
      topReason = reason;
    }
  });

  return {
    title: 'reports.cancelledPayments.title',
    columns: [
      { key: 'paymentDate', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'cancelledAt', label: 'reports.col.cancelledDate', align: 'left', type: 'date' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'reason', label: 'reports.col.reason', align: 'left', type: 'text' },
      { key: 'cancelledBy', label: 'reports.col.cancelledBy', align: 'left', type: 'text' },
    ],
    rows,
    totals: {
      amount: totalAmount,
    },
    kpis: [
      { label: 'cancelledCount', value: rows.length },
      { label: 'cancelledValue', value: totalAmount },
      { label: 'topReason', value: topReason || '-' },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
