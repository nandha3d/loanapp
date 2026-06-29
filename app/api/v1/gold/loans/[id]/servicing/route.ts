import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { writeAudit } from '@/lib/audit';
import { getGoldConfig } from '@/lib/gold/settings';
import { computeServicing, monthsCoveredByPayment, advanceByMonths } from '@/lib/gold/servicing';
import { applyPartPayment, type PartialMonthRule } from '@/lib/gold/pledgeInterest';

// Gold pledge servicing: interest payment, part-payment, redemption. Reuses the
// generic Payment record (paymentType) + collateral servicing columns. All
// money math comes from lib/gold (no ad-hoc recompute, no hardcode).

async function loadPledge(
  id: string,
  ctx: { tenantId: string; appType: string; branchId: string | null; role: string; userId: string },
) {
  const loan = await prisma.loan.findFirst({
    where: { id, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx) },
  });
  if (!loan) return null;
  const collateral = await prisma.goldLoanCollateral.findUnique({ where: { loanId: loan.id } });
  return { loan, collateral };
}

function rule(config: any): PartialMonthRule {
  return config?.processingFeePercentageBased === true ? 'full' : 'full'; // default full-month
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const pledge = await loadPledge(id, ctx);
  if (!pledge) return fail('Pledge not found', 404);
  const { loan, collateral } = pledge;

  const config = await getGoldConfig(ctx.tenantId);
  const ratePercent = config.goldInterestPercent ?? 0;
  const outstanding = Number(collateral?.outstandingPrincipal ?? loan.principal);
  const paidUpto = collateral?.interestPaidUpto ?? loan.startDate;

  const summary = computeServicing({
    outstandingPrincipal: outstanding,
    monthlyRatePercent: ratePercent,
    interestPaidUpto: new Date(paidUpto),
    now: new Date(),
    rule: rule(config),
  });

  const payments = await prisma.payment.findMany({
    where: { loanId: loan.id, paymentType: { in: ['interest', 'part', 'redemption'] } },
    orderBy: { paymentDate: 'desc' },
  });

  return ok({
    loanId: loan.id,
    loanCode: loan.loanCode,
    status: loan.status,
    ratePercent,
    interestPaidUpto: paidUpto,
    ...summary,
    payments,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (ctx.role === 'agent') return fail('Forbidden', 403);
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const amount = Number(body.amount) || 0;
  const paymentMode = String(body.paymentMode || 'cash');
  const paidOn = body.paidOn ? new Date(body.paidOn) : new Date();
  if (!['interest', 'part', 'redeem'].includes(action)) {
    return fail('action must be interest | part | redeem', 400);
  }

  const pledge = await loadPledge(id, ctx);
  if (!pledge) return fail('Pledge not found', 404);
  const { loan, collateral } = pledge;
  if (loan.status === 'closed') return fail('Pledge already closed', 409);

  const config = await getGoldConfig(ctx.tenantId);
  const ratePercent = config.goldInterestPercent ?? 0;
  const outstanding = Number(collateral?.outstandingPrincipal ?? loan.principal);
  const paidUpto = new Date(collateral?.interestPaidUpto ?? loan.startDate);
  const summary = computeServicing({
    outstandingPrincipal: outstanding,
    monthlyRatePercent: ratePercent,
    interestPaidUpto: paidUpto,
    now: paidOn,
    rule: rule(config),
  });

  const ensureCollateral = async () => {
    // A pre-existing pledge may have no servicing row yet — create a thin one.
    if (collateral) return collateral;
    return prisma.goldLoanCollateral.create({
      data: {
        tenantId: ctx.tenantId, branchId: loan.branchId, loanId: loan.id, customerId: loan.customerId,
        grossWeightGrams: 0, netWeightGrams: 0, purityKarat: '22K',
        outstandingPrincipal: outstanding, interestPaidUpto: paidUpto,
      },
    });
  };

  if (action === 'interest') {
    if (amount <= 0) return fail('amount required', 400);
    const monthsPaid = monthsCoveredByPayment(amount, summary.monthlyInterest);
    const newUpto = advanceByMonths(paidUpto, monthsPaid);
    await prisma.payment.create({
      data: { tenantId: ctx.tenantId, loanId: loan.id, amount, paymentMode, paymentType: 'interest', paymentDate: paidOn },
    });
    const col = await ensureCollateral();
    await prisma.goldLoanCollateral.update({ where: { id: col.id }, data: { interestPaidUpto: newUpto } });
    await writeAudit({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'gold_interest', entityType: 'loan', entityId: loan.id, newValue: { amount, monthsPaid } });
    return ok({ recorded: 'interest', amount, interestPaidUpto: newUpto });
  }

  if (action === 'part') {
    if (amount <= 0) return fail('amount required', 400);
    const newOutstanding = applyPartPayment(outstanding, amount);
    await prisma.payment.create({
      data: { tenantId: ctx.tenantId, loanId: loan.id, amount, paymentMode, paymentType: 'part', paymentDate: paidOn },
    });
    const col = await ensureCollateral();
    await prisma.goldLoanCollateral.update({ where: { id: col.id }, data: { outstandingPrincipal: newOutstanding } });
    await writeAudit({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'gold_part_payment', entityType: 'loan', entityId: loan.id, newValue: { amount, newOutstanding } });
    return ok({ recorded: 'part', amount, outstandingPrincipal: newOutstanding });
  }

  // redeem — pay outstanding + interest due, close the pledge, release ornaments
  const redeemAmount = summary.redemptionAmount;
  const col = await ensureCollateral();
  await prisma.$transaction([
    prisma.payment.create({
      data: { tenantId: ctx.tenantId, loanId: loan.id, amount: redeemAmount, paymentMode, paymentType: 'redemption', paymentDate: paidOn },
    }),
    prisma.goldLoanCollateral.update({
      where: { id: col.id },
      data: { outstandingPrincipal: 0, interestPaidUpto: paidOn, releaseStatus: 'released', releasedAt: paidOn },
    }),
    prisma.loan.update({ where: { id: loan.id }, data: { status: 'closed', closureType: 'redeemed' } }),
  ]);
  await writeAudit({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'gold_redeem', entityType: 'loan', entityId: loan.id, newValue: { redeemAmount } });
  return ok({ recorded: 'redemption', amount: redeemAmount, status: 'closed' });
}
