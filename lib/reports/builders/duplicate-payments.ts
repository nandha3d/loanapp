import prisma from '../../db';
import { getSetting } from '../../tenant';
import { ReportBuilderParams, ReportPayload } from '../types';

// Spec: docs/parity/reports/13-duplicate-payments.md
// NOTE: detection is read-only — flags candidate groups for human review, no merge/void action.
// Uses CollectionEntry (field-collection entries) grouped by loanId + receivedAmount + calendar
// day, refined to a configurable minute window via submittedAt timestamps.
export async function buildDuplicatePayments(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const windowMin = Number(await getSetting(tenantId, 'report_duplicate_window_min', '60')) || 60;
  const windowMs = windowMin * 60 * 1000;

  const branchFilter = branchId ? { loan: { branchId } } : {};

  const entries = await prisma.collectionEntry.findMany({
    where: {
      tenantId,
      submittedAt: { gte: dateFrom, lte: dateTo },
      ...branchFilter,
    },
    include: {
      loan: { select: { loanCode: true } },
      customer: { select: { name: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  // Group by loanId + receivedAmount + calendar day
  const groupMap = new Map<
    string,
    { loanId: string; loanCode: string; customerName: string; amount: number; entries: typeof entries }
  >();

  entries.forEach((e) => {
    const day = e.submittedAt.toISOString().slice(0, 10);
    const amount = Number(e.receivedAmount);
    const key = `${e.loanId}|${amount}|${day}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { loanId: e.loanId, loanCode: e.loan?.loanCode || '', customerName: e.customer?.name || '', amount, entries: [] as any });
    }
    groupMap.get(key)!.entries.push(e);
  });

  let suspectedAmount = 0;
  const loansAffected = new Set<string>();
  const rows: Record<string, any>[] = [];

  groupMap.forEach((group) => {
    if (group.entries.length < 2) return;
    // Refine by time window: flag if any two entries in the group fall within windowMin minutes.
    const sorted = [...group.entries].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    let withinWindow = false;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].submittedAt.getTime() - sorted[i - 1].submittedAt.getTime() <= windowMs) {
        withinWindow = true;
        break;
      }
    }
    if (!withinWindow) return;

    suspectedAmount += group.amount * group.entries.length;
    loansAffected.add(group.loanId);

    rows.push({
      loanCode: group.loanCode,
      customerName: group.customerName,
      amount: group.amount,
      count: group.entries.length,
      timestamps: sorted.map((e) => e.submittedAt.toISOString().slice(11, 16)).join(', '),
      modes: Array.from(new Set(sorted.map((e) => e.paymentMode))).join(', '),
      flag: 'Duplicate suspected',
    });
  });

  return {
    title: 'reports.duplicatePayments.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'count', label: 'reports.col.count', align: 'right', type: 'number', total: true },
      { key: 'timestamps', label: 'reports.col.times', align: 'left', type: 'text' },
      { key: 'modes', label: 'reports.col.modes', align: 'left', type: 'text' },
      { key: 'flag', label: 'reports.col.flag', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      amount: rows.reduce((s, r) => s + r.amount, 0),
      count: rows.reduce((s, r) => s + r.count, 0),
    },
    kpis: [
      { label: 'duplicateGroups', value: rows.length, tone: rows.length > 0 ? 'warn' : 'good' },
      { label: 'suspectedAmount', value: suspectedAmount },
      { label: 'loansAffected', value: loansAffected.size },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
