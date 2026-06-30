import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

function maskAadhaar(aadhar: string | null | undefined): string {
  if (!aadhar) return '';
  const digits = aadhar.replace(/\D/g, '');
  if (digits.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export async function buildCustomerRegister(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const where: any = {
    tenantId,
    appType,
    ...branchFilter,
    createdAt: { gte: dateFrom, lte: dateTo },
    ...(agentId ? { agentId } : {}),
    ...(status ? { status } : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    include: {
      loans: { select: { id: true, status: true, totalPayable: true, totalCollected: true } },
      guarantors: { select: { name: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalLoanCount = 0;
  let totalOutstanding = 0;
  let activeCount = 0;
  let withOutstandingCount = 0;
  let kycVerifiedCount = 0;

  const rows = customers.map((c) => {
    const loanCount = c.loans.length;
    const outstanding = c.loans.reduce((sum, l) => {
      const payable = Number(l.totalPayable);
      const collected = Number(l.totalCollected || 0);
      return sum + Math.max(0, payable - collected);
    }, 0);

    totalLoanCount += loanCount;
    totalOutstanding += outstanding;
    if (c.status === 'active') activeCount++;
    if (outstanding > 0) withOutstandingCount++;
    if (c.kycStatus === 'verified') kycVerifiedCount++;

    return {
      customerCode: c.customerCode,
      name: c.name,
      phone: c.phone,
      address: c.address || '',
      aadhaarMasked: maskAadhaar(c.aadharNumber),
      guarantor: c.guarantors[0]?.name || '',
      loanCount,
      outstanding,
      status: c.status,
    };
  });

  const kycVerifiedPct = customers.length > 0 ? Math.round((kycVerifiedCount / customers.length) * 100) : 0;

  return {
    title: 'reports.customerRegister.title',
    columns: [
      { key: 'customerCode', label: 'reports.col.code', align: 'left', type: 'text' },
      { key: 'name', label: 'reports.col.name', align: 'left', type: 'text' },
      { key: 'phone', label: 'reports.col.phone', align: 'left', type: 'text' },
      { key: 'address', label: 'reports.col.address', align: 'left', type: 'text' },
      { key: 'aadhaarMasked', label: 'reports.col.aadhaar', align: 'left', type: 'text' },
      { key: 'guarantor', label: 'reports.col.guarantor', align: 'left', type: 'text' },
      { key: 'loanCount', label: 'reports.col.loans', align: 'right', type: 'number', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      loanCount: totalLoanCount,
      outstanding: totalOutstanding,
    },
    kpis: [
      { label: 'totalCustomers', value: customers.length },
      { label: 'activeCustomers', value: activeCount },
      { label: 'withOutstanding', value: withOutstandingCount },
      { label: 'kycVerifiedPct', value: `${kycVerifiedPct}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
