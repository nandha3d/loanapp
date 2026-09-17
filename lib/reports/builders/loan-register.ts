import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
// no scope imports needed

export async function buildLoanRegister(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, loanType, status, frequency, minAmount, maxAmount } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const where: any = {
    tenantId,
    appType,
    ...branchFilter,
    startDate: { gte: dateFrom, lte: dateTo },
    ...(status ? { status } : {}),
    ...(loanType ? { loanType } : {}),
    ...(frequency ? { frequency } : {}),
    ...(agentId ? { customer: { agentId } } : {}),
    ...(minAmount || maxAmount ? {
      principal: {
        ...(minAmount ? { gte: minAmount } : {}),
        ...(maxAmount ? { lte: maxAmount } : {}),
      }
    } : {}),
  };

  const loans = await prisma.loan.findMany({
    where,
    include: {
      customer: { select: { name: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalPayable = 0;
  let totalOutstanding = 0;
  let activeCount = 0;

  const rows = loans.map((l) => {
    const principal = Number(l.principal);
    const payable = Number(l.totalPayable);
    const collected = Number(l.totalCollected || 0);
    const interest = Math.max(0, payable - principal);
    const outstanding = Math.max(0, payable - collected);

    totalPrincipal += principal;
    totalInterest += interest;
    totalPayable += payable;
    totalOutstanding += outstanding;
    if (l.status === 'active') activeCount++;

    return {
      loanCode: l.loanCode,
      customerName: l.customer.name,
      loanType: l.loanType,
      principal,
      interest,
      totalPayable: payable,
      frequency: l.frequency,
      startDate: l.startDate,
      endDate: l.endDate,
      outstanding,
      status: l.status,
    };
  });

  return {
    title: 'reports.loanRegister.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanType', label: 'reports.col.loanType', align: 'left', type: 'badge' },
      { key: 'principal', label: 'reports.col.principal', align: 'right', type: 'currency', total: true },
      { key: 'interest', label: 'reports.col.interest', align: 'right', type: 'currency', total: true },
      { key: 'totalPayable', label: 'reports.col.totalPayable', align: 'right', type: 'currency', total: true },
      { key: 'frequency', label: 'reports.col.frequency', align: 'center', type: 'text' },
      { key: 'startDate', label: 'reports.col.startDate', align: 'center', type: 'date' },
      { key: 'endDate', label: 'reports.col.endDate', align: 'center', type: 'date' },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      principal: totalPrincipal,
      interest: totalInterest,
      totalPayable: totalPayable,
      outstanding: totalOutstanding,
    },
    kpis: [
      { label: 'totalLoans', value: loans.length },
      { label: 'totalPrincipal', value: totalPrincipal },
      { label: 'totalOutstanding', value: totalOutstanding },
      { label: 'activeLoans', value: activeCount },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
