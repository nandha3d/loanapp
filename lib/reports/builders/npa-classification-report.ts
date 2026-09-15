import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildNpaClassificationReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, status } = params;

  // Note: npaStatus/provisioningAmount on Loan reflect the *current* live
  // classification (set by the existing npa classifier job), not a point-in-time
  // snapshot — so `asOf`/`from`/`to` are not applied here, matching the direct-query
  // approach. For historical snapshots, see LoanProvisioning / getNpaSummary.
  const branchFilter = branchId ? { branchId } : {};

  // Query Loan directly using the existing npa*/provisioning* fields (read-only,
  // no reclassification performed). Equivalent to wrapping getNpaSummary/listNpaLoans
  // but scoped per-appType/branch for the report shell.
  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      ...branchFilter,
      deletedAt: null,
      ...(status ? { provisioningCategory: status } : {}),
    },
    select: {
      loanCode: true,
      npaStatus: true,
      npaDaysOverdue: true,
      provisioningCategory: true,
      provisioningRate: true,
      provisioningAmount: true,
      isSecured: true,
      totalPayable: true,
      totalCollected: true,
      customer: { select: { name: true } },
    },
    orderBy: { npaDaysOverdue: 'desc' },
  });

  let totalOutstanding = 0;
  let totalProvision = 0;
  let npaCount = 0;
  let npaOutstanding = 0;

  // Drill-down rows: loans not in 'standard' category (i.e. flagged NPA-ish).
  const rows = loans
    .filter((l) => l.npaStatus && l.npaStatus !== 'standard')
    .map((l) => {
      const outstanding = Math.max(0, Number(l.totalPayable) - Number(l.totalCollected));
      const provisioningAmount = Number(l.provisioningAmount);
      const provisioningRate = Number(l.provisioningRate);

      totalOutstanding += outstanding;
      totalProvision += provisioningAmount;
      npaCount++;
      npaOutstanding += outstanding;

      return {
        loanCode: l.loanCode,
        customerName: l.customer.name,
        npaDaysOverdue: l.npaDaysOverdue,
        provisioningCategory: l.provisioningCategory,
        outstanding,
        provisioningRate,
        provisioningAmount,
        isSecured: l.isSecured,
      };
    });

  // Gross NPA ratio = NPA outstanding / total outstanding across all loans
  // in scope (matches getNpaSummary's grossNpaRatio calc, computed locally
  // here since this query is already scoped by appType/branch).
  const grandTotalOutstanding = loans.reduce(
    (sum, l) => sum + Math.max(0, Number(l.totalPayable) - Number(l.totalCollected)),
    0,
  );
  const grossNpaRatio = grandTotalOutstanding > 0 ? (npaOutstanding / grandTotalOutstanding) * 100 : 0;

  return {
    title: 'reports.npaClassification.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'npaDaysOverdue', label: 'reports.col.daysOverdue', align: 'right', type: 'number' },
      { key: 'provisioningCategory', label: 'reports.col.category', align: 'center', type: 'badge' },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'provisioningRate', label: 'reports.col.provisioningRate', align: 'right', type: 'percent' },
      { key: 'provisioningAmount', label: 'reports.col.provisionAmount', align: 'right', type: 'currency', total: true },
      { key: 'isSecured', label: 'reports.col.secured', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      outstanding: totalOutstanding,
      provisioningAmount: totalProvision,
    },
    kpis: [
      { label: 'npaCount', value: npaCount, tone: npaCount > 0 ? 'warn' : 'good' },
      { label: 'grossNpa', value: npaOutstanding, tone: 'bad' },
      { label: 'provisionRequired', value: totalProvision },
      { label: 'npaRatio', value: Math.round(grossNpaRatio * 100) / 100 },
    ],
    meta: { currencySymbol: '₹' },
  };
}
