import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/13-failed-payments.md
// NOTE: the schema has no failed-status field on Payment (gold-pledge servicing payments).
// The real "failed payment attempt" data source is ClientPaymentToken (online self-pay
// link/QR attempts) with status='failed' — used here per task guidance.
export async function buildFailedPayments(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, paymentMode } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const tokens = await prisma.clientPaymentToken.findMany({
    where: {
      tenantId,
      status: 'failed',
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(paymentMode ? { channel: paymentMode } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  // ClientPaymentToken has no declared relations to Customer/Loan in the schema, so resolve
  // names/codes via separate lookups instead of `include`.
  const customerIds = Array.from(new Set(tokens.map((t) => t.customerId)));
  const loanIds = Array.from(new Set(tokens.map((t) => t.loanId)));
  const [customers, loans] = await Promise.all([
    customerIds.length
      ? prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    loanIds.length
      ? prisma.loan.findMany({ where: { id: { in: loanIds } }, select: { id: true, loanCode: true } })
      : Promise.resolve([]),
  ]);
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const loanMap = new Map(loans.map((l) => [l.id, l.loanCode]));

  let totalAmount = 0;
  const reasonCounts = new Map<string, number>();

  const rows = tokens.map((t) => {
    const amount = Number(t.amount);
    totalAmount += amount;
    // No dedicated failure-reason field exists on ClientPaymentToken; expired vs failed-at-gateway
    // is the closest distinguishable signal available without inventing a field.
    const reason = t.expiresAt && t.expiresAt < new Date() ? 'Expired / Timed out' : 'Gateway declined';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    return {
      paymentDate: t.createdAt.toISOString().slice(0, 10),
      customerName: customerMap.get(t.customerId) || '',
      loanCode: loanMap.get(t.loanId) || '',
      paymentMode: t.channel,
      amount,
      failReason: reason,
      retryable: 'Yes',
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
    title: 'reports.failedPayments.title',
    columns: [
      { key: 'paymentDate', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'paymentMode', label: 'reports.col.mode', align: 'center', type: 'badge' },
      { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'failReason', label: 'reports.col.reason', align: 'left', type: 'text' },
      { key: 'retryable', label: 'reports.col.retry', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      amount: totalAmount,
    },
    kpis: [
      { label: 'failedCount', value: rows.length, tone: rows.length > 0 ? 'warn' : 'good' },
      { label: 'failedValue', value: totalAmount },
      { label: 'topFailureReason', value: topReason || '-' },
      { label: 'retryablePct', value: rows.length > 0 ? '100%' : '0%' },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
