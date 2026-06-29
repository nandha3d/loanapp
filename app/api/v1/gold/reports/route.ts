import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getGoldConfig } from '@/lib/gold/settings';
import { computeServicing } from '@/lib/gold/servicing';

// Gold reports + dashboard aggregates. ?type = pending | ornaments | summary.
// All money math comes from lib/gold (no ad-hoc recompute); rate from settings.

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const type = new URL(req.url).searchParams.get('type') || 'summary';

  const scope = { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx) };
  const config = await getGoldConfig(ctx.tenantId);
  const ratePercent = config.goldInterestPercent ?? 0;
  const now = new Date();

  if (type === 'pending') {
    const loans = await prisma.loan.findMany({
      where: { ...scope, status: 'active', goldCollateral: { isNot: null } },
      include: { goldCollateral: true, customer: { select: { name: true, phone: true } } },
    });
    const rows = loans.map((l) => {
      const c = l.goldCollateral!;
      const outstanding = Number(c.outstandingPrincipal ?? l.principal);
      const s = computeServicing({
        outstandingPrincipal: outstanding,
        monthlyRatePercent: ratePercent,
        interestPaidUpto: new Date(c.interestPaidUpto ?? l.startDate),
        now,
      });
      return {
        loanId: l.id, loanCode: l.loanCode,
        customer: l.customer?.name, phone: l.customer?.phone,
        outstandingPrincipal: outstanding,
        monthsDue: s.monthsDue, interestDue: s.interestDue, redemptionAmount: s.redemptionAmount,
      };
    });
    const totalPending = rows.reduce((sum, r) => sum + r.interestDue, 0);
    return ok({ rows, totalPledges: rows.length, totalPendingInterest: totalPending });
  }

  if (type === 'ornaments') {
    // Aggregate active-pledge ornament items by type.
    const items = await prisma.goldOrnamentItem.findMany({
      where: { tenantId: ctx.tenantId, collateral: { loan: { ...scope, status: 'active' } } },
      select: { ornamentType: true, quantity: true, grossWeightGrams: true, wastageGrams: true, netWeightGrams: true, value: true },
    });
    const byType = new Map<string, { ornamentType: string; quantity: number; grossWeight: number; wastage: number; netWeight: number; value: number }>();
    for (const it of items) {
      const k = it.ornamentType;
      const row = byType.get(k) ?? { ornamentType: k, quantity: 0, grossWeight: 0, wastage: 0, netWeight: 0, value: 0 };
      row.quantity += it.quantity;
      row.grossWeight += Number(it.grossWeightGrams);
      row.wastage += Number(it.wastageGrams);
      row.netWeight += Number(it.netWeightGrams);
      row.value += Number(it.value);
      byType.set(k, row);
    }
    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const rows = [...byType.values()].map((r) => ({ ...r, grossWeight: round3(r.grossWeight), wastage: round3(r.wastage), netWeight: round3(r.netWeight), value: Math.round(r.value) }));
    return ok({ rows });
  }

  if (type === 'summary') {
    const [active, closed, activeAgg] = await Promise.all([
      prisma.loan.findMany({
        where: { ...scope, status: 'active', goldCollateral: { isNot: null } },
        include: { goldCollateral: true },
      }),
      prisma.goldLoanCollateral.aggregate({
        where: { tenantId: ctx.tenantId, releaseStatus: 'released' },
        _sum: { grossWeightGrams: true, netWeightGrams: true },
      }),
      prisma.goldLoanCollateral.aggregate({
        where: { tenantId: ctx.tenantId, releaseStatus: 'pledged' },
        _sum: { grossWeightGrams: true, netWeightGrams: true },
      }),
    ]);

    let totalLoan = 0;
    let totalPending = 0;
    for (const l of active) {
      const c = l.goldCollateral!;
      const outstanding = Number(c.outstandingPrincipal ?? l.principal);
      totalLoan += outstanding;
      const s = computeServicing({
        outstandingPrincipal: outstanding,
        monthlyRatePercent: ratePercent,
        interestPaidUpto: new Date(c.interestPaidUpto ?? l.startDate),
        now,
      });
      totalPending += s.interestDue;
    }

    return ok({
      activePledges: active.length,
      totalLoanAmount: Math.round(totalLoan),
      totalPendingInterest: Math.round(totalPending),
      storeRatePerGram: config.goldPureRatePerGram,
      activeOrnamentWeight: {
        gross: Number(activeAgg._sum.grossWeightGrams ?? 0),
        net: Number(activeAgg._sum.netWeightGrams ?? 0),
      },
      closedOrnamentWeight: {
        gross: Number(closed._sum.grossWeightGrams ?? 0),
        net: Number(closed._sum.netWeightGrams ?? 0),
      },
    });
  }

  return fail('type must be pending | ornaments | summary', 400);
}
