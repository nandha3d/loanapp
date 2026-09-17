import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildDisbursement(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      startDate: { gte: dateFrom, lte: dateTo },
      ...(agentId ? { customer: { agentId } } : {}),
    },
    select: {
      startDate: true,
      principal: true,
      disbursed: true,
      deduction: true,
    },
    orderBy: { startDate: 'desc' },
  });

  // Group by Date (YYYY-MM-DD)
  const groupMap = new Map<string, { count: number; principal: number; disbursed: number; deduction: number }>();

  loans.forEach((l) => {
    const key = l.startDate.toISOString().slice(0, 10);
    if (!groupMap.has(key)) {
      groupMap.set(key, { count: 0, principal: 0, disbursed: 0, deduction: 0 });
    }

    const item = groupMap.get(key)!;
    item.count++;
    item.principal += Number(l.principal);
    item.disbursed += Number(l.disbursed);
    item.deduction += Number(l.deduction || 0);
  });

  let grandCount = 0;
  let grandPrincipal = 0;
  let grandDisbursed = 0;
  let grandDeduction = 0;

  const rows = Array.from(groupMap.entries()).map(([dateStr, item]) => {
    grandCount += item.count;
    grandPrincipal += item.principal;
    grandDisbursed += item.disbursed;
    grandDeduction += item.deduction;

    return {
      group: dateStr,
      count: item.count,
      principal: item.principal,
      disbursed: item.disbursed,
      deduction: item.deduction,
    };
  });

  const avgTicket = grandCount > 0 ? Math.round(grandPrincipal / grandCount) : 0;

  return {
    title: 'reports.disbursement.title',
    columns: [
      { key: 'group', label: 'reports.col.group', align: 'left', type: 'text' },
      { key: 'count', label: 'reports.col.count', align: 'right', type: 'number', total: true },
      { key: 'principal', label: 'reports.col.principal', align: 'right', type: 'currency', total: true },
      { key: 'disbursed', label: 'reports.col.disbursed', align: 'right', type: 'currency', total: true },
      { key: 'deduction', label: 'reports.col.deductions', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      count: grandCount,
      principal: grandPrincipal,
      disbursed: grandDisbursed,
      deduction: grandDeduction,
    },
    kpis: [
      { label: 'totalDisbursed', value: grandDisbursed },
      { label: 'totalLoanCount', value: grandCount },
      { label: 'avgTicketSize', value: avgTicket },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
