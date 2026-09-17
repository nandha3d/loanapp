import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/13-refund-report.md
// NOTE: no dedicated refund table exists in this schema. The closest real reversal/adjustment
// concept is AccountEntry where type='adjustment'. Labelled clearly as "Adjustment/Refund
// Entries" — this is NOT a dedicated refund ledger.
export async function buildRefundReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const entries = await prisma.accountEntry.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      type: 'adjustment',
      entryDate: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { entryDate: 'desc' },
  });

  // referenceId/referenceType point at loan/payment when set; resolve loan code where possible.
  const loanIds = Array.from(
    new Set(entries.filter((e) => e.referenceType === 'loan' && e.referenceId).map((e) => e.referenceId as string))
  );
  const loans = loanIds.length
    ? await prisma.loan.findMany({ where: { id: { in: loanIds } }, select: { id: true, loanCode: true, customer: { select: { name: true } } } })
    : [];
  const loanMap = new Map(loans.map((l) => [l.id, l]));

  let totalAmount = 0;
  const rows = entries.map((e) => {
    const amount = Number(e.amount);
    totalAmount += amount;
    const loan = e.referenceType === 'loan' && e.referenceId ? loanMap.get(e.referenceId) : undefined;
    return {
      paymentDate: e.entryDate.toISOString().slice(0, 10),
      customerName: loan?.customer?.name || '',
      loanCode: loan?.loanCode || '',
      originalRef: e.referenceId || '',
      reason: e.description || 'Adjustment / Refund entry',
      amount,
      approvedBy: e.createdBy || '',
    };
  });

  const avgRefund = rows.length > 0 ? totalAmount / rows.length : 0;

  return {
    title: 'reports.refund.title',
    columns: [
      { key: 'paymentDate', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'originalRef', label: 'reports.col.originalRef', align: 'left', type: 'text' },
      { key: 'reason', label: 'reports.col.reason', align: 'left', type: 'text' },
      { key: 'amount', label: 'reports.col.refundAmount', align: 'right', type: 'currency', total: true },
      { key: 'approvedBy', label: 'reports.col.approvedBy', align: 'left', type: 'text' },
    ],
    rows,
    totals: {
      amount: totalAmount,
    },
    kpis: [
      { label: 'refundCount', value: rows.length },
      { label: 'totalRefunded', value: totalAmount },
      { label: 'avgRefund', value: Math.round(avgRefund) },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
