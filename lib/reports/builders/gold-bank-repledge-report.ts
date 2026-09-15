import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildGoldBankRepledgeReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const repledges = await prisma.bankRepledge.findMany({
    where: {
      tenantId,
      bankDate: { gte: dateFrom, lte: dateTo },
      ...(status ? { status } : {}),
      loan: { tenantId, appType, ...branchFilter },
    },
    include: {
      loan: { select: { loanCode: true } },
    },
    orderBy: { bankDate: 'desc' },
  });

  let totalAmountFromBank = 0;
  let totalProcessingFee = 0;
  let totalInterestRate = 0;
  let interestRateCount = 0;
  let activeCount = 0;

  const rows = repledges.map((r) => {
    const amountGivenByBank = Number(r.amountGivenByBank);
    const interestRate = r.interestRate !== null ? Number(r.interestRate) : null;
    const processingFee = Number(r.processingFee);

    totalAmountFromBank += amountGivenByBank;
    totalProcessingFee += processingFee;
    if (interestRate !== null) {
      totalInterestRate += interestRate;
      interestRateCount++;
    }
    if (r.status === 'active') activeCount++;

    return {
      bankName: r.bankName,
      referenceNo: r.referenceNo || '-',
      bankDate: r.bankDate,
      loanCode: r.loan.loanCode,
      amountGivenByBank,
      interestRate,
      processingFee,
      status: r.status,
    };
  });

  const avgInterestRate = interestRateCount > 0 ? totalInterestRate / interestRateCount : 0;

  return {
    title: 'reports.goldBankRepledge.title',
    columns: [
      { key: 'bankName', label: 'reports.col.bank', align: 'left', type: 'text' },
      { key: 'referenceNo', label: 'reports.col.refNo', align: 'left', type: 'text' },
      { key: 'bankDate', label: 'reports.col.date', align: 'center', type: 'date' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'amountGivenByBank', label: 'reports.col.amountFromBank', align: 'right', type: 'currency', total: true },
      { key: 'interestRate', label: 'reports.col.interestRate', align: 'right', type: 'percent' },
      { key: 'processingFee', label: 'reports.col.processingFee', align: 'right', type: 'currency', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      amountGivenByBank: totalAmountFromBank,
      processingFee: totalProcessingFee,
    },
    kpis: [
      { label: 'activeRepledges', value: activeCount },
      { label: 'totalDrawnFromBanks', value: totalAmountFromBank },
      { label: 'avgInterestRate', value: Math.round(avgInterestRate * 100) / 100 },
      { label: 'feesPaid', value: totalProcessingFee },
    ],
    meta: { currencySymbol: '₹' },
  };
}
