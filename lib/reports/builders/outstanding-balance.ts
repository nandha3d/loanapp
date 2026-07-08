import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildOutstandingBalance(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, agentId, loanType } = params;

  const branchFilter = branchId ? { branchId } : {};

  // Fetch all loans matching the criteria
  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      status: { in: ['active', 'overdue'] },
      ...(loanType ? { loanType } : {}),
      ...(agentId ? { customer: { agentId } } : {}),
    },
    include: {
      customer: { select: { name: true } },
      penalties: {
        where: { status: 'pending' },
        select: { grossPenalty: true, settledAmount: true, waivedAmount: true },
      },
    },
  });

  let grandPrincipalOut = 0;
  let grandInterestOut = 0;
  let grandPenaltyOut = 0;
  let grandTotalOut = 0;

  const rows = loans.map((l) => {
    const principal = Number(l.principal);
    const payable = Number(l.totalPayable);
    const collected = Number(l.totalCollected || 0);

    const interestTotal = Math.max(0, payable - principal);
    const remainingPayable = Math.max(0, payable - collected);

    // Split based on principal / total payable ratio
    const principalRatio = payable > 0 ? principal / payable : 1;
    const principalOut = Math.max(0, remainingPayable * principalRatio);
    const interestOut = Math.max(0, remainingPayable * (1 - principalRatio));

    // Sum pending penalties
    const penaltyOut = l.penalties.reduce((sum, p) => {
      return sum + Math.max(0, Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount));
    }, 0);

    const totalOut = principalOut + interestOut + penaltyOut;

    grandPrincipalOut += principalOut;
    grandInterestOut += interestOut;
    grandPenaltyOut += penaltyOut;
    grandTotalOut += totalOut;

    return {
      group: l.loanCode,
      customerName: l.customer.name,
      principalOut,
      interestOut,
      penaltyOut,
      totalOut,
    };
  });

  return {
    title: 'reports.outstandingBalance.title',
    columns: [
      { key: 'group', label: 'reports.col.loanNo', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customer', align: 'left', type: 'text' },
      { key: 'principalOut', label: 'reports.col.principalOut', align: 'right', type: 'currency', total: true },
      { key: 'interestOut', label: 'reports.col.interestOut', align: 'right', type: 'currency', total: true },
      { key: 'penaltyOut', label: 'reports.col.penaltyOut', align: 'right', type: 'currency', total: true },
      { key: 'totalOut', label: 'reports.col.totalOut', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      principalOut: grandPrincipalOut,
      interestOut: grandInterestOut,
      penaltyOut: grandPenaltyOut,
      totalOut: grandTotalOut,
    },
    kpis: [
      { label: 'totalOutstanding', value: grandTotalOut },
      { label: 'outstandingPrincipal', value: grandPrincipalOut },
      { label: 'outstandingInterest', value: grandInterestOut },
      { label: 'outstandingPenalty', value: grandPenaltyOut },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
