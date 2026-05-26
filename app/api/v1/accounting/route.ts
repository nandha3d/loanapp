import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const loanBase: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };

  try {
    // All accounting entries for this tenant/branch
    const entries = await prisma.accountEntry.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...scopedBranchWhere(ctx),
      },
      select: { type: true, amount: true },
    });

    let capitalIn = 0;
    let capitalOut = 0;
    let totalDisbursed = 0;
    let totalCollected = 0;
    let totalExpenses = 0;

    for (const e of entries) {
      const amt = Number(e.amount);
      switch (e.type) {
        case 'capital_add':      capitalIn      += amt; break;
        case 'capital_withdraw': capitalOut     += amt; break;
        case 'loan_disburse':    totalDisbursed += amt; break;
        case 'collection':       totalCollected += amt; break;
        case 'expense':          totalExpenses  += amt; break;
      }
    }

    const currentCapital =
      capitalIn - capitalOut - totalDisbursed + totalCollected - totalExpenses;

    // Projected interest from active loans
    const activeLoans = await prisma.loan.findMany({
      where: { ...loanBase, status: { in: ['active', 'overdue'] } },
      select: { principal: true, totalPayable: true, deduction: true },
    });

    const totalInterest = activeLoans.reduce(
      (s, l) => s + (Number(l.totalPayable) - Number(l.principal)),
      0,
    );
    const totalDeductions = activeLoans.reduce(
      (s, l) => s + Number(l.deduction),
      0,
    );
    const projectedRevenue = totalInterest + totalDeductions;
    const netProfit = projectedRevenue - totalExpenses;

    return ok({
      totalCollected,
      totalDisbursed,
      totalExpenses,
      currentCapital,
      netProfit,
      projectedRevenue,
      capitalIn,
      capitalOut,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Accounting summary failed', 500);
  }
}
