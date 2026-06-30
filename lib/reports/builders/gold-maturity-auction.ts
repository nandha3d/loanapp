import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';
import { getGoldConfig } from '../../gold/settings';
import { getSetting } from '../../tenant';
import { pledgeInterestDue } from '../../gold/pledgeInterest';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildGoldMaturityAuction(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, status } = params;
  const asOf = params.to ? new Date(params.to) : new Date();
  asOf.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const [config, graceDaysRaw] = await Promise.all([
    getGoldConfig(tenantId),
    getSetting(tenantId, 'gold_auction_grace_days', '15'),
  ]);
  const schemeMonths = config.interestSchemeMonths || 1;
  const graceDays = Number(graceDaysRaw) || 15;
  const interestRate = config.goldInterestPercent || 0;

  const pledges = await prisma.goldLoanCollateral.findMany({
    where: {
      tenantId,
      ...branchFilter,
      releaseStatus: 'pledged',
      loan: { tenantId, appType, ...branchFilter },
    },
    include: {
      loan: { select: { loanCode: true, startDate: true, penaltyRate: true, principal: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalOutstanding = 0;
  let totalInterestDue = 0;
  let maturingCount = 0;
  let maturedCount = 0;
  let auctionEligibleCount = 0;

  const rows = pledges
    .map((p) => {
      const startDate = p.loan.startDate;
      const maturityDate = new Date(startDate);
      maturityDate.setMonth(maturityDate.getMonth() + schemeMonths);

      const daysOverdue = Math.max(0, Math.floor((asOf.getTime() - maturityDate.getTime()) / DAY_MS));
      const outstandingPrincipal = Number(p.outstandingPrincipal ?? p.loan.principal);

      // Interest due via existing pledgeInterestDue() engine — reused, not reimplemented.
      const interestFrom = p.interestPaidUpto ? new Date(p.interestPaidUpto) : new Date(startDate);
      const { interestDue } = pledgeInterestDue(outstandingPrincipal, interestRate, interestFrom, asOf);

      let stage: 'maturing' | 'matured' | 'auction_eligible';
      if (daysOverdue > graceDays) stage = 'auction_eligible';
      else if (daysOverdue > 0) stage = 'matured';
      else stage = 'maturing';

      const daysToMaturity = Math.floor((maturityDate.getTime() - asOf.getTime()) / DAY_MS);
      // Only include pledges maturing within 30 days or already matured.
      if (daysToMaturity > 30) return null;

      if (stage === 'maturing') maturingCount++;
      if (stage === 'matured') maturedCount++;
      if (stage === 'auction_eligible') auctionEligibleCount++;

      totalOutstanding += outstandingPrincipal;
      totalInterestDue += interestDue;

      return {
        packetNo: p.packetNo || '-',
        customerName: p.customer.name,
        startDate,
        maturityDate,
        daysOverdue,
        outstandingPrincipal,
        interestDue,
        stage,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => !status || r.stage === status);

  return {
    title: 'reports.goldMaturityAuction.title',
    columns: [
      { key: 'packetNo', label: 'reports.col.packetNo', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'startDate', label: 'reports.col.pledgeDate', align: 'center', type: 'date' },
      { key: 'maturityDate', label: 'reports.col.maturityDate', align: 'center', type: 'date' },
      { key: 'daysOverdue', label: 'reports.col.daysOverdue', align: 'right', type: 'number' },
      { key: 'outstandingPrincipal', label: 'reports.col.osPrincipal', align: 'right', type: 'currency', total: true },
      { key: 'interestDue', label: 'reports.col.interestDue', align: 'right', type: 'currency', total: true },
      { key: 'stage', label: 'reports.col.stage', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      outstandingPrincipal: totalOutstanding,
      interestDue: totalInterestDue,
    },
    kpis: [
      { label: 'maturing', value: maturingCount, tone: 'warn' },
      { label: 'matured', value: maturedCount, tone: 'warn' },
      { label: 'auctionEligible', value: auctionEligibleCount, tone: 'bad' },
      { label: 'totalAtRiskValue', value: totalOutstanding },
    ],
    meta: { currencySymbol: '₹' },
  };
}
